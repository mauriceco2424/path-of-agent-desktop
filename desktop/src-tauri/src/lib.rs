//! Path of Agent Desktop - Tauri Application Library
//!
//! This library provides the core functionality for the Path of Agent desktop application,
//! including IPC commands for trade API calls, backend communication, local caching,
//! OAuth authentication flow coordination, and backend sidecar lifecycle management.

pub mod commands;

use commands::auth::OAuthState;
use commands::trade::TradeRateLimiter;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;
use tauri_plugin_log::{Target, TargetKind};

/// Per-launch shared secret for mutating sidecar endpoints (e.g. /session-token).
/// Generated when the sidecar starts, passed via the `SIDECAR_SECRET` env var to
/// the backend, and returned here so Tauri's own auth.rs can send it as a header.
/// Defeats local CSRF: any webpage on `localhost` that tries to call the sidecar
/// without knowing this value is rejected.
static SIDECAR_SECRET: OnceLock<String> = OnceLock::new();

pub fn sidecar_secret() -> Option<&'static str> {
    SIDECAR_SECRET.get().map(String::as_str)
}

/// Application configuration state
pub struct AppConfig {
    pub backend_url: String,
    pub remote_api_url: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            backend_url: std::env::var("POA_BACKEND_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:9876".to_string()),
            remote_api_url: std::env::var("POA_REMOTE_API_URL")
                .unwrap_or_else(|_| "https://api.pathofagent.com".to_string()),
        }
    }
}

/// Holds the backend sidecar child process handle for lifecycle management.
///
/// The child process is killed when the Tauri app exits. Storing it in managed
/// state ensures we can access it from the shutdown handler.
///
/// On Windows, a Job Object is used to ensure the entire process tree (sidecar +
/// its child LuaJIT processes) is killed when the app exits, even on crash.
pub struct BackendSidecar {
    pub child: Option<std::process::Child>,
    /// Windows Job Object handle. When dropped, Windows kills all processes in the job.
    #[cfg(windows)]
    _job_handle: Option<JobHandle>,
}

/// RAII wrapper for a Windows Job Object handle.
/// Closes the handle on drop, which (with KILL_ON_JOB_CLOSE) terminates all child processes.
#[cfg(windows)]
pub struct JobHandle(windows_sys::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandle {}
#[cfg(windows)]
unsafe impl Sync for JobHandle {}

#[cfg(windows)]
impl Drop for JobHandle {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

/// Create a Windows Job Object configured to kill all assigned processes on close.
/// Assigns the given process (by PID) to the job.
#[cfg(windows)]
fn create_kill_on_close_job(child: &std::process::Child) -> Option<JobHandle> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    unsafe {
        // Create an anonymous job object
        let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if job.is_null() {
            log::error!("Failed to create Job Object");
            return None;
        }

        // Configure: kill all processes in job when last handle closes
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            &info as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            log::error!("Failed to set Job Object limits");
            CloseHandle(job);
            return None;
        }

        // Open the child process and assign it to the job
        let process_handle = windows_sys::Win32::System::Threading::OpenProcess(
            0x001F0FFF, // PROCESS_ALL_ACCESS
            0,          // bInheritHandle = FALSE
            child.id(),
        );
        if process_handle.is_null() {
            log::error!("Failed to open child process for job assignment");
            CloseHandle(job);
            return None;
        }

        let assigned = AssignProcessToJobObject(job, process_handle);
        CloseHandle(process_handle);

        if assigned == 0 {
            log::error!("Failed to assign sidecar to Job Object");
            CloseHandle(job);
            return None;
        }

        log::info!(
            "Sidecar PID {} assigned to kill-on-close Job Object",
            child.id()
        );
        Some(JobHandle(job))
    }
}

