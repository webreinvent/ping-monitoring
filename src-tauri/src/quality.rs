use std::collections::VecDeque;

use crate::domain::{
    ClassificationUpdate, PingSample, QualityMetrics, QualityReason, QualityState,
    QualityThresholds, StateTransition,
};

pub struct QualityClassifier {
    thresholds: QualityThresholds,
    window: VecDeque<PingSample>,
    state: QualityState,
    state_since_ms: i64,
    failure_streak: u32,
    failure_streak_since_ms: Option<i64>,
    success_streak: u32,
    success_streak_since_ms: Option<i64>,
    unstable_candidate_since_ms: Option<i64>,
    stable_candidate_since_ms: Option<i64>,
}

impl QualityClassifier {
    pub fn new(thresholds: QualityThresholds, now_ms: i64) -> Self {
        Self {
            thresholds,
            window: VecDeque::new(),
            state: QualityState::WarmingUp,
            state_since_ms: now_ms,
            failure_streak: 0,
            failure_streak_since_ms: None,
            success_streak: 0,
            success_streak_since_ms: None,
            unstable_candidate_since_ms: None,
            stable_candidate_since_ms: None,
        }
    }

    pub fn observe(&mut self, sample: PingSample) -> ClassificationUpdate {
        let now_ms = sample.timestamp_ms;
        self.window.push_back(sample.clone());
        self.prune_window(now_ms);
        self.update_streaks(&sample);

        let metrics = calculate_metrics(&self.window);
        let reasons = self.instability_reasons(&metrics);
        let mut transition = None;

        if sample.status.counts_as_network_failure()
            && self.failure_streak >= self.thresholds.outage_failures
            && self.state != QualityState::Disconnected
        {
            let effective_at_ms = self.failure_streak_since_ms.unwrap_or(now_ms);
            transition = self.transition_to(
                QualityState::Disconnected,
                effective_at_ms,
                vec![QualityReason::ConsecutiveFailures],
            );
            self.unstable_candidate_since_ms = None;
            self.stable_candidate_since_ms = None;
        } else if self.state == QualityState::Disconnected {
            if sample.status.is_success()
                && self.success_streak >= self.thresholds.recovery_successes
            {
                let effective_at_ms = self.success_streak_since_ms.unwrap_or(now_ms);
                transition = self.transition_to(
                    next_latency_state(&metrics),
                    effective_at_ms,
                    vec![],
                );
                self.unstable_candidate_since_ms = None;
                self.stable_candidate_since_ms = None;
            }
        } else if self.window.len() >= self.thresholds.minimum_samples {
            let next = next_latency_state(&metrics);
            if self.state != next {
                transition = self.transition_to(next, now_ms, vec![]);
            }
        }

        ClassificationUpdate {
            state: self.state,
            state_since_ms: self.state_since_ms,
            metrics,
            reasons: if self.state == QualityState::Disconnected {
                vec![QualityReason::ConsecutiveFailures]
            } else {
                reasons
            },
            transition,
        }
    }

    pub fn set_paused(&mut self, paused: bool, timestamp_ms: i64) -> Option<StateTransition> {
        self.window.clear();
        self.failure_streak = 0;
        self.success_streak = 0;
        self.failure_streak_since_ms = None;
        self.success_streak_since_ms = None;
        self.unstable_candidate_since_ms = None;
        self.stable_candidate_since_ms = None;
        let next = if paused {
            QualityState::Paused
        } else {
            QualityState::WarmingUp
        };
        self.transition_to(next, timestamp_ms, vec![])
    }

    fn prune_window(&mut self, now_ms: i64) {
        let oldest = now_ms - (self.thresholds.window_seconds as i64 * 1_000);
        while self
            .window
            .front()
            .is_some_and(|sample| sample.timestamp_ms < oldest)
        {
            self.window.pop_front();
        }
    }

    fn update_streaks(&mut self, sample: &PingSample) {
        if sample.status.is_success() {
            if self.success_streak == 0 {
                self.success_streak_since_ms = Some(sample.timestamp_ms);
            }
            self.success_streak += 1;
            self.failure_streak = 0;
            self.failure_streak_since_ms = None;
        } else if sample.status.counts_as_network_failure() {
            if self.failure_streak == 0 {
                self.failure_streak_since_ms = Some(sample.timestamp_ms);
            }
            self.failure_streak += 1;
            self.success_streak = 0;
            self.success_streak_since_ms = None;
        } else {
            self.failure_streak = 0;
            self.success_streak = 0;
            self.failure_streak_since_ms = None;
            self.success_streak_since_ms = None;
        }
    }

    fn instability_reasons(&self, metrics: &QualityMetrics) -> Vec<QualityReason> {
        let mut reasons = Vec::new();
        if metrics.packet_loss_percent >= self.thresholds.packet_loss_percent {
            reasons.push(QualityReason::PacketLoss);
        }
        if metrics
            .jitter_ms
            .is_some_and(|value| value >= self.thresholds.jitter_ms)
        {
            reasons.push(QualityReason::Jitter);
        }
        if metrics
            .p95_latency_ms
            .is_some_and(|value| value >= self.thresholds.p95_latency_ms)
        {
            reasons.push(QualityReason::HighLatency);
        }
        reasons
    }

    fn transition_to(
        &mut self,
        next: QualityState,
        effective_at_ms: i64,
        reasons: Vec<QualityReason>,
    ) -> Option<StateTransition> {
        if self.state == next {
            return None;
        }
        let transition = StateTransition {
            from: self.state,
            to: next,
            effective_at_ms,
            reasons,
        };
        self.state = next;
        self.state_since_ms = effective_at_ms;
        Some(transition)
    }
}

