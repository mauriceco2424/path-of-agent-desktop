//! OAuth Authentication Flow Commands
//!
//! Implements GGG OAuth 2.1 PKCE flow for the desktop app (confidential client).
//! The token exchange happens directly between the desktop and GGG — no server proxy.
//!
//! Flow:
//! 1. Desktop generates PKCE verifier + challenge, opens browser to GGG
//! 2. User authorizes → GGG redirects to https://pathofagent.com/auth/callback
//! 3. Website relay page converts to pathofagent://auth/callback?code=X&state=Y
//! 4. Deep link fires → frontend calls exchange_ggg_oauth with code + state
//! 5. Desktop exchanges code directly with GGG /oauth/token (PKCE + client_secret)
//! 6. Desktop fetches profile + characters using the access token
//!
//! Our own auth (email/password → session token → api.pathofagent.com) is separate.

use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::commands::config::{
    clear_session_token as config_clear_token,
    set_session_token as config_set_token,
};
use crate::AppConfig;

// ============================================
// Constants
// ============================================

const GGG_AUTHORIZE_URL: &str = "https://www.pathofexile.com/oauth/authorize";
const GGG_TOKEN_URL: &str = "https://www.pathofexile.com/oauth/token";
const GGG_PROFILE_URL: &str = "https://www.pathofexile.com/api/profile";
const GGG_CHARACTER_URL: &str = "https://www.pathofexile.com/character-window/get-characters";
const GGG_USER_AGENT: &str = "OAuth pathofagent/1.0.0 (contact: contact@pathofagent.com)";
const OAUTH_SCOPES: &str = "account:profile account:characters account:stashes account:league_accounts";
const OAUTH_REDIRECT_URI: &str = "https://pathofagent.com/auth/callback";

// ============================================
// Type Definitions
// ============================================

/// Response from starting the OAuth flow
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GGGOAuthStartResult {
    /// Indicates the browser was opened successfully
    pub started: bool,
}

/// Response from exchanging the OAuth code
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GGGOAuthResult {
    /// GGG account name (with discriminator, e.g. "Player#1234")
    pub account_name: String,
    /// GGG OAuth access token for authenticated API calls
    pub access_token: String,
    /// Character list (may be empty if fetch failed)
    #[serde(default)]
    pub characters: Vec<serde_json::Value>,
}

/// Current authentication status (for our own email/password auth)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub is_authenticated: bool,
    pub account_name: Option<String>,
    pub expires_at: Option<String>,
}

/// In-memory OAuth state for coordinating the PKCE flow
#[derive(Debug, Default)]
pub struct OAuthState {
    pub code_verifier: Option<String>,
    pub state: Option<String>,
    pub in_progress: bool,
}

impl OAuthState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn clear(&mut self) {
        self.code_verifier = None;
        self.state = None;
        self.in_progress = false;
    }
}

// ============================================
// Helpers
// ============================================

// Compile-time bake of GGG OAuth credentials. build-desktop.ps1 reads these
// from backend/.env and exports them as env vars before running `tauri build`,
// so production installers don't depend on backend/.env existing at runtime.
// OAuth client_id is public; client_secret is treated as "confidential client"
// but GGG's PKCE flow makes the code_verifier the real security boundary.
const BAKED_GGG_OAUTH_CLIENT_ID: Option<&str> = option_env!("GGG_OAUTH_CLIENT_ID");
const BAKED_GGG_OAUTH_CLIENT_SECRET: Option<&str> = option_env!("GGG_OAUTH_CLIENT_SECRET");

