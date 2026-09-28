use std::{
    net::IpAddr,
    process::Stdio,
    sync::Arc,
    time::Duration,
};

use async_trait::async_trait;
use regex::Regex;
use tokio::{net::lookup_host, process::Command};

use crate::domain::{AddressFamily, PingSample, ProbeStatus, Target, unix_time_ms};

#[async_trait]
pub trait PingProbe: Send + Sync {
    async fn probe(&self, target: &Target) -> PingSample;
}

/// `SystemPingProbe` shells out to the OS's `ping` binary instead of opening
/// an ICMP socket from Rust.
///
/// Why this exists: `surge-ping` (the prior implementation) could not send
/// ICMP on macOS or Windows without elevated privileges. Apple's kernel
/// does not expose the Linux-style `SOCK_DGRAM + IPPROTO_ICMP` interface
/// to unprivileged users, and Windows requires admin for raw ICMP. The
/// OS's `/sbin/ping` binary is setuid/setpriv on every platform, so
/// shelling out gets us unprivileged ICMP "for free" on macOS, Windows,
/// and Linux — no platform-specific socket code, no privilege escalation.
///
/// Trade-off: each probe pays a fork+exec cost (~50-100ms). At a 1s
/// interval with ~10 targets this is well under 1% of one CPU core.
pub struct SystemPingProbe {
    /// `true` when the host is macOS / Linux / BSD. `false` on Windows.
    unix: bool,
}

impl SystemPingProbe {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            unix: cfg!(target_family = "unix"),
        })
    }

    async fn resolve(&self, target: &Target) -> Result<IpAddr, String> {
        if let Ok(address) = target.host.parse::<IpAddr>() {
            if family_matches(address, target.address_family) {
                return Ok(address);
            }
            return Err("The IP address does not match the selected address family".into());
        }

        let addresses = lookup_host((target.host.as_str(), 0))
            .await
            .map_err(|error| error.to_string())?;
        addresses
            .map(|address| address.ip())
            .find(|address| family_matches(*address, target.address_family))
            .ok_or_else(|| "No matching IP address was returned by DNS".into())
    }
}

#[async_trait]
impl PingProbe for SystemPingProbe {
    async fn probe(&self, target: &Target) -> PingSample {
        let timestamp_ms = unix_time_ms();

        let address = match self.resolve(target).await {
            Ok(address) => address,
            Err(error) => {
                let mut sample =
                    PingSample::failure(target.id.clone(), timestamp_ms, ProbeStatus::DnsError);
                sample.error = Some(error);
                return sample;
            }
        };

        // CLI flags per platform — `ping` differs significantly:
        //   macOS / Linux:  ping -c 1 -W <ms/1000, min 1> <ip>
        //   Windows:        ping -n 1 -w <ms> <ip>
        // `-c 1` / `-n 1` mean "send exactly one echo" — we don't need more.
        // `-W` / `-w` are per-request timeouts in seconds (Unix) / ms (Windows).
        let mut command = if self.unix {
            let timeout_seconds = ((target.timeout_ms + 999) / 1000).max(1);
            let mut command = Command::new("ping");
            command
                .arg("-c")
                .arg("1")
                .arg("-W")
                .arg(timeout_seconds.to_string())
                .arg(address.to_string())
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true);
            command
        } else {
            let mut command = Command::new("ping");
            command
                .arg("-n")
                .arg("1")
                .arg("-w")
                .arg(target.timeout_ms.to_string())
                .arg(address.to_string())
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .kill_on_drop(true);
            command
        };

        // Enforce a hard wall-clock cap so a misbehaving `ping` (e.g. the
        // OS binary hangs longer than the per-request `-W`/`-w` value)
        // can never wedge the monitor loop. We give the binary an extra
        // 500ms grace beyond the user-configured timeout.
        let timeout = Duration::from_millis(target.timeout_ms + 500);