/// Attempt to spawn the backend sidecar process.
///
/// In release builds, this finds and spawns the `poa-backend` binary that was
/// bundled via `externalBin` in tauri.conf.json. We bypass Tauri's sidecar()
/// API because the NSIS installer flattens the directory structure, placing the
/// binary in the exe root instead of preserving the `binaries/` subdirectory.
///
/// In debug builds, the sidecar is NOT spawned -- the developer runs the backend
/// separately via `cd backend && npm run dev`.
///
/// Returns a BackendSidecar with no child if the sidecar should not be started (dev mode or binary missing).
fn spawn_backend_sidecar(
    #[allow(unused_variables)] app: &tauri::App,
) -> BackendSidecar {
    // In debug mode, don't spawn the sidecar -- developer runs backend separately
    #[cfg(debug_assertions)]
    {
        log::info!(
            "Dev mode: backend sidecar not started. Run `cd backend && npm run dev` separately."
        );
        return BackendSidecar {
            child: None,
            #[cfg(windows)]
            _job_handle: None,
        };
    }

    #[cfg(not(debug_assertions))]
    {
        use std::process::{Command, Stdio};

        // Load user config to get the session token for the OpenAI proxy.
        // The sidecar receives both the initial token (env var) and the on-disk
        // config path (DESKTOP_CONFIG_PATH). It re-reads the path per OpenAI call
        // so that token rotations written by the renderer are picked up without
        // needing an explicit push or sidecar restart.
        let user_config = commands::config::load_config_from_disk(app.handle());
        let session_token = user_config.session_token.unwrap_or_default();
        let config_path_str = commands::config::get_config_path(app.handle())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if session_token.is_empty() {
            log::warn!(
                "No session token found. Backend sidecar will start without analysis capabilities. \
                 Sign in to enable AI features."
            );
        }

        // Resolve the PoB bundle resource path
        // In production, resources are bundled into the app's resource directory
        let resource_dir = match app.path().resource_dir() {
            Ok(dir) => dir,
            Err(e) => {
                log::error!("Failed to resolve resource directory: {}", e);
                return BackendSidecar { child: None, #[cfg(windows)] _job_handle: None };
            }
        };

        // Strip \\?\ prefix from resource_dir — it causes issues with child process spawning
        let resource_str = resource_dir.to_string_lossy().to_string();
        let clean_resource = if resource_str.starts_with("\\\\?\\") {
            std::path::PathBuf::from(&resource_str[4..])
        } else {
            resource_dir.clone()
        };
        // Array-format resources preserve directory structure under resources/pob/
        // The actual PoB scripts are in resources/pob/src/ with subdirectories
        let pob_dir = clean_resource.join("resources").join("pob");
        let luajit_path = pob_dir.join("luajit.exe");
        // With array-format resources, directory structure is preserved.
        // PoB scripts live in pob/src/ with subdirectories (Modules/, Data/, etc.)
        let script_dir = pob_dir.join("src");

        // Log PoB bundle paths for debugging
        log::info!("Resource directory: {}", resource_dir.display());
        log::info!("PoB directory: {}", pob_dir.display());
        log::info!("LuaJIT path: {} (exists: {})", luajit_path.display(), luajit_path.exists());
        log::info!("Script directory: {} (exists: {})", script_dir.display(), script_dir.exists());
        let wrapper = script_dir.join("HeadlessWrapper.lua");
        log::info!("HeadlessWrapper.lua: {} (exists: {})", wrapper.display(), wrapper.exists());

        // Find the sidecar binary in the exe directory.
        // Tauri's NSIS bundler places externalBin files flat in the install dir,
        // NOT preserving the binaries/ subdirectory. The file may have a target
        // triple suffix (e.g., poa-backend-x86_64-pc-windows-msvc.exe) or not.
        let exe_dir = match std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())) {
            Some(dir) => dir,
            None => {
                log::error!("Failed to determine exe directory");
                return BackendSidecar { child: None, #[cfg(windows)] _job_handle: None };
            }
        };

        log::info!("Exe directory: {}", exe_dir.display());

        // Try candidate filenames in order of preference.
        // IMPORTANT: Tauri NSIS strips the target triple, installing the sidecar as
        // "poa-backend.exe". Check that name FIRST. The triple-suffixed name is only
        // a fallback for legacy installs — and we clean it up if we find the fresh one.
        let candidates = [
            "poa-backend.exe",
            "binaries/poa-backend.exe",
            "poa-backend-x86_64-pc-windows-msvc.exe",
            "binaries/poa-backend-x86_64-pc-windows-msvc.exe",
        ];

        // Clean up stale triple-suffixed binary from older installs so it doesn't
        // shadow the fresh poa-backend.exe on future lookups.
        let stale_triple = exe_dir.join("poa-backend-x86_64-pc-windows-msvc.exe");
        let fresh_plain = exe_dir.join("poa-backend.exe");
        if fresh_plain.exists() && stale_triple.exists() {
            log::info!("Removing stale triple-suffixed sidecar: {}", stale_triple.display());
            let _ = std::fs::remove_file(&stale_triple);
        }

        let sidecar_path = candidates.iter()
            .map(|name| exe_dir.join(name))
            .find(|path| path.exists());

        let sidecar_path = match sidecar_path {
            Some(path) => {
                log::info!("Found sidecar binary: {}", path.display());
                path
            }
            None => {
                log::error!(
                    "Backend sidecar binary not found. Checked: {}",
                    candidates.iter()
                        .map(|n| exe_dir.join(n).display().to_string())
                        .collect::<Vec<_>>()
                        .join(", ")
                );
                return BackendSidecar { child: None, #[cfg(windows)] _job_handle: None };
            }
        };

        // Spawn the sidecar process directly using std::process::Command.
        // We bypass Tauri's sidecar() API because it expects binaries in a
        // subdirectory that NSIS doesn't create.
        #[cfg(windows)]
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Data files are bundled as Tauri resources at resources/data/
        let data_dir = clean_resource.join("resources").join("data");
        log::info!("Data directory: {} (exists: {})", data_dir.display(), data_dir.exists());

        // Remote API URL for the OpenAI proxy (defaults to production)
        let remote_api_url = std::env::var("POA_REMOTE_API_URL")
            .unwrap_or_else(|_| "https://api.pathofagent.com".to_string());
        let proxy_url = format!("{}/api/v1/openai", remote_api_url);

        // Per-launch secret for authenticating Tauri-originated calls to
        // mutating sidecar endpoints (e.g. /session-token). Set once here,
        // read via sidecar_secret() elsewhere in the Tauri process.
        let sidecar_secret = SIDECAR_SECRET
            .get_or_init(|| uuid::Uuid::new_v4().simple().to_string())
            .clone();

        let mut cmd = Command::new(&sidecar_path);
        cmd.env("NODE_ENV", "desktop")
            .env("PORT", "9876")
            .env("HOST", "127.0.0.1")
            .env("POB_MODE", "local")
            .env("POB_LUAJIT_PATH", luajit_path.to_string_lossy().as_ref())
            .env("POB_SCRIPT_DIR", script_dir.to_string_lossy().as_ref())
            .env("POB_POOL_SIZE", "3")
            .env("DATA_DIR", data_dir.to_string_lossy().as_ref())
            .env("OPENAI_PROXY_URL", &proxy_url)
            .env("SESSION_TOKEN", &session_token)
            .env("DESKTOP_CONFIG_PATH", &config_path_str)
            .env("SIDECAR_SECRET", &sidecar_secret)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(e) => {
                log::error!(
                    "Failed to spawn backend sidecar '{}': {} (raw os error: {:?}). \
                     The application will not have backend functionality.",
                    sidecar_path.display(),
                    e,
                    e.raw_os_error()
                );
                return BackendSidecar { child: None, #[cfg(windows)] _job_handle: None };
            }
        };

        let pid = child.id();
        log::info!("Backend sidecar started (PID: {})", pid);

        // On Windows, assign the sidecar to a kill-on-close Job Object.
        // This ensures the entire process tree (sidecar + LuaJIT children) is
        // terminated when the app exits, even on crash.
        #[cfg(windows)]
        let job_handle = {
            let job = create_kill_on_close_job(&child);
            if job.is_none() {
                log::warn!(
                    "Could not create Job Object — sidecar child processes may orphan on exit"
                );
            }
            job
        };

        // Forward stdout to app log
        if let Some(stdout) = child.stdout.take() {
            std::thread::spawn(move || {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stdout);
                for line in reader.lines() {
                    match line {
                        Ok(text) => log::info!("[backend] {}", text),
                        Err(e) => {
                            log::error!("[backend] stdout read error: {}", e);
                            break;
                        }
                    }
                }
                log::info!("[backend] stdout stream closed");
            });
        }

        // Forward stderr to app log
        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stderr);
                for line in reader.lines() {
                    match line {
                        Ok(text) => log::warn!("[backend] {}", text),
                        Err(e) => {
                            log::error!("[backend] stderr read error: {}", e);
                            break;
                        }
                    }
                }
                log::info!("[backend] stderr stream closed");
            });
        }

        BackendSidecar {
            child: Some(child),
            #[cfg(windows)]
            _job_handle: job_handle,
        }
    }
}

