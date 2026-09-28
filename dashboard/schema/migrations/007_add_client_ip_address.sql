-- M4: Client identity display pattern — `<name> | <IP>`
-- F2/F3: clients carry a client-reported LAN IP address, sent by the
-- Tauri sync service in the ingest payload (its probed LAN address, the
-- same value shown in the desktop app header). Nullable: clients that
-- registered before this column (or whose client cannot probe an
-- address) keep NULL and simply render without the IP segment.
ALTER TABLE clients ADD COLUMN ip_address TEXT;