        let child = match command.spawn() {
            Ok(child) => child,
            Err(error) => {
                let mut sample = PingSample::failure(
                    target.id.clone(),
                    timestamp_ms,
                    classify_spawn_error(&error),
                );
                sample.resolved_address = Some(address.to_string());
                sample.error = Some(format!("failed to spawn ping: {error}"));
                return sample;
            }
        };

        let output = match tokio::time::timeout(timeout, child.wait_with_output()).await {
            Ok(Ok(output)) => output,
            Ok(Err(error)) => {
                let mut sample = PingSample::failure(
                    target.id.clone(),
                    timestamp_ms,
                    ProbeStatus::Error,
                );
                sample.resolved_address = Some(address.to_string());
                sample.error = Some(format!("ping wait failed: {error}"));
                return sample;
            }
            Err(_elapsed) => {
                // Hard timeout: the OS binary didn't honor the per-request
                // timeout (rare, but observed on busy systems). Treat as
                // Timeout — the dashboard already knows how to render it.
                let mut sample = PingSample::failure(
                    target.id.clone(),
                    timestamp_ms,
                    ProbeStatus::Timeout,
                );
                sample.resolved_address = Some(address.to_string());
                sample.error = Some(format!(
                    "ping exceeded hard timeout of {} ms",
                    timeout.as_millis()
                ));
                return sample;
            }
        };

        parse_ping_output(&output.stdout, target, timestamp_ms, address)
    }
}

/// Build a `PingSample` from the captured `ping` output. The OS binaries
/// differ in their stdout format:
///   * Windows always prints a per-reply line:  `Reply from … time=12ms`
///   * macOS / Linux print a per-reply line (`time=12.3 ms`) **only when
///     stdout is a TTY**. When the probe pipes stdout (it always does),
///     macOS / Linux omit that line and only print a summary:
///       `round-trip min/avg/max/stddev = 51.113/51.113/51.113/nan ms`
///
/// So we try two sources of latency, in order:
///   1. the per-reply `time=` / `time<` token (Windows, and Unix TTY), and
///   2. the Unix `min/avg/max` summary line — using **avg** as the latency.
///
/// A sample is Success iff a latency could be extracted AND the host
/// actually received at least one reply (i.e. not 100% loss). Otherwise we
/// map the output to Timeout / Unreachable / Error.
fn parse_ping_output(
    stdout: &[u8],
    target: &Target,
    timestamp_ms: i64,
    address: IpAddr,
) -> PingSample {
    let text = match std::str::from_utf8(stdout) {
        Ok(decoded) => decoded.to_string(),
        // Non-UTF-8 stdout is a sign something is very wrong; fall back to
        // lossy conversion so we still get a readable error string.
        Err(_) => String::from_utf8_lossy(stdout).into_owned(),
    };

    // Source 1: per-reply `time=12.3`, `time<1`, `time=12`.
    let per_reply_ms = TIME_REGEX
        .captures(&text)
        .and_then(|captures| {
            captures.get(1).and_then(|m| m.as_str().parse::<f64>().ok())
        })
        .map(|n| n.max(0.0));

    // Source 2 (Unix): `round-trip min/avg/max[/stddev] = X/Y/Z ms` — take
    // the **avg** (second) value. On a single-packet probe min == avg == max.
    let summary_avg_ms = SUMMARY_REGEX
        .captures(&text)
        .and_then(|captures| {
            captures.get(2).and_then(|m| m.as_str().parse::<f64>().ok())
        })
        .map(|n| n.max(0.0));

    let latency_ms = per_reply_ms.or(summary_avg_ms);

    if let Some(latency) = latency_ms {
        // A latency value means at least one reply arrived. Trust it.
        return PingSample {
            target_id: target.id.clone(),
            timestamp_ms,
            latency_ms: Some(latency),
            status: ProbeStatus::Success,
            resolved_address: Some(address.to_string()),
            error: None,
        };
    }

    // No latency could be extracted. Distinguish timeout from unreachable
    // by scanning the (possibly partial) output for known phrases.
    let lower = text.to_ascii_lowercase();
    let status = if is_total_loss(&lower) || lower.contains("request timed out") {
        ProbeStatus::Timeout
    } else if lower.contains("host unreachable")
        || lower.contains("network is unreachable")
        || lower.contains("destination host unreachable")
        || lower.contains("destination net unreachable")
        || lower.contains("name or service not known")
        || lower.contains("unknown host")
    {
        ProbeStatus::Unreachable
    } else {
        ProbeStatus::Error
    };

    let mut sample = PingSample::failure(target.id.clone(), timestamp_ms, status);
    sample.resolved_address = Some(address.to_string());
    sample.error = Some(truncate(&text, 512));
    sample
}

