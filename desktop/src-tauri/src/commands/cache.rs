//! Local Cache Storage Commands
//!
//! These commands manage local storage for build data, providing
//! offline capability and faster access to recently used builds.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Cached build information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedBuild {
    pub build_id: String,
    pub name: String,
    pub class: String,
    pub ascendancy: String,
    pub level: u32,
    pub pob_code: Option<String>,
    pub cached_at: String,
}

/// Get the cache directory for the application
fn get_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("cache"))
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

/// Get the builds cache directory
fn get_builds_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    get_cache_dir(app).map(|p| p.join("builds"))
}

/// Store a build in local cache
#[tauri::command]
pub async fn store_build(build: CachedBuild, app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = get_builds_cache_dir(&app)?;

    // Create cache directory if it doesn't exist
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;

    let file_path = cache_dir.join(format!("{}.json", build.build_id));
    let content = serde_json::to_string_pretty(&build)
        .map_err(|e| format!("Failed to serialize build: {}", e))?;

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write build to cache: {}", e))?;

    Ok(())
}

/// Retrieve all cached builds
#[tauri::command]
pub async fn get_cached_builds(app: tauri::AppHandle) -> Result<Vec<CachedBuild>, String> {
    let cache_dir = get_builds_cache_dir(&app)?;

    if !cache_dir.exists() {
        return Ok(vec![]);
    }

    let mut builds = vec![];

    let entries = fs::read_dir(&cache_dir)
        .map_err(|e| format!("Failed to read cache directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only process JSON files
        if path.extension().map_or(false, |ext| ext == "json") {
            match fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<CachedBuild>(&content) {
                    Ok(build) => builds.push(build),
                    Err(e) => {
                        // Log but don't fail on individual parse errors
                        log::warn!("Failed to parse cached build {:?}: {}", path, e);
                    }
                },
                Err(e) => {
                    log::warn!("Failed to read cached build {:?}: {}", path, e);
                }
            }
        }
    }

    // Sort by cached_at descending (most recent first)
    builds.sort_by(|a, b| b.cached_at.cmp(&a.cached_at));

    Ok(builds)
}

/// Clear all cached builds
#[tauri::command]
pub async fn clear_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = get_cache_dir(&app)?;

    if cache_dir.exists() {
        fs::remove_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to clear cache: {}", e))?;
    }

    Ok(())
}
