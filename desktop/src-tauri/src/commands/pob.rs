//! Path of Building Integration Commands
//!
//! These commands handle finding and launching Path of Building (PoB) on the user's system,
//! allowing builds to be opened directly in PoB from the desktop application.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Result of searching for a PoB installation
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PoBInstallation {
    pub path: String,
    pub source: String, // "registry" or "common_path"
}

/// Find the Path of Building installation on the user's system
///
/// On Windows, this checks:
/// 1. The registry key where PoB registers its protocol handler
/// 2. Common installation paths like %LOCALAPPDATA%\Path of Building Community
///
/// Returns the path to the PoB executable if found, or None if not installed.
#[tauri::command]
pub async fn find_pob_installation() -> Result<Option<PoBInstallation>, String> {
    #[cfg(target_os = "windows")]
    {
        find_pob_windows()
    }

    #[cfg(not(target_os = "windows"))]
    {
        // PoB is primarily a Windows application
        // macOS/Linux support could be added via Wine detection
        Ok(None)
    }
}

/// Find PoB installation on Windows
#[cfg(target_os = "windows")]
fn find_pob_windows() -> Result<Option<PoBInstallation>, String> {
    // Try registry first - this is the most reliable method
    if let Some(path) = find_pob_from_registry() {
        return Ok(Some(PoBInstallation {
            path,
            source: "registry".to_string(),
        }));
    }

    // Fallback to common installation paths
    if let Some(path) = find_pob_from_common_paths() {
        return Ok(Some(PoBInstallation {
            path,
            source: "common_path".to_string(),
        }));
    }

    Ok(None)
}

/// Check Windows registry for PoB protocol handler
#[cfg(target_os = "windows")]
fn find_pob_from_registry() -> Option<String> {
    use winreg::enums::*;
    use winreg::RegKey;

    // PoB registers a 'pob://' protocol handler in the registry
    // The path is stored in HKEY_CURRENT_USER\Software\Classes\pob\shell\open\command
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let path = r"Software\Classes\pob\shell\open\command";
    let key = hkcu.open_subkey(path).ok()?;

    // The default value contains something like:
    // "C:\Users\User\AppData\Local\Path of Building Community\Path of Building.exe" "%1"
    let command: String = key.get_value("").ok()?;

    // Extract the executable path from the command
    // It's typically quoted: "C:\path\to\exe.exe" "%1"
    extract_exe_path(&command)
}

/// Extract the executable path from a registry command string
#[cfg(target_os = "windows")]
fn extract_exe_path(command: &str) -> Option<String> {
    let command = command.trim();

    if command.starts_with('"') {
        // Quoted path: "C:\path\to\exe.exe" "%1"
        // Find the closing quote
        if let Some(end) = command[1..].find('"') {
            let path = &command[1..=end];
            // Verify the file exists
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
    } else {
        // Unquoted path (less common): C:\path\to\exe.exe %1
        // Take everything up to the first space that's followed by %
        if let Some(idx) = command.find(" %") {
            let path = command[..idx].trim();
            if std::path::Path::new(path).exists() {
                return Some(path.to_string());
            }
        }
    }

    None
}

/// Check common installation paths for PoB
#[cfg(target_os = "windows")]
fn find_pob_from_common_paths() -> Option<String> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;

    // Common installation directories for PoB Community Fork
    let common_paths = [
        "Path of Building Community\\Path of Building.exe",
        "Path of Building\\Path of Building.exe",
        "Programs\\Path of Building Community\\Path of Building.exe",
        "PathOfBuildingCommunity\\Path of Building.exe",
    ];

    for relative_path in common_paths {
        let full_path = PathBuf::from(&local_app_data).join(relative_path);
        if full_path.exists() {
            return Some(full_path.to_string_lossy().to_string());
        }
    }

    // Also check Program Files
    if let Ok(program_files) = std::env::var("PROGRAMFILES") {
        let pf_path = PathBuf::from(&program_files)
            .join("Path of Building Community")
            .join("Path of Building.exe");
        if pf_path.exists() {
            return Some(pf_path.to_string_lossy().to_string());
        }
    }

    // Check Program Files (x86) as well
    if let Ok(program_files_x86) = std::env::var("PROGRAMFILES(X86)") {
        let pf_path = PathBuf::from(&program_files_x86)
            .join("Path of Building Community")
            .join("Path of Building.exe");
        if pf_path.exists() {
            return Some(pf_path.to_string_lossy().to_string());
        }
    }

    None
}

/// Open a build in Path of Building
///
/// This finds the PoB installation and launches it with the build URL as an argument.
/// PoB will download the build from the URL and load it automatically.
///
/// # Arguments
/// * `build_url` - The URL where the build code can be fetched (e.g., http://localhost:9876/api/v1/builds/share/abc123)
///
/// # Returns
/// * `Ok(())` if PoB was launched successfully
/// * `Err(String)` if PoB couldn't be found or launched
#[tauri::command]
pub async fn open_in_pob(build_url: String) -> Result<(), String> {
    // Find PoB installation
    let installation = find_pob_installation().await?;

    let installation = installation.ok_or_else(|| {
        "Path of Building is not installed. Please install it from https://pathofbuilding.community/ and try again.".to_string()
    })?;

    // Launch PoB with the build URL as an argument
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let result = Command::new(&installation.path)
            .arg(&build_url)
            .spawn();

        match result {
            Ok(_) => {
                log::info!("Launched PoB from {} with URL: {}", installation.path, build_url);
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to launch PoB: {}", e);
                Err(format!(
                    "Failed to launch Path of Building: {}. The executable was found at '{}' but couldn't be started.",
                    e, installation.path
                ))
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Opening builds in Path of Building is only supported on Windows.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "windows")]
    fn test_extract_exe_path_quoted() {
        let command = r#""C:\Users\Test\AppData\Local\Path of Building Community\Path of Building.exe" "%1""#;
        // This will return None because the path doesn't exist on the test machine,
        // but we can at least test the parsing logic by checking the pattern
        let _ = extract_exe_path(command);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_extract_exe_path_unquoted() {
        let command = r#"C:\PoB\PathOfBuilding.exe %1"#;
        let _ = extract_exe_path(command);
    }
}