/// Match the per-reply `time=` / `time<` token (Windows, and Unix when the
/// stdout is a TTY). Group 1 is the numeric latency in ms.
static TIME_REGEX: std::sync::LazyLock<Regex> =
    std::sync::LazyLock::new(|| Regex::new(r"time[<=](\d+(?:\.\d+)?)").expect("valid regex"));

/// Match "total loss" phrasings, tolerant of the decimal the OSes print:
///   * macOS / Linux:  `100.0% packet loss`  (also `100% loss`, `100% packets`)
///   * any platform:   `0 packets received`  /  `0 received`
/// (case-insensitive; the caller lower-cases the input)
static LOSS_REGEX: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"(?:100(?:\.\d+)?%\s*(?:packet\s*)?loss|0\s+packets\s+received|0\s+received)")
        .expect("valid regex")
});

/// `true` when the (lower-cased) output indicates the host sent no reply at
/// all — i.e. total packet loss. Used to classify a no-latency result as
/// `Timeout` (host reachable-ish but not answering) rather than a generic
/// `Error`.
fn is_total_loss(lower: &str) -> bool {
    LOSS_REGEX.is_match(lower)
}

/// Match the Unix summary line
/// `round-trip min/avg/max/stddev = 51.113/51.113/51.113/nan ms`
/// (or the Linux variant without the `stddev` label). Group 1 is `min`,
/// group 2 is `avg`. We report `avg` as the latency — for a single-packet
/// probe (`-c 1`) all three are equal, and `avg` is the semantically
/// correct value for repeated probes.
///
/// `min` / `avg` / `max` are each either a number or `nan` (macOS prints
/// `nan` for `stddev` when only one packet was sent). We allow `nan` in
/// any position so the regex still matches; the `avg` capture is a real
/// number whenever at least one reply arrived.
static SUMMARY_REGEX: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"(?:round-trip|round trip)[^\n]*?(\d+(?:\.\d+)|nan)\s*/\s*(\d+(?:\.\d+)|nan)\s*/\s*(\d+(?:\.\d+)|nan)")
        .expect("valid regex")
});

fn family_matches(address: IpAddr, family: AddressFamily) -> bool {
    match family {
        AddressFamily::Auto => true,
        AddressFamily::Ipv4 => address.is_ipv4(),
        AddressFamily::Ipv6 => address.is_ipv6(),
    }
}

fn classify_spawn_error(error: &std::io::Error) -> ProbeStatus {
    match error.kind() {
        std::io::ErrorKind::NotFound => ProbeStatus::Error,
        std::io::ErrorKind::PermissionDenied => ProbeStatus::PermissionDenied,
        _ => ProbeStatus::Error,
    }
}