/// Initialize and run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Initialize plugins
        // single-instance MUST be first: when the OS spawns a second process
        // for a `pathofagent://` deep link, the plugin forwards the URL to
        // the already-running primary and exits. Without it, each OAuth
        // callback spawns a fresh window that never sees the code+state,
        // and the primary stays stuck on "Waiting for authorization...".
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing window. Deep-link forwarding is handled
            // by the "deep-link" feature of single-instance, which re-emits
            // the URL to the primary instance's onOpenUrl listener.
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        // Log plugin - writes to file + stdout, captures frontend console
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    // Write to log file in app data directory
                    Target::new(TargetKind::LogDir { file_name: Some("app.log".into()) }),
                    // Also output to terminal in dev mode
                    Target::new(TargetKind::Stdout),
                    // Forward logs to webview console (bidirectional)
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Info)
                .build(),
        )
        // Setup application state and handlers
        .setup(|app| {
            // Initialize HTTP client for Trade API and backend requests
            // 5 minute timeout for long-running operations like initial analysis
            let client = reqwest::Client::builder()
                .user_agent("PathOfAgent/0.1.0 (contact@pathofagent.com)")
                .timeout(std::time::Duration::from_secs(300))
                .build()
                .expect("Failed to create HTTP client");
            app.manage(client);

            // Initialize Trade API rate limiter (12 requests per 60 seconds)
            let rate_limiter = TradeRateLimiter::new();
            app.manage(rate_limiter);

            // Initialize OAuth state for tracking authentication flow
            let oauth_state = Mutex::new(OAuthState::new());
            app.manage(oauth_state);

            // Load application configuration
            let config = AppConfig::default();
            app.manage(config);

            // Log startup info in debug mode
            #[cfg(debug_assertions)]
            {
                log::info!("Path of Agent Desktop starting...");
                log::info!("Backend URL: {}", app.state::<AppConfig>().backend_url);
                log::info!("Remote API URL: {}", app.state::<AppConfig>().remote_api_url);
            }

            // Deep link handler for OAuth callbacks
            // TODO: Re-enable once we verify the Tauri deep-link API for v2
            // The frontend will listen for 'deep-link://new-url' events
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Register scheme handler (required for deep links to work)
                let _ = app.deep_link().register("pathofagent");
            }

            // Spawn backend sidecar (production only)
            let sidecar = spawn_backend_sidecar(app);
            app.manage(Mutex::new(sidecar));

            Ok(())
        })
        // Register IPC command handlers
        .invoke_handler(tauri::generate_handler![
            // GGG OAuth (desktop ↔ GGG directly, no server)
            commands::auth::start_ggg_oauth,
            commands::auth::exchange_ggg_oauth,
            commands::auth::cancel_ggg_oauth,
            // Session auth (email/password ↔ api.pathofagent.com)
            commands::auth::get_auth_status,
            commands::auth::logout,
            commands::auth::refresh_session,
            commands::auth::store_session_token,
            // Backend communication
            commands::backend::call_backend,
            commands::backend::import_build,
            commands::backend::get_analysis,
            // Trade API (direct from user's IP)
            commands::trade::search_trade,
            commands::trade::fetch_item_details,
            commands::trade::get_rate_limit_status,
            // Local cache
            commands::cache::store_build,
            commands::cache::get_cached_builds,
            commands::cache::clear_cache,
            // Configuration
            commands::config::get_config,
            commands::config::set_config,
            commands::config::set_session_token,
            commands::config::clear_session_token,
            commands::config::get_device_id,
            // Path of Building integration
            commands::pob::find_pob_installation,
            commands::pob::open_in_pob,
            // Session snapshot storage (file-based, replaces localStorage)
            commands::sessions::save_session_snapshot,
            commands::sessions::load_session_snapshots,
            commands::sessions::delete_session_snapshot,
            commands::sessions::clear_session_snapshots,
            commands::sessions::get_sessions_disk_usage,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle application exit to clean up the sidecar process tree.
            // The Job Object (Windows) handles this automatically when its handle drops,
            // but we also explicitly kill here for a clean shutdown with logging.
            if let tauri::RunEvent::Exit = event {
                let sidecar_state = app_handle.state::<Mutex<BackendSidecar>>();
                let lock_result = sidecar_state.lock();
                if let Ok(mut sidecar) = lock_result {
                    if let Some(mut child) = sidecar.child.take() {
                        let pid = child.id();
                        log::info!("Shutting down backend sidecar (PID: {})...", pid);

                        // On Windows, use taskkill /T to kill the entire process tree
                        // as a belt-and-suspenders approach alongside the Job Object.
                        #[cfg(windows)]
                        {
                            use std::os::windows::process::CommandExt;
                            let result = std::process::Command::new("taskkill")
                                .args(["/F", "/T", "/PID", &pid.to_string()])
                                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                                .output();
                            match result {
                                Ok(output) if output.status.success() => {
                                    log::info!("Process tree for PID {} killed via taskkill", pid);
                                }
                                Ok(output) => {
                                    log::warn!(
                                        "taskkill returned {}: {}",
                                        output.status,
                                        String::from_utf8_lossy(&output.stderr)
                                    );
                                }
                                Err(e) => {
                                    log::warn!("taskkill failed: {}, falling back to child.kill()", e);
                                    let _ = child.kill();
                                }
                            }
                        }

                        #[cfg(not(windows))]
                        {
                            match child.kill() {
                                Ok(_) => log::info!("Backend sidecar killed successfully"),
                                Err(e) => log::error!("Failed to kill backend sidecar: {}", e),
                            }
                        }
                    }

                    // Drop the Job Object handle — this is the primary kill mechanism on Windows.
                    // Any processes still alive in the job will be terminated.
                    #[cfg(windows)]
                    {
                        sidecar._job_handle.take();
                    }
                }
            }
        });
}