pub fn calculate_metrics(samples: &VecDeque<PingSample>) -> QualityMetrics {
    if samples.is_empty() {
        return QualityMetrics::default();
    }

    let latencies = samples
        .iter()
        .filter_map(|sample| sample.latency_ms.filter(|_| sample.status.is_success()))
        .collect::<Vec<_>>();
    let sample_count = samples.len();
    let success_count = latencies.len();
    let packet_loss_percent = ((sample_count - success_count) as f64 / sample_count as f64) * 100.0;

    if latencies.is_empty() {
        return QualityMetrics {
            sample_count,
            success_count,
            packet_loss_percent,
            ..QualityMetrics::default()
        };
    }

    let sum = latencies.iter().sum::<f64>();
    let mut sorted = latencies.clone();
    sorted.sort_by(f64::total_cmp);
    let p95_index = (((sorted.len() as f64) * 0.95).ceil() as usize)
        .saturating_sub(1)
        .min(sorted.len() - 1);
    let jitter_ms = if latencies.len() >= 2 {
        Some(
            latencies
                .windows(2)
                .map(|pair| (pair[1] - pair[0]).abs())
                .sum::<f64>()
                / (latencies.len() - 1) as f64,
        )
    } else {
        Some(0.0)
    };

    QualityMetrics {
        sample_count,
        success_count,
        packet_loss_percent,
        average_latency_ms: Some(sum / latencies.len() as f64),
        minimum_latency_ms: sorted.first().copied(),
        maximum_latency_ms: sorted.last().copied(),
        p95_latency_ms: sorted.get(p95_index).copied(),
        jitter_ms,
    }
}


fn next_latency_state(metrics: &QualityMetrics) -> QualityState {
    // Only mark unstable when packet loss is significant (>5%) or no data.
    // A single timeout in a 300s window is ~0.3% — don't treat that as unstable.
    if metrics.packet_loss_percent > 5.0 {
        return QualityState::Unstable;
    }
    match metrics.average_latency_ms {
        Some(latency) if latency < 50.0 => QualityState::Low,
        Some(latency) if latency < 100.0 => QualityState::Medium,
        Some(latency) if latency < 200.0 => QualityState::High,
        Some(_) => QualityState::VeryHigh,
        None => QualityState::Unstable,
    }
}

#[cfg(test)]
mod tests {
    use std::collections::VecDeque;

    use super::*;
    use crate::domain::{PingSample, ProbeStatus, QualityThresholds};

    fn classifier() -> QualityClassifier {
        QualityClassifier::new(QualityThresholds::default(), 0)
    }

    #[test]
    fn confirms_outage_after_five_failures_and_backdates_it() {
        let mut classifier = classifier();
        let mut last = None;
        for second in 1..=5 {
            last = Some(classifier.observe(PingSample::failure(
                "target",
                second * 1_000,
                ProbeStatus::Timeout,
            )));
        }
        let update = last.unwrap();
        assert_eq!(update.state, QualityState::Disconnected);
        let transition = update.transition.unwrap();
        assert_eq!(transition.effective_at_ms, 1_000);
        assert_eq!(transition.reasons, vec![QualityReason::ConsecutiveFailures]);
    }

    #[test]
    fn confirms_recovery_after_three_successes_and_backdates_it() {
        let mut classifier = classifier();
        for second in 1..=5 {
            classifier.observe(PingSample::failure(
                "target",
                second * 1_000,
                ProbeStatus::Timeout,
            ));
        }
        let mut last = None;
        for second in 6..=8 {
            last = Some(classifier.observe(PingSample::success("target", second * 1_000, 20.0)));
        }
        let update = last.unwrap();
        assert_eq!(update.state, QualityState::Low);
        assert_eq!(update.transition.unwrap().effective_at_ms, 6_000);
    }

    #[test]
    fn high_latency_moves_to_very_high_state() {
        let mut classifier = classifier();
        let mut update = None;
        for second in 0..25 {
            update = Some(classifier.observe(PingSample::success("target", second * 1_000, 200.0)));
        }
        let update = update.unwrap();
        assert_eq!(update.state, QualityState::VeryHigh);
    }

    #[test]
    fn calculates_loss_latency_percentile_and_jitter() {
        let samples = VecDeque::from(vec![
            PingSample::success("target", 0, 10.0),
            PingSample::success("target", 1_000, 20.0),
            PingSample::failure("target", 2_000, ProbeStatus::Timeout),
            PingSample::success("target", 3_000, 40.0),
        ]);
        let metrics = calculate_metrics(&samples);
        assert_eq!(metrics.sample_count, 4);
        assert_eq!(metrics.success_count, 3);
        assert_eq!(metrics.packet_loss_percent, 25.0);
        assert_eq!(metrics.average_latency_ms, Some(70.0 / 3.0));
        assert_eq!(metrics.p95_latency_ms, Some(40.0));
        assert_eq!(metrics.jitter_ms, Some(15.0));
    }

    #[test]
    fn pause_clears_classifier_window() {
        let mut classifier = classifier();
        classifier.observe(PingSample::success("target", 1_000, 10.0));
        let transition = classifier.set_paused(true, 2_000).unwrap();
        assert_eq!(transition.to, QualityState::Paused);
        let transition = classifier.set_paused(false, 3_000).unwrap();
        assert_eq!(transition.to, QualityState::WarmingUp);
    }
}
