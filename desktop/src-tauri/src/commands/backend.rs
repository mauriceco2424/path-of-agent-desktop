//! Backend Server Communication Commands
//!
//! These commands handle communication with the Path of Agent backend server
//! for features like build import, PoB analysis, and AI chat.

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppConfig;

/// Request to import a build from PoB code
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildImportRequest {
    pub pob_code: String,
}

/// Response from build import
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildImportResponse {
    pub build_id: String,
    pub class: String,
    pub ascendancy: String,
    pub level: u32,
}

/// Generic backend API response
#[derive(Debug, Serialize, Deserialize)]
pub struct BackendResponse {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Import a build via the backend server
///
/// PoB computation happens server-side to avoid bundling PoB in the desktop app.
#[tauri::command]
pub async fn import_build(
    request: BuildImportRequest,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<BuildImportResponse, String> {
    let url = format!("{}/api/v1/builds/import", config.backend_url);

    let response = http_client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Backend error ({}): {}", status, error_text));
    }

    response
        .json::<BuildImportResponse>()
        .await
        .map_err(|e| format!("Failed to parse build import response: {}", e))
}

/// Get analysis for a build
#[tauri::command]
pub async fn get_analysis(
    build_id: String,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<serde_json::Value, String> {
    let url = format!("{}/api/v1/builds/{}/analysis", config.backend_url, build_id);

    let response = http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Backend error ({}): {}", status, error_text));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse analysis response: {}", e))
}

/// Generic backend API call
///
/// Used for AI/LLM features and other backend endpoints.
#[tauri::command]
pub async fn call_backend(
    endpoint: String,
    method: String,
    body: Option<serde_json::Value>,
    session_token: Option<String>,
    config: State<'_, AppConfig>,
    http_client: State<'_, reqwest::Client>,
) -> Result<serde_json::Value, String> {
    let url = format!("{}{}", config.backend_url, endpoint);

    let mut request = match method.to_uppercase().as_str() {
        "GET" => http_client.get(&url),
        "POST" => http_client.post(&url),
        "PUT" => http_client.put(&url),
        "DELETE" => http_client.delete(&url),
        "PATCH" => http_client.patch(&url),
        _ => return Err(format!("Invalid HTTP method: {}", method)),
    };

    // Add authentication header if session token provided
    if let Some(token) = session_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }

    // Add JSON body if provided
    if let Some(body) = body {
        request = request.json(&body);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Failed to connect to backend: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Backend error ({}): {}", status, error_text));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))
}