/// Read an env var, falling back to parsing backend/.env (dev), then to
/// compile-time baked values (production installer).
fn read_env_or_dotenv(key: &str) -> Option<String> {
    if let Ok(val) = std::env::var(key) {
        if !val.is_empty() {
            return Some(val);
        }
    }
    for env_path in &["../backend/.env", "../../backend/.env", "backend/.env"] {
        if let Ok(contents) = std::fs::read_to_string(env_path) {
            let prefix = format!("{}=", key);
            for line in contents.lines() {
                let line = line.trim();
                if let Some(value) = line.strip_prefix(&prefix) {
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    if !value.is_empty() {
                        return Some(value.to_string());
                    }
                }
            }
        }
    }
    // Production fallback: value baked in at compile time by build-desktop.ps1
    let baked = match key {
        "GGG_OAUTH_CLIENT_ID" => BAKED_GGG_OAUTH_CLIENT_ID,
        "GGG_OAUTH_CLIENT_SECRET" => BAKED_GGG_OAUTH_CLIENT_SECRET,
        _ => None,
    };
    baked.filter(|s| !s.is_empty()).map(String::from)
}

/// Generate a cryptographically secure PKCE code verifier (RFC 7636 §4.1)
fn generate_code_verifier() -> String {
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{}{}", a, b)
}

/// Generate a random state parameter for CSRF protection
fn generate_state() -> String {
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{}{}", a, b)
}

/// Compute S256 code challenge from a code verifier (RFC 7636 §4.2)
fn compute_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash)
}

// ============================================
// GGG OAuth IPC Commands
// ============================================

