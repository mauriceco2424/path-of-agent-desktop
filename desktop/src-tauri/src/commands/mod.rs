//! IPC Command Modules
//!
//! This module exports all Tauri command handlers for frontend communication.
//! Commands are organized by domain:
//! - `auth`: OAuth authentication flow coordination
//! - `backend`: Communication with Path of Agent backend server
//! - `cache`: Local build and data caching
//! - `config`: Application configuration management
//! - `pob`: Path of Building integration (find and launch PoB)
//! - `sessions`: Analysis session snapshot storage (file-based, replaces localStorage)
//! - `trade`: Direct Trade API calls (from user's IP for rate limiting)

pub mod auth;
pub mod backend;
pub mod cache;
pub mod config;
pub mod pob;
pub mod sessions;
pub mod trade;

// Re-export types needed by lib.rs
pub use auth::OAuthState;
pub use config::DesktopAppConfig;
pub use trade::TradeRateLimiter;
