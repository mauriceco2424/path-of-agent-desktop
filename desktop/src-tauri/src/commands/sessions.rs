//! Session Snapshot Storage Commands
//!
//! Stores analysis session snapshots as individual JSON files on disk,
//! replacing the browser localStorage approach (which was limited to ~5 MB).
//! Each snapshot gets its own file at `{appDataDir}/sessions/{id}.json`,
//! supporting a 50 MB budget (~38 full 3-pathway sessions).

use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the sessions storage directory
fn get_sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("sessions"))
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

/// Reject ids that contain path separators, traversal sequences, or non-filename
/// characters. Prevents `id: "../config"` from escaping the sessions directory.
fn validate_session_id(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 64 {
        return Err("Invalid session id: must be 1-64 characters".to_string());
    }
    let ok = id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !ok {
        return Err("Invalid session id: only alphanumeric, hyphen, underscore allowed".to_string());
    }
    Ok(())
}

/// Save a single session snapshot to disk
#[tauri::command]
pub async fn save_session_snapshot(
    id: String,
    data: Value,
    app: tauri::AppHandle,
) -> Result<(), String> {
    validate_session_id(&id)?;
    let sessions_dir = get_sessions_dir(&app)?;

    fs::create_dir_all(&sessions_dir)
        .map_err(|e| format!("Failed to create sessions directory: {}", e))?;

    let file_path = sessions_dir.join(format!("{}.json", id));
    let tmp_path = sessions_dir.join(format!("{}.json.tmp", id));
    let content = serde_json::to_string(&data)
        .map_err(|e| format!("Failed to serialize snapshot: {}", e))?;

    // Atomic write: write to tmp then rename. Prevents corrupt files if two
    // save_session_snapshot calls race on the same id, or if the process is
    // killed mid-write.
    fs::write(&tmp_path, content)
        .map_err(|e| format!("Failed to write snapshot to disk: {}", e))?;
    fs::rename(&tmp_path, &file_path)
        .map_err(|e| format!("Failed to finalize snapshot write: {}", e))?;

    Ok(())
}

/// Load all session snapshots from disk
#[tauri::command]
pub async fn load_session_snapshots(app: tauri::AppHandle) -> Result<Vec<Value>, String> {
    let sessions_dir = get_sessions_dir(&app)?;

    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let mut snapshots = vec![];

    let entries = fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().map_or(false, |ext| ext == "json") {
            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<Value>(&content) {
                    Ok(snapshot) => snapshots.push(snapshot),
                    Err(e) => {
                        log::warn!("Failed to parse session snapshot {:?}: {}", path, e);
                    }
                },
                Err(e) => {
                    log::warn!("Failed to read session snapshot {:?}: {}", path, e);
                }
            }
        }
    }

    Ok(snapshots)
}

/// Delete a single session snapshot from disk
#[tauri::command]
pub async fn delete_session_snapshot(id: String, app: tauri::AppHandle) -> Result<(), String> {
    validate_session_id(&id)?;
    let file_path = get_sessions_dir(&app)?.join(format!("{}.json", id));

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete session snapshot: {}", e))?;
    }

    Ok(())
}

/// Clear all session snapshots from disk
#[tauri::command]
pub async fn clear_session_snapshots(app: tauri::AppHandle) -> Result<(), String> {
    let sessions_dir = get_sessions_dir(&app)?;

    if sessions_dir.exists() {
        fs::remove_dir_all(&sessions_dir)
            .map_err(|e| format!("Failed to clear sessions: {}", e))?;
    }

    Ok(())
}

/// Get total disk usage of all session snapshots (in bytes)
#[tauri::command]
pub async fn get_sessions_disk_usage(app: tauri::AppHandle) -> Result<u64, String> {
    let sessions_dir = get_sessions_dir(&app)?;

    if !sessions_dir.exists() {
        return Ok(0);
    }

    let mut total_bytes: u64 = 0;

    let entries = fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if path.extension().map_or(false, |ext| ext == "json") {
            if let Ok(metadata) = fs::metadata(&path) {
                total_bytes += metadata.len();
            }
        }
    }

    Ok(total_bytes)
}
