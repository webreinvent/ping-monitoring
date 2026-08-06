use std::sync::Arc;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, RwLock};

use crate::domain::PingSample;
use crate::storage::Database;

/// Current status of the sync service.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncStatus {
    Off,
    Paused,
    Idle,
    Syncing,
    Success,
    Error,
}

/// Event emitted to the frontend whenever sync status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncEvent {
    pub status: SyncStatus,
    pub message: Option<String>,
    pub last_synced_at_ms: Option<i64>,
    pub pending_count: u32,
}

/// Result of a sync operation (returned to the frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub accepted: u32,
    pub duplicate: u32,
    pub rejected: u32,
}

/// Configuration for the sync service.
#[derive(Debug, Clone)]
pub struct SyncConfig {
    pub endpoint: String,
    pub batch_threshold: usize,
    pub batch_timeout_ms: u64,
    pub max_batch_size: usize,
    pub retry_attempts: u32,
    pub retry_base_delay_ms: u64,
    pub periodic_interval_min: u32,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            endpoint: String::new(),
            batch_threshold: 10,
            batch_timeout_ms: 5_000,
            max_batch_size: 1_000,
            retry_attempts: 3,
            retry_base_delay_ms: 1_000,
            periodic_interval_min: 5,
        }
    }
}

/// The JSON payload sent to the ingest endpoint.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IngestPayload {
    client_slug: String,
    username: String,
    hostname: String,
    mac_address: Option<String>,
    samples: Vec<IngestSample>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IngestSample {
    target_id: String,
    timestamp_ms: i64,
    latency_ms: Option<f64>,
    status: String,
    resolved_address: Option<String>,
    error: Option<String>,
}

impl From<&PingSample> for IngestSample {
    fn from(sample: &PingSample) -> Self {
        Self {
            target_id: sample.target_id.clone(),
            timestamp_ms: sample.timestamp_ms,
            latency_ms: sample.latency_ms,
            status: serde_json::to_string(&sample.status).unwrap_or_default(),
            resolved_address: sample.resolved_address.clone(),
            error: sample.error.clone(),
        }
    }
}

/// Client identity information cached on first discovery.
#[derive(Debug, Clone)]
struct ClientIdentity {
    slug: String,
    username: String,
    hostname: String,
    mac_address: Option<String>,
}

impl ClientIdentity {
    fn discover() -> Self {
        let username = whoami::username();
        let hostname = whoami::hostname();
        let mac_address = mac_address::get_mac_address()
            .ok()
            .and_then(|m| m)
            .map(|m| m.to_string());

        let slug = format!(
            "{}-{}-{}",
            username,
            hostname,
            mac_address
                .as_deref()
                .map(|mac| {
                    // Take last 5 chars of MAC as a short unique suffix
                    mac.chars().rev().take(5).collect::<String>().chars().rev().collect::<String>()
                })
                .unwrap_or_else(|| {
                    // Fallback: random-ish hex based on current time
                    format!("{:x}", std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis()
                        % 0xFFFFFF)
                })
        );

        Self {
            slug,
            username,
            hostname,
            mac_address,
        }
    }
}

/// Sync service that batches and POSTs ping samples to a cloud dashboard.
pub struct SyncService {
    database: Database,
    app: AppHandle,
    config: RwLock<Option<SyncConfig>>,
    identity: Mutex<Option<ClientIdentity>>,
    handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
    status: RwLock<SyncStatus>,
}

impl SyncService {
    pub fn new(database: Database, app: AppHandle) -> Self {
        Self {
            database,
            app,
            config: RwLock::new(None),
            identity: Mutex::new(None),
            handle: Mutex::new(None),
            status: RwLock::new(SyncStatus::Off),
        }
    }

    /// Cached client identity (discovered on first use).
    async fn get_identity(&self) -> ClientIdentity {
        let mut identity = self.identity.lock().await;
        if identity.is_none() {
            *identity = Some(ClientIdentity::discover());
        }
        identity.clone().expect("identity initialized above")
    }

    /// Emit a status change event to the frontend.
    async fn emit_status(&self, status: SyncStatus, message: Option<String>) {
        let pending_count = self.count_pending().await;
        *self.status.write().await = status;
        let event = SyncEvent {
            status,
            message,
            last_synced_at_ms: None,
            pending_count,
        };
        let _ = self.app.emit("sync-status-changed", &event);
    }

    /// Count unsynced samples in the database.
    async fn count_pending(&self) -> u32 {
        self.database.unsynced_samples(0).ok().map(|s| s.len() as u32).unwrap_or(0)
    }