/// Start the GGG OAuth flow — opens browser, returns immediately.
///
/// The frontend should set up the deep link listener BEFORE calling this.
/// When GGG redirects back, the deep link fires and the frontend calls
/// exchange_ggg_oauth with the code + state.
#[tauri::command]
pub async fn start_ggg_oauth(
    app: AppHandle,
    oauth_state: State<'_, std::sync::Mutex<OAuthState>>,
) -> Result<GGGOAuthStartResult, String> {
    let client_id = read_env_or_dotenv("GGG_OAUTH_CLIENT_ID")
        .ok_or("GGG_OAUTH_CLIENT_ID not configured. Add it to backend/.env.")?;

    // Prevent concurrent flows
    {
        let oauth = oauth_state.lock().map_err(|_| "Failed to lock OAuth state")?;
        if oauth.in_progress {
            return Err("OAuth flow already in progress".to_string());
        }
    }

    let code_verifier = generate_code_verifier();
    let code_challenge = compute_code_challenge(&code_verifier);
    let state = generate_state();

    // Store state for verification when the callback arrives
    {
        let mut oauth = oauth_state.lock().map_err(|_| "Failed to lock OAuth state")?;
        oauth.code_verifier = Some(code_verifier);
        oauth.state = Some(state.clone());
        oauth.in_progress = true;
    }

    // Build authorization URL
    let auth_url = format!(
        "{}?client_id={}&response_type=code&scope={}&state={}&redirect_uri={}&code_challenge={}&code_challenge_method=S256",
        GGG_AUTHORIZE_URL,
        urlencoding::encode(&client_id),
        urlencoding::encode(OAUTH_SCOPES),
        urlencoding::encode(&state),
        urlencoding::encode(OAUTH_REDIRECT_URI),
        urlencoding::encode(&code_challenge),
    );

    // Open browser
    app.opener()
        .open_url(&auth_url, None::<String>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;

    log::info!("GGG OAuth flow started, waiting for callback...");

    Ok(GGGOAuthStartResult { started: true })
}

/// Exchange an OAuth authorization code for an access token + character list.
///
/// Called by the frontend when the deep link callback fires with code + state.
/// Exchanges the code directly with GGG (no server proxy).
#[tauri::command]
pub async fn exchange_ggg_oauth(
    code: String,
    state: String,
    http_client: State<'_, reqwest::Client>,
    oauth_state: State<'_, std::sync::Mutex<OAuthState>>,
) -> Result<GGGOAuthResult, String> {
    // Retrieve and validate stored state
    let code_verifier = {
        let oauth = oauth_state.lock().map_err(|_| "Failed to lock OAuth state")?;
        if !oauth.in_progress {
            return Err("No OAuth flow in progress".to_string());
        }
        if oauth.state.as_deref() != Some(&state) {
            return Err("State mismatch — possible CSRF attack. Please try again.".to_string());
        }
        oauth.code_verifier.clone()
            .ok_or("Missing code verifier")?
    };

    let client_id = read_env_or_dotenv("GGG_OAUTH_CLIENT_ID")
        .ok_or("GGG_OAUTH_CLIENT_ID not configured")?;
    let client_secret = read_env_or_dotenv("GGG_OAUTH_CLIENT_SECRET")
        .unwrap_or_default();

    // Exchange code for access token directly with GGG
    let mut token_params: Vec<(&str, &str)> = vec![
        ("client_id", &client_id),
        ("grant_type", "authorization_code"),
        ("code", &code),
        ("redirect_uri", OAUTH_REDIRECT_URI),
        ("code_verifier", &code_verifier),
    ];
    if !client_secret.is_empty() {
        token_params.push(("client_secret", &client_secret));
    }

    let token_response = http_client
        .post(GGG_TOKEN_URL)
        .header("User-Agent", GGG_USER_AGENT)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&token_params)
        .send()
        .await
        .map_err(|e| {
            if let Ok(mut oauth) = oauth_state.lock() { oauth.clear(); }
            format!("Failed to exchange code with GGG: {}", e)
        })?;

    if !token_response.status().is_success() {
        let status = token_response.status();
        let error_text = token_response.text().await.unwrap_or_default();
        if let Ok(mut oauth) = oauth_state.lock() { oauth.clear(); }
        return Err(format!("GGG token exchange failed ({}): {}", status, error_text));
    }

    let token_data: serde_json::Value = token_response.json().await
        .map_err(|e| format!("Failed to parse GGG token response: {}", e))?;

    let access_token = token_data["access_token"]
        .as_str()
        .ok_or("GGG token response missing access_token")?
        .to_string();

    log::info!("Successfully obtained GGG OAuth access token");

    // Fetch profile to get account name
    let profile_response = http_client
        .get(GGG_PROFILE_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", GGG_USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch GGG profile: {}", e))?;

    if !profile_response.status().is_success() {
        let status = profile_response.status();
        if let Ok(mut oauth) = oauth_state.lock() { oauth.clear(); }
        return Err(format!("Failed to fetch GGG profile ({})", status));
    }

    let profile_data: serde_json::Value = profile_response.json().await
        .map_err(|e| format!("Failed to parse GGG profile: {}", e))?;

    let account_name = profile_data["name"]
        .as_str()
        .ok_or("GGG profile missing account name")?
        .to_string();

    log::info!("GGG OAuth account: {}", account_name);

    // Fetch character list (best-effort)
    let characters = match http_client
        .get(GGG_CHARACTER_URL)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", GGG_USER_AGENT)
        .query(&[("accountName", &account_name)])
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            resp.json::<Vec<serde_json::Value>>().await.unwrap_or_default()
        }
        Ok(resp) => {
            log::warn!("Failed to fetch characters via OAuth ({})", resp.status());
            vec![]
        }
        Err(e) => {
            log::warn!("Failed to fetch characters: {}", e);
            vec![]
        }
    };

    // Clear OAuth state — flow complete
    if let Ok(mut oauth) = oauth_state.lock() { oauth.clear(); }

    Ok(GGGOAuthResult {
        account_name,
        access_token,
        characters,
    })
}

/// Cancel an in-progress OAuth flow
#[tauri::command]
pub async fn cancel_ggg_oauth(
    oauth_state: State<'_, std::sync::Mutex<OAuthState>>,
) -> Result<(), String> {
    if let Ok(mut oauth) = oauth_state.lock() { oauth.clear(); }
    Ok(())
}