/// Truncate `text` to at most `max` **bytes**, on a character boundary.
///
/// A naive `text[..max]` panics if `max` splits a multi-byte UTF-8 character
/// (which happens on localized or non-ASCII `ping` output). We walk back to
/// the nearest valid char boundary instead. The ellipsis may push the result
/// to `max + 3` bytes; callers that hard-cap at `max` should account for it
/// (the DB column is wide enough that the 3-byte overshoot is harmless here).
fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    // Find the largest char boundary <= max.
    let boundary = (0..=max)
        .rev()
        .find(|&i| text.is_char_boundary(i))
        .expect("byte 0 is always a char boundary");
    let mut truncated = text[..boundary].to_string();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_addresses_by_family() {
        assert!(family_matches(
            "1.1.1.1".parse().unwrap(),
            AddressFamily::Auto
        ));
        assert!(family_matches(
            "1.1.1.1".parse().unwrap(),
            AddressFamily::Ipv4
        ));
        assert!(!family_matches(
            "1.1.1.1".parse().unwrap(),
            AddressFamily::Ipv6
        ));
        assert!(family_matches("::1".parse().unwrap(), AddressFamily::Ipv6));
    }

    #[test]
    fn parses_unix_style_time_token() {
        let target = Target::new("Loopback", "127.0.0.1");
        let stdout = b"64 bytes from 127.0.0.1: icmp_seq=1 ttl=64 time=0.052 ms\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "127.0.0.1".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Success);
        assert!(sample.latency_ms.is_some());
        let latency = sample.latency_ms.unwrap();
        assert!((latency - 0.052).abs() < 0.001, "latency={latency}");
    }

    #[test]
    fn parses_windows_style_time_token() {
        let target = Target::new("Loopback", "127.0.0.1");
        let stdout = b"\r\nReply from 127.0.0.1: bytes=32 time=12ms TTL=64\r\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "127.0.0.1".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Success);
        assert_eq!(sample.latency_ms, Some(12.0));
    }

    #[test]
    fn parses_unix_sub_millisecond_time_token() {
        let target = Target::new("Loopback", "127.0.0.1");
        let stdout = b"64 bytes from 127.0.0.1: time<1 ms\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "127.0.0.1".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Success);
        // Some platforms print `time<1` meaning "less than 1 ms". The regex
        // captures the integer; we accept it as the latency floor.
        assert_eq!(sample.latency_ms, Some(1.0));
    }

    #[test]
    fn parses_unix_piped_summary_line_without_time_token() {
        // This is the EXACT output macOS `ping` produces when stdout is
        // piped (no TTY): there is NO per-reply `time=` line, only the
        // summary. This was the real-world failure — the probe recorded
        // `Error` for a successful ping. Regression test for the fix.
        let target = Target::new("Gateway", "10.10.0.9");
        let stdout = b"PING 10.10.0.9 (10.10.0.9): 56 data bytes\n\n--- 10.10.0.9 ping statistics ---\n1 packets transmitted, 1 packets received, 0.0% packet loss, 1 packets out of wait time\nround-trip min/avg/max/stddev = 51.113/51.113/51.113/nan ms\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.10.0.9".parse().unwrap(),
        );
        assert_eq!(
            sample.status,
            ProbeStatus::Success,
            "piped macOS summary must be a Success; got {:?} error={:?}",
            sample.status, sample.error
        );
        let latency = sample.latency_ms.expect("latency on success");
        assert!(
            (latency - 51.113).abs() < 0.001,
            "latency should be the avg from the summary; got {latency}"
        );
    }

    #[test]
    fn per_reply_time_token_takes_priority_over_summary() {
        // When BOTH a `time=` line and a summary are present (Unix TTY),
        // the per-reply value must win — it's the authoritative RTT for
        // that specific probe.
        let target = Target::new("Gateway", "10.10.0.9");
        let stdout = b"64 bytes from 10.10.0.9: icmp_seq=1 ttl=64 time=12.3 ms\n--- 10.10.0.9 ping statistics ---\n1 packets transmitted, 1 packets received, 0.0% packet loss\nround-trip min/avg/max/stddev = 12.3/12.3/12.3/0.0 ms\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.10.0.9".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Success);
        assert_eq!(sample.latency_ms, Some(12.3));
    }

    #[test]
    fn detects_100_percent_packet_loss_as_timeout() {
        let target = Target::new("Down", "10.0.0.99");
        // Linux-style phrasing (no decimal).
        let stdout = b"--- 10.0.0.99 ping statistics ---\n5 packets transmitted, 0 received, 100% packet loss\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.0.0.99".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Timeout);
        assert!(sample.latency_ms.is_none());
        assert!(sample.error.is_some());
    }

    #[test]
    fn detects_macos_decimal_packet_loss_as_timeout() {
        let target = Target::new("Down", "10.0.0.99");
        // macOS prints `100.0%` (with the `.0`) — the old literal `100%`
        // substring check missed this and misclassified it as `Error`.
        let stdout =
            b"PING 10.0.0.99: 56 data bytes\n\n--- 10.0.0.99 ping statistics ---\n1 packets transmitted, 0 packets received, 100.0% packet loss\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.0.0.99".parse().unwrap(),
        );
        assert_eq!(
            sample.status,
            ProbeStatus::Timeout,
            "macOS decimal loss must be Timeout; got {:?}",
            sample.status
        );
    }

    #[test]
    fn detects_zero_received_as_timeout() {
        let target = Target::new("Down", "10.0.0.99");
        // A host that replies never: `0 packets received` — classify as
        // Timeout even if the loss % line is absent or formatted oddly.
        let stdout = b"--- 10.0.0.99 ping statistics ---\n1 packets transmitted, 0 packets received\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.0.0.99".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Timeout);
    }

    #[test]
    fn detects_unreachable_host_as_unreachable() {
        let target = Target::new("Down", "10.0.0.99");
        let stdout = b"From 10.0.0.1 icmp_seq=1 Destination host unreachable\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.0.0.99".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Unreachable);
    }

    #[test]
    fn unknown_output_falls_back_to_error() {
        let target = Target::new("Mystery", "10.0.0.99");
        let stdout = b"some unrelated garbage\n";
        let sample = parse_ping_output(
            stdout,
            &target,
            unix_time_ms(),
            "10.0.0.99".parse().unwrap(),
        );
        assert_eq!(sample.status, ProbeStatus::Error);
        assert!(sample.latency_ms.is_none());
    }

    #[test]
    fn truncate_does_not_panic_on_multibyte_boundary() {
        // 500 'a's followed by a single 'é' (2 bytes). Truncating to 501
        // bytes would land in the middle of the 'é' — the old byte-slice
        // implementation panicked here.
        let mut text = String::new();
        for _ in 0..500 {
            text.push('a');
        }
        text.push('é');
        let out = truncate(&text, 501);
        assert!(out.len() <= 501 + 3, "result={:?}", out.len());
        assert!(out.ends_with('…'));
        // 600-char string truncated to 512: also safe.
        let long = "héllo".repeat(200);
        let out2 = truncate(&long, 512);
        assert!(out2.len() <= 512 + 3);
    }

    /// Live integration test: actually spawn the OS `ping` binary against
    /// loopback. This is the whole point of `SystemPingProbe` — if the
    /// platform's `ping` is reachable, the probe returns Success. If the
    /// binary is missing or denied, the probe returns an error status.
    /// Tagged `#[ignore]` so unit-test runs (which may run in sandboxes
    /// without network access) don't fail; opt in with
    /// `cargo test -- --ignored`.
    #[tokio::test]
    #[ignore = "requires network access and the platform ping binary"]
    async fn live_probe_loopback_succeeds() {
        let probe = SystemPingProbe::new();
        let target = Target::new("Loopback", "127.0.0.1");
        let sample = probe.probe(&target).await;
        assert_eq!(
            sample.status,
            ProbeStatus::Success,
            "loopback ping should succeed; got {:?} error={:?}",
            sample.status,
            sample.error
        );
        let latency = sample.latency_ms.expect("latency on success");
        assert!(latency >= 0.0, "latency must be non-negative, got {latency}");
        assert_eq!(
            sample.resolved_address.as_deref(),
            Some("127.0.0.1"),
            "resolved_address should match the IP literal"
        );
    }
}
