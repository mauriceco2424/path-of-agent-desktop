//! Trade API Direct Commands
//!
//! These commands make direct requests to the Path of Exile Trade API
//! from the user's IP address. This is a key architectural decision -
//! by making trade requests from the desktop app instead of the backend,
//! each user gets their own rate limit quota.
//!
//! Rate limiting: The Trade API allows ~12 requests per 60 seconds.
//! This module implements client-side rate limiting to avoid hitting 429 errors.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

/// Rate limiter state for Trade API requests
/// Allows 12 requests per 60 seconds (conservative estimate)
pub struct TradeRateLimiter {
    /// Timestamps of recent requests
    requests: Mutex<Vec<Instant>>,
    /// Maximum requests allowed in the window
    max_requests: usize,
    /// Time window for rate limiting
    window: Duration,
}

impl TradeRateLimiter {
    /// Create a new rate limiter with default Trade API limits
    pub fn new() -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
            max_requests: 12,
            window: Duration::from_secs(60),
        }
    }

    /// Check if a request can be made, and if so, record it
    /// Returns Ok(()) if allowed, Err with wait time if rate limited
    pub fn check_and_record(&self) -> Result<(), Duration> {
        let mut requests = self.requests.lock().unwrap();
        let now = Instant::now();

        // Remove requests outside the window
        requests.retain(|&t| now.duration_since(t) < self.window);

        if requests.len() >= self.max_requests {
            // Calculate how long until the oldest request expires
            if let Some(&oldest) = requests.first() {
                let elapsed = now.duration_since(oldest);
                let wait_time = self.window.saturating_sub(elapsed);
                return Err(wait_time);
            }
        }

        // Record this request
        requests.push(now);
        Ok(())
    }

    /// Get the number of remaining requests in the current window
    pub fn remaining(&self) -> usize {
        let requests = self.requests.lock().unwrap();
        let now = Instant::now();
        let active_count = requests
            .iter()
            .filter(|&&t| now.duration_since(t) < self.window)
            .count();
        self.max_requests.saturating_sub(active_count)
    }
}

impl Default for TradeRateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

/// Trade search query request
#[derive(Debug, Serialize, Deserialize)]
pub struct TradeQuery {
    pub league: String,
    pub query: serde_json::Value,
}

/// Trade search result from the API
#[derive(Debug, Serialize, Deserialize)]
pub struct TradeSearchResult {
    pub id: String,
    pub result: Vec<String>,
    pub total: u32,
}

/// Item detail result
#[derive(Debug, Serialize, Deserialize)]
pub struct ItemResult {
    pub result: Vec<serde_json::Value>,
}

/// Rate limit information from response headers
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub limit: Option<String>,
    pub remaining: Option<String>,
    pub retry_after: Option<u32>,
}

/// Search the Trade API directly from the user's IP
///
/// This solves the rate limiting problem by distributing requests
/// across all users rather than concentrating them on a single backend IP.
///
/// Includes client-side rate limiting to avoid 429 errors.
#[tauri::command]
pub async fn search_trade(
    query: TradeQuery,
    http_client: State<'_, reqwest::Client>,
    rate_limiter: State<'_, TradeRateLimiter>,
) -> Result<TradeSearchResult, String> {
    // Check client-side rate limit before making request
    if let Err(wait_time) = rate_limiter.check_and_record() {
        return Err(format!(
            "Rate limited. Please wait {} seconds before making another request.",
            wait_time.as_secs()
        ));
    }

    let url = format!(
        "https://www.pathofexile.com/api/trade/search/{}",
        query.league
    );

    let response = http_client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&query.query)
        .send()
        .await
        .map_err(|e| format!("Trade API request failed: {}", e))?;

    // Handle rate limiting
    if response.status() == 429 {
        let retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(60);

        return Err(format!(
            "Rate limited by Trade API. Please wait {} seconds and try again.",
            retry_after
        ));
    }

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Trade API error ({}): {}", status, error_text));
    }

    response
        .json::<TradeSearchResult>()
        .await
        .map_err(|e| format!("Failed to parse trade search response: {}", e))
}

/// Fetch detailed item information for trade results
///
/// Takes the result IDs from a search and retrieves full item data.
/// The Trade API limits fetches to 10 items at a time.
///
/// Includes client-side rate limiting to avoid 429 errors.
#[tauri::command]
pub async fn fetch_item_details(
    result_ids: Vec<String>,
    query_id: String,
    http_client: State<'_, reqwest::Client>,
    rate_limiter: State<'_, TradeRateLimiter>,
) -> Result<ItemResult, String> {
    if result_ids.is_empty() {
        return Ok(ItemResult { result: vec![] });
    }

    // Trade API limits to 10 items per request
    if result_ids.len() > 10 {
        return Err("Cannot fetch more than 10 items at once".to_string());
    }

    // Check client-side rate limit before making request
    if let Err(wait_time) = rate_limiter.check_and_record() {
        return Err(format!(
            "Rate limited. Please wait {} seconds before making another request.",
            wait_time.as_secs()
        ));
    }

    let ids = result_ids.join(",");
    let url = format!(
        "https://www.pathofexile.com/api/trade/fetch/{}?query={}",
        ids, query_id
    );

    let response = http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Trade API fetch failed: {}", e))?;

    // Handle rate limiting
    if response.status() == 429 {
        let retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(60);

        return Err(format!(
            "Rate limited by Trade API. Please wait {} seconds and try again.",
            retry_after
        ));
    }

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Trade API error ({}): {}", status, error_text));
    }

    response
        .json::<ItemResult>()
        .await
        .map_err(|e| format!("Failed to parse item details response: {}", e))
}

/// Rate limit status response
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitStatus {
    /// Number of requests remaining in the current window
    pub remaining: usize,
    /// Maximum requests allowed per window
    pub max_requests: usize,
    /// Window duration in seconds
    pub window_seconds: u64,
}

/// Get the current rate limit status
///
/// Useful for UI to show users how many requests they have remaining.
///
/// NOTE: This command is registered in lib.rs but not currently invoked from the frontend.
/// Keeping it available for future UI enhancements (e.g., rate limit indicator).
#[tauri::command]
pub async fn get_rate_limit_status(
    rate_limiter: State<'_, TradeRateLimiter>,
) -> Result<RateLimitStatus, String> {
    Ok(RateLimitStatus {
        remaining: rate_limiter.remaining(),
        max_requests: 12,
        window_seconds: 60,
    })
}