// ============================================
// Session Auth IPC Commands (email/password — our own auth, unchanged)
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionCheckResponse {
    authenticated: bool,
    user: Option<SessionCheckUser>,
    expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionCheckUser {
    display_name: String,
}

#[tauri::command]
pub async fn get_auth_status(
    app: AppHandle,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<AuthStatus, String> {
    let user_config = crate::commands::config::load_config_from_disk(&app);

    let session_token = match user_config.session_token {
        Some(token) => token,
        None => {
            return Ok(AuthStatus {
                is_authenticated: false,
                account_name: None,
                expires_at: None,
            });
        }
    };

    let url = format!("{}/api/v1/auth/session", config.remote_api_url);
    let response = http_client
        .get(&url)
        .header("Authorization", format!("Bearer {}", session_token))
        .send()
        .await;

    match response {
        Ok(resp) if resp.status().is_success() => {
            let session_check: SessionCheckResponse = resp.json().await
                .map_err(|e| format!("Failed to parse session: {}", e))?;
            if session_check.authenticated {
                Ok(AuthStatus {
                    is_authenticated: true,
                    account_name: session_check.user.map(|u| u.display_name),
                    expires_at: session_check.expires_at,
                })
            } else {
                config_clear_token(app).await?;
                Ok(AuthStatus { is_authenticated: false, account_name: None, expires_at: None })
            }
        }
        Ok(resp) if resp.status().as_u16() == 401 => {
            config_clear_token(app).await?;
            Ok(AuthStatus { is_authenticated: false, account_name: None, expires_at: None })
        }
        Ok(resp) => Err(format!("Session check failed ({})", resp.status())),
        Err(e) => {
            log::warn!("Could not verify session: {}", e);
            Ok(AuthStatus { is_authenticated: true, account_name: None, expires_at: None })
        }
    }
}

#[tauri::command]
pub async fn logout(
    app: AppHandle,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<(), String> {
    let user_config = crate::commands::config::load_config_from_disk(&app);
    config_clear_token(app.clone()).await?;

    // Clear token on the local sidecar so it stops proxying authenticated requests.
    // Best-effort — sidecar may not be running. Short timeout so logout isn't
    // blocked for minutes if the sidecar is unreachable (e.g. firewall drop).
    let sidecar_url = format!("{}/api/v1/session-token", config.backend_url);
    let mut req = http_client
        .post(&sidecar_url)
        .timeout(std::time::Duration::from_secs(2))
        .json(&serde_json::json!({ "token": "" }));
    if let Some(secret) = crate::sidecar_secret() {
        req = req.header("X-Sidecar-Secret", secret);
    }
    match req.send().await {
        Ok(_) => log::info!("Cleared session token on sidecar"),
        Err(e) => log::warn!("Failed to clear sidecar session token (best-effort): {}", e),
    }

    if let Some(token) = user_config.session_token {
        let url = format!("{}/api/v1/auth/logout", config.remote_api_url);
        let _ = http_client.post(&url).header("Authorization", format!("Bearer {}", token)).send().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn refresh_session(
    app: AppHandle,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<AuthStatus, String> {
    let user_config = crate::commands::config::load_config_from_disk(&app);
    let session_token = user_config.session_token.ok_or("Not authenticated")?;
    let url = format!("{}/api/v1/auth/session", config.remote_api_url);
    let response = http_client.get(&url)
        .header("Authorization", format!("Bearer {}", session_token))
        .send().await
        .map_err(|e| format!("Failed to connect to remote API: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        if status.as_u16() == 401 {
            config_clear_token(app).await?;
            return Err("Session expired, please login again".to_string());
        }
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Refresh failed ({}): {}", status, error_text));
    }
    let session_check: SessionCheckResponse = response.json().await
        .map_err(|e| format!("Failed to parse session: {}", e))?;
    if session_check.authenticated {
        Ok(AuthStatus {
            is_authenticated: true,
            account_name: session_check.user.map(|u| u.display_name),
            expires_at: session_check.expires_at,
        })
    } else {
        config_clear_token(app).await?;
        Ok(AuthStatus { is_authenticated: false, account_name: None, expires_at: None })
    }
}

#[tauri::command]
pub async fn store_session_token(token: String, app: AppHandle) -> Result<(), String> {
    config_set_token(token, app).await
}