    /// Start the sync background task with the given config.
    pub async fn start(&self, config: SyncConfig) {
        // Cancel any existing task
        self.stop().await;

        let status = *self.status.read().await;
        if status == SyncStatus::Paused || status == SyncStatus::Off {
            // Don't override paused/off state
            return;
        }

        *self.config.write().await = Some(config.clone());
        self.emit_status(SyncStatus::Idle, None).await;

        let database = self.database.clone();
        let app = self.app.clone();
        let endpoint = config.endpoint.clone();
        let batch_threshold = config.batch_threshold;
        let batch_timeout_ms = config.batch_timeout_ms;
        let max_batch_size = config.max_batch_size;
        let retry_attempts = config.retry_attempts;
        let retry_base_delay_ms = config.retry_base_delay_ms;
        let periodic_interval_min = config.periodic_interval_min;

        let handle = tokio::spawn(async move {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| Client::new());

            // Discover identity once
            let identity = ClientIdentity::discover();

            let mut last_flush_ms =
                std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64;

            loop {
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let elapsed_since_flush = now_ms.saturating_sub(last_flush_ms);

                // Check conditions: batch timeout fired or periodic sweep
                let should_flush = elapsed_since_flush >= batch_timeout_ms
                    || elapsed_since_flush >= periodic_interval_min as u64 * 60_000;

                if !should_flush {
                    // Wait a bit before checking again
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    continue;
                }

                // Get unsynced samples (last hour on batch timeout, all on periodic)
                let since_ms = if elapsed_since_flush >= periodic_interval_min as u64 * 60_000 {
                    0 // all unsynced
                } else {
                    (now_ms as i64) - 3_600_000 // last hour
                };

                let samples = match database.unsynced_samples(since_ms) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("sync: failed to query unsynced samples: {e}");
                        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                        continue;
                    }
                };

                if samples.is_empty() {
                    last_flush_ms = now_ms;
                    tokio::time::sleep(std::time::Duration::from_millis(batch_timeout_ms.min(10_000))).await;
                    continue;
                }

                let batch: Vec<IngestSample> = samples
                    .iter()
                    .take(max_batch_size)
                    .map(|s| s.into())
                    .collect();

                // Collect unique target_ids for marking synced later
                let target_ids: Vec<String> = samples.iter().map(|s| s.target_id.clone()).collect();
                let from_ms = batch.first().map(|s| s.timestamp_ms).unwrap_or(0);
                let to_ms = batch.last().map(|s| s.timestamp_ms).unwrap_or(0);

                let payload = IngestPayload {
                    client_slug: identity.slug.clone(),
                    username: identity.username.clone(),
                    hostname: identity.hostname.clone(),
                    mac_address: identity.mac_address.clone(),
                    samples: batch,
                };

                // Try to POST with retries
                let mut last_error = String::new();
                let mut success = false;
                let mut accepted = 0u32;
                let mut duplicate = 0u32;
                let mut rejected = 0u32;

                for attempt in 0..retry_attempts {
                    if attempt > 0 {
                        let delay_ms = retry_base_delay_ms * 2_u64.pow(attempt - 1);
                        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    }

                    let body = match serde_json::to_string(&payload) {
                        Ok(b) => b,
                        Err(e) => {
                            eprintln!("sync: failed to serialize payload: {e}");
                            continue;
                        }
                    };

                    match client.post(&endpoint).header("Content-Type", "application/json").body(body.clone()).send().await {
                        Ok(response) => {
                            let status = response.status();
                            if status.is_success() {
                                // Parse response for counts
                                if let Ok(result) = response.json::<SyncResult>().await {
                                    accepted = result.accepted;
                                    duplicate = result.duplicate;
                                    rejected = result.rejected;
                                }

                                // Mark samples as synced
                                let synced_at = now_ms as i64;
                                let target_ids_for_mark: Vec<String> = target_ids.iter()
                                    .take(max_batch_size)
                                    .cloned()
                                    .collect::<std::collections::HashSet<_>>()
                                    .into_iter()
                                    .collect();
                                if let Err(e) = database.mark_samples_synced(&target_ids_for_mark, from_ms, to_ms, synced_at) {
                                    eprintln!("sync: failed to mark samples synced: {e}");
                                }

                                // Emit success event
                                let event = SyncEvent {
                                    status: SyncStatus::Success,
                                    message: None,
                                    last_synced_at_ms: Some(synced_at),
                                    pending_count: 0,
                                };
                                let _ = app.emit("sync-status-changed", &event);

                                success = true;
                                last_flush_ms = now_ms;
                                break;
                            } else {
                                last_error = format!("HTTP {}", status);
                            }
                        }
                        Err(e) => {
                            last_error = format!("{e}");
                        }
                    }
                }

                if !success {
                    // Emit error event
                    let message = if retry_attempts > 1 {
                        format!("Retry exhausted after {retry_attempts} attempts: {last_error}")
                    } else {
                        last_error.clone()
                    };
                    let pending = database.unsynced_samples(0).ok().map(|s| s.len() as u32).unwrap_or(0);
                    let event = SyncEvent {
                        status: SyncStatus::Error,
                        message: Some(message),
                        last_synced_at_ms: None,
                        pending_count: pending,
                    };
                    let _ = app.emit("sync-status-changed", &event);
                    last_flush_ms = now_ms;
                }

                // Wait before next cycle
                tokio::time::sleep(std::time::Duration::from_millis(
                    batch_timeout_ms.min(10_000),
                ))
                .await;
            }
        });

        *self.handle.lock().await = Some(handle);
    }

    /// Stop the background sync task.
    pub async fn stop(&self) {
        if let Some(handle) = self.handle.lock().await.take() {
            handle.abort();
        }
    }

    /// Trigger an immediate sync (for the "Sync now" button).
    pub async fn trigger_now(&self) -> Result<SyncResult, String> {
        let config = self.config.read().await;
        let config = config.as_ref().ok_or_else(|| "Sync is not configured".to_string())?;

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let identity = self.get_identity().await;

        // Get all unsynced samples
        let samples = self
            .database
            .unsynced_samples(0)
            .map_err(|e| e.to_string())?;

        if samples.is_empty() {
            return Ok(SyncResult {
                accepted: 0,
                duplicate: 0,
                rejected: 0,
            });
        }

        // Emit syncing status
        let pending = samples.len() as u32;
        let event = SyncEvent {
            status: SyncStatus::Syncing,
            message: None,
            last_synced_at_ms: None,
            pending_count: pending,
        };
        let _ = self.app.emit("sync-status-changed", &event);

        let batch: Vec<IngestSample> = samples
            .iter()
            .take(config.max_batch_size)
            .map(|s| s.into())
            .collect();

        let payload = IngestPayload {
            client_slug: identity.slug,
            username: identity.username,
            hostname: identity.hostname,
            mac_address: identity.mac_address,
            samples: batch,
        };

        let body = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

        let response = client
            .post(&config.endpoint)
            .header("Content-Type", "application/json")
            .body(body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {e}"))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }

        let result = response
            .json::<SyncResult>()
            .await
            .unwrap_or(SyncResult {
                accepted: batch.len() as u32,
                duplicate: 0,
                rejected: 0,
            });

        // Mark samples as synced
        let now_ms = crate::domain::unix_time_ms();
        let target_ids: Vec<String> = batch.iter().map(|s| s.target_id.clone()).collect();
        let unique_ids: Vec<String> = target_ids
            .into_iter()
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        let from_ms = batch.first().map(|s| s.timestamp_ms).unwrap_or(0);
        let to_ms = batch.last().map(|s| s.timestamp_ms).unwrap_or(0);
        let _ = self.database.mark_samples_synced(&unique_ids, from_ms, to_ms, now_ms);

        // Emit success
        let event = SyncEvent {
            status: SyncStatus::Success,
            message: None,
            last_synced_at_ms: Some(now_ms),
            pending_count: 0,
        };
        let _ = self.app.emit("sync-status-changed", &event);

        Ok(result)
    }

    /// Get current sync status.
    pub async fn status(&self) -> SyncEvent {
        let status = *self.status.read().await;
        let pending = self.count_pending().await;
        SyncEvent {
            status,
            message: None,
            last_synced_at_ms: None,
            pending,
        }
    }

    /// Apply settings to the sync service. Spawns or cancels the background task as needed.
    pub async fn apply_settings(&self, settings: &crate::domain::AppSettings) {
        match (&settings.dashboard_ingest_url, settings.cloud_sync_paused) {
            (Some(url), false) if !url.is_empty() => {
                let mut config = self.config.write().await;
                let config = config.get_or_insert_with(SyncConfig::default);
                config.endpoint = url.clone();
                config.periodic_interval_min = settings.sync_interval_min;
                self.emit_status(SyncStatus::Idle, None).await;

                // Re-read config to start with latest
                let config = self.config.read().await.clone().unwrap_or_default();
                self.start(config).await;
            }
            (Some(_), true) => {
                self.stop().await;
                self.emit_status(SyncStatus::Paused, None).await;
            }
            _ => {
                // No URL or empty URL -> stop
                self.stop().await;
                *self.config.write().await = None;
                self.emit_status(SyncStatus::Off, None).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_identity_discovery() {
        let identity = ClientIdentity::discover();
        assert!(!identity.username.is_empty());
        assert!(!identity.hostname.is_empty());
        assert!(!identity.slug.is_empty());
        assert!(identity.slug.contains(&identity.username));
    }

    #[test]
    fn sync_result_serialization() {
        let result = SyncResult {
            accepted: 10,
            duplicate: 2,
            rejected: 1,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("accepted"));
        assert!(json.contains("10"));
    }

    #[test]
    fn sync_status_serialization() {
        for status in [
            SyncStatus::Off,
            SyncStatus::Paused,
            SyncStatus::Idle,
            SyncStatus::Syncing,
            SyncStatus::Success,
            SyncStatus::Error,
        ] {
            let json = serde_json::to_string(&status).unwrap();
            assert!(!json.is_empty());
        }
    }
}
