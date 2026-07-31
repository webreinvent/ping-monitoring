---
taskId: M1-T10
milestone: M1
title: Implement backend quality classifier with post-ingest trigger
priority: High
status: "Not Started"
estimatedEffort: "3-4 hours"
features:
  - F12
---

# Task M1-T10 — Implement backend quality classifier with post-ingest trigger

> **Milestone:** M1 (Backend Platform)
> **Priority:** High
> **Status:** Not Started
> **Estimated Effort:** 3-4 hours

## Description

Build the backend quality classifier that analyzes raw ping samples in a 5-minute sliding window and computes a quality state (VeryHigh, High, Medium, Low, Unstable, Disconnected) for each monitor. Runs post-ingest and as a background sweep every 60 seconds.

## Task Goals

- Implement classification algorithm with 6 quality states
- Post-ingest trigger: classify affected monitors after each batch
- Background sweep: re-evaluate all active monitors every 60 seconds
- Persist quality state on monitor row
- Update monitors list API response with quality_state

## Implementation Plan

### Steps

1. Create `server/utils/quality-states.ts`:
   - Define `QualityState` type: `warmingUp | low | medium | high | veryHigh | unstable | disconnected`
   - Define threshold constants (50ms, 150ms, 300ms, 10% loss, 0.5 CV, 5min window, 10 sample min)
2. Create `server/utils/quality-classifier.ts`:
   - `classifyMonitor(monitorId)`:
     - Fetch samples in last 5 minutes
     - Compute: sample_count, success_count, packet_loss, avg_latency, stddev_latency, CV
     - Apply classification rules in priority order
     - Update monitor row: `quality_state`, `state_since_ms`, `quality_state_updated_at`
   - `classifyAllActive()`: iterate monitors with samples in last 10 minutes
3. Create `server/plugins/quality-sweep.ts`:
   - `setInterval` every 60 seconds
   - Call `classifyAllActive()`
4. Integrate with ingest (M1-T6):
   - After batch commit, call `classifyMonitor()` for each distinct monitor_id
5. Verify: classification is correct, sweep runs, states persist

### Skills & MCP Servers

| Resource | Purpose | When to Invoke |
|---|---|---|
| `sequential-thinking` | Classification algorithm | Rule ordering |
| `nuxt` | Nitro plugin patterns | Background sweep |
| `filesystem` (MCP) | File creation | Writing files |

## Acceptance Criteria

- [ ] `classifyMonitor()` computes correct quality state from 5-minute window
- [ ] States applied in correct priority order: disconnected -> unstable -> veryHigh -> high -> medium -> low
- [ ] Post-ingest classification runs for each affected monitor
- [ ] Background sweep runs every 60 seconds
- [ ] Quality state persisted on monitor row
- [ ] `GET /api/monitors` includes quality_state field
- [ ] `GET /api/monitors/:id` includes quality_state in monitor metadata
- [ ] WebSocket sample messages include quality_state

## Completion Criteria

- [ ] All acceptance criteria above pass
- [ ] `npx nuxi typecheck` passes with no errors
- [ ] `npx nuxi dev` starts without errors

## Testing Checklist

- [ ] Classification algorithm correct for each state
- [ ] Post-ingest trigger works
- [ ] Background sweep runs on schedule
- [ ] State persisted in database

## Dependencies

- **Requires:** M1-T6 (ingest — sample source)
- **Blocks:** None

## Documentation References

- F12: [Backend quality classifier](../../requirements/features/feature-00012-quality-classifier.md)
