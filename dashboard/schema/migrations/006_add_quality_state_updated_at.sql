-- Migration 006: Add quality_state_updated_at to monitors
-- M1-T10: Backend quality classifier — F12
--
-- Adds quality_state_updated_at column to track when the last
-- classification was computed.
-- Migrate existing interim quality_state values to F12 equivalents.

ALTER TABLE monitors ADD COLUMN quality_state_updated_at INTEGER;

-- Migrate existing quality states to F12 equivalents
UPDATE monitors SET quality_state = 'disconnected' WHERE quality_state = 'warmingUp';
UPDATE monitors SET quality_state = 'veryHigh' WHERE quality_state = 'good';
UPDATE monitors SET quality_state = 'medium' WHERE quality_state = 'degraded';
UPDATE monitors SET quality_state = 'low' WHERE quality_state = 'poor';
