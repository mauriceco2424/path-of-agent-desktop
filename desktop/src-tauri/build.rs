use std::path::PathBuf;

fn main() {
    // Forward GGG OAuth credentials from build-time env to rustc so auth.rs's
    // option_env!() captures them. cargo:rustc-env makes the value a proper
    // crate-level dependency: when the env changes, the crate recompiles
    // automatically without needing `cargo clean`. Empty when unset, in which
    // case option_env! returns None and auth.rs falls back to dev-time lookup.
    println!("cargo:rerun-if-env-changed=GGG_OAUTH_CLIENT_ID");
    println!("cargo:rerun-if-env-changed=GGG_OAUTH_CLIENT_SECRET");
    let ggg_client_id = std::env::var("GGG_OAUTH_CLIENT_ID").unwrap_or_default();
    let ggg_client_secret = std::env::var("GGG_OAUTH_CLIENT_SECRET").unwrap_or_default();
    println!("cargo:rustc-env=GGG_OAUTH_CLIENT_ID={}", ggg_client_id);
    println!("cargo:rustc-env=GGG_OAUTH_CLIENT_SECRET={}", ggg_client_secret);

    // Ensure the sidecar binary placeholder exists for development builds.
    // In production, the real binary is placed here by the build pipeline
    // (scripts/prepare-desktop-bundle.ps1 or CI).
    //
    // tauri-build validates that all externalBin entries exist at compile time,
    // so we create a stub if the real binary hasn't been placed yet.
    let target_triple = std::env::var("TAURI_ENV_TARGET_TRIPLE")
        .or_else(|_| std::env::var("TARGET"))
        .unwrap_or_else(|_| "x86_64-pc-windows-msvc".to_string());

    let ext = if target_triple.contains("windows") {
        ".exe"
    } else {
        ""
    };

    let sidecar_name = format!("poa-backend-{}{}", target_triple, ext);
    let sidecar_path = PathBuf::from("binaries").join(&sidecar_name);

    if !sidecar_path.exists() {
        std::fs::create_dir_all("binaries").ok();
        // Write a minimal stub file. In dev mode the sidecar is never spawned
        // (#[cfg(debug_assertions)] guard), so the content doesn't matter --
        // it only needs to exist to satisfy tauri-build's validation.
        std::fs::write(&sidecar_path, b"SIDECAR_STUB").ok();
        println!(
            "cargo:warning=Created sidecar stub at {}. Replace with real binary for production builds.",
            sidecar_path.display()
        );
    }

    // Also ensure the resources/pob directory exists for the resource bundle config.
    // In production, the PoB bundle is placed here by prepare-pob-bundle.ps1.
    let pob_resource_dir = PathBuf::from("resources").join("pob");
    if !pob_resource_dir.exists() {
        std::fs::create_dir_all(&pob_resource_dir).ok();
        // Create a placeholder so the resource glob doesn't fail
        std::fs::write(pob_resource_dir.join(".gitkeep"), b"").ok();
        println!(
            "cargo:warning=Created PoB resources stub at {}. Run prepare-pob-bundle.ps1 for production.",
            pob_resource_dir.display()
        );
    }

    tauri_build::build()
}
