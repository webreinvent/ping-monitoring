//! Host identity discovery for the sidebar footer.
//!
//! Best effort by design: the hostname falls back to `"unknown"` and the
//! local-address probe silently returns `None` when nothing usable is found.
//! Discovery never blocks startup or user interaction.

use std::net::{IpAddr, SocketAddr, UdpSocket};

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostIdentity {
    pub username: String,
    pub hostname: String,
    pub ip_address: Option<String>,
}

/// Discover this machine's identity (username + hostname + best-effort LAN address).
pub fn discover() -> HostIdentity {
    HostIdentity {
        username: whoami::username(),
        hostname: whoami::fallible::hostname().unwrap_or_else(|_| String::from("unknown")),
        ip_address: probe_lan_address().map(|address| address.to_string()),
    }
}

/// Probe candidate local addresses via the UDP-connect trick.
///
/// `UdpSocket::connect` sends no packets — it only selects the local
/// interface, so no traffic reaches the public endpoints used below.
pub(crate) fn probe_lan_address() -> Option<IpAddr> {
    let mut candidates: Vec<IpAddr> = Vec::new();

    // IPv4 candidate: toward a public IPv4 endpoint.
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        let _ = socket.connect(SocketAddr::from(([8, 8, 8, 8], 80)));
        if let Ok(address) = socket.local_addr() {
            candidates.push(address.ip());
        }
    }

    // IPv6 candidate: toward a public IPv6 endpoint.
    if let Ok(socket) = UdpSocket::bind("[::]:0") {
        let _ = socket.connect(SocketAddr::from((
            [0x2001, 0x4860, 0x4860, 0, 0, 0, 0, 0x8888],
            80,
        )));
        if let Ok(address) = socket.local_addr() {
            candidates.push(address.ip());
        }
    }

    usable_address(&candidates)
}

/// First usable candidate (v4-first by probe order); `None` when all are unusable.
fn usable_address(candidates: &[IpAddr]) -> Option<IpAddr> {
    candidates
        .iter()
        .find(|address| is_usable(address))
        .copied()
}

/// Drop loopback, unspecified, multicast, link-local, and IPv4-mapped addresses.
fn is_usable(address: &IpAddr) -> bool {
    match address {
        IpAddr::V4(v4) => {
            !v4.is_loopback()
                && !v4.is_unspecified()
                && !v4.is_multicast()
                && !v4.is_link_local()
                && v4.octets()[0] != 0
        }
        IpAddr::V6(v6) => {
            let segs = v6.segments();
            !v6.is_loopback()
                && !v6.is_unspecified()
                && !v6.is_multicast()
                && !v6.is_unicast_link_local()
                // Embedded-IPv4 forms (mapped `::ffff:a.b.c.d`, compatible
                // `::a.b.c.d`, translated `::a00:a.b.c.d`) are not routable
                // LAN addresses.
                && !(segs[..5].iter().all(|&segment| segment == 0)
                    && (segs[5] == 0xffff || segs[5] == 0))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    #[test]
    fn prefers_lan_ipv4_over_unusable_candidates() {
        let candidates = vec![
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(192, 168, 1, 42)),
            IpAddr::V6(Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 1)),
        ];
        assert_eq!(
            usable_address(&candidates),
            Some(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 42)))
        );
    }

    #[test]
    fn drops_all_unusable_candidates() {
        let candidates = vec![
            IpAddr::V4(Ipv4Addr::new(0, 1, 2, 3)),
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(169, 254, 1, 2)),
            IpAddr::V4(Ipv4Addr::new(224, 0, 0, 1)),
            IpAddr::V6(Ipv6Addr::LOCALHOST),
            IpAddr::V6(Ipv6Addr::UNSPECIFIED),
            IpAddr::V6(Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 1)),
            // IPv4-mapped (::ffff:10.10.1.1)
            IpAddr::V6(Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0x0a0a, 0x0101)),
        ];
        assert_eq!(usable_address(&candidates), None);
    }

    #[test]
    fn empty_candidates_yield_none() {
        let candidates: Vec<IpAddr> = Vec::new();
        assert_eq!(usable_address(&candidates), None);
    }

    #[test]
    fn first_usable_in_probe_order_wins() {
        let candidates = vec![
            IpAddr::V6(Ipv6Addr::new(0x2605, 0, 0, 0, 0, 0, 0, 1)),
            IpAddr::V4(Ipv4Addr::new(10, 0, 0, 5)),
        ];
        assert_eq!(
            usable_address(&candidates),
            Some(IpAddr::V6(Ipv6Addr::new(0x2605, 0, 0, 0, 0, 0, 0, 1)))
        );
    }
}
