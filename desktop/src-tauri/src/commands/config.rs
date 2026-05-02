//! Application Configuration Commands
//!
//! These commands manage user preferences and application settings
//! that persist between sessions.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use uuid::Uuid;

/// Desktop application configuration
///
/// Stores device-specific settings, authentication state, and user preferences.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAppConfig {
    /// Unique device identifier (generated on first run)
    #[serde(default = "generate_device_id")]
    pub device_id: String,

    /// Backend server URL (can be overridden for self-hosting)
    #[serde(default = "default_backend_url")]
    pub backend_url: String,

    /// Current session token (from OAuth flow)
    /// This is the session token, not the OAuth access token - tokens stay on backend
    #[serde(default)]
    pub session_token: Option<String>,

    /// Update channel (stable, beta, nightly)
    #[serde(default = "default_update_channel")]
    pub update_channel: String,

    /// Preferred league for trade searches
    #[serde(default)]
    pub preferred_league: Option<String>,

    /// Enable auto-update checks
    #[serde(default = "default_true")]
    pub auto_update: bool,

    /// Theme preference (system, light, dark)
    #[serde(default = "default_theme")]
    pub theme: String,

    /// DEPRECATED: OpenAI API key is no longer stored locally.
    /// Kept for backwards-compatible deserialization of old config files.
    #[serde(default, skip_serializing)]
    pub openai_api_key: Option<String>,
}

fn generate_device_id() -> String {
    Uuid::new_v4().to_string()
}

fn default_backend_url() -> String {
    std::env::var("POA_BACKEND_URL").unwrap_or_else(|_| "http://localhost:9876".to_string())
}

fn default_update_channel() -> String {
    "stable".to_string()
}

fn default_true() -> bool {
    true
}

fn default_theme() -> String {
    "system".to_string()
}

impl Default for DesktopAppConfig {
    fn default() -> Self {
        Self {
            device_id: generate_device_id(),
            backend_url: default_backend_url(),
            session_token: None,
            update_channel: default_update_channel(),
            preferred_league: None,
            auto_update: true,
            theme: default_theme(),
            openai_api_key: None,
        }
    }
}

/// Backwards compatibility alias
pub type UserConfig = DesktopAppConfig;

/// Get the config file path
pub fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("config.json"))
        .map_err(|e| format!("Failed to get config directory: {}", e))
}

/// Load configuration from disk
pub fn load_config_from_disk(app: &tauri::AppHandle) -> DesktopAppConfig {
    let config_path = match get_config_path(app) {
        Ok(path) => path,
        Err(_) => return DesktopAppConfig::default(),
    };

    if !config_path.exists() {
        // Create default config with a new device ID
        let config = DesktopAppConfig::default();
        // Save it so device_id persists
        let _ = save_config_to_disk(app, &config);
        return config;
    }

    match fs::read_to_string(&config_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => DesktopAppConfig::default(),
    }
}

/// Save configuration to disk
fn save_config_to_disk(app: &tauri::AppHandle, config: &DesktopAppConfig) -> Result<(), String> {
    let config_path = get_config_path(app)?;

    // Ensure config directory exists
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Get the current application configuration
#[tauri::command]
pub async fn get_config(app: tauri::AppHandle) -> Result<DesktopAppConfig, String> {
    Ok(load_config_from_disk(&app))
}

/// Update application configuration
#[tauri::command]
pub async fn set_config(config: DesktopAppConfig, app: tauri::AppHandle) -> Result<(), String> {
    save_config_to_disk(&app, &config)
}

/// Set the session token after OAuth authentication
#[tauri::command]
pub async fn set_session_token(token: String, app: tauri::AppHandle) -> Result<(), String> {
    let mut config = load_config_from_disk(&app);
    config.session_token = Some(token);
    save_config_to_disk(&app, &config)
}

/// Clear the session token (logout)
#[tauri::command]
pub async fn clear_session_token(app: tauri::AppHandle) -> Result<(), String> {
    let mut config = load_config_from_disk(&app);
    config.session_token = None;
    save_config_to_disk(&app, &config)
}

/// Get the device ID (for OAuth flow)
#[tauri::command]
pub async fn get_device_id(app: tauri::AppHandle) -> Result<String, String> {
    let config = load_config_from_disk(&app);
    Ok(config.device_id)
}

