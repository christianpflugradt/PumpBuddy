pub const RED_TONE_MAX_EXCLUSIVE: f64 = 0.95;
pub const YELLOW_TONE_MAX_INCLUSIVE: f64 = 1.03;
pub const MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION: usize = 3;
pub const PERFORMANCE_TONE_ORDER: [&str; 4] = ["GREEN", "YELLOW", "RED", "GRAY"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PerformanceToneCategory {
    Green,
    Yellow,
    Red,
    Gray,
}

impl PerformanceToneCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Green => "GREEN",
            Self::Yellow => "YELLOW",
            Self::Red => "RED",
            Self::Gray => "GRAY",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PerformanceAvailability {
    Available,
    NotEnoughData,
}

impl PerformanceAvailability {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Available => "AVAILABLE",
            Self::NotEnoughData => "NOT_ENOUGH_DATA",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PerformanceClassification {
    pub availability: PerformanceAvailability,
    pub tone: PerformanceToneCategory,
}

impl PerformanceClassification {
    pub fn is_available(self) -> bool {
        self.availability == PerformanceAvailability::Available
    }
}

pub fn classify_average(average: Option<f64>) -> PerformanceClassification {
    match average {
        None => PerformanceClassification {
            availability: PerformanceAvailability::NotEnoughData,
            tone: PerformanceToneCategory::Gray,
        },
        Some(value) if value < RED_TONE_MAX_EXCLUSIVE => PerformanceClassification {
            availability: PerformanceAvailability::Available,
            tone: PerformanceToneCategory::Red,
        },
        Some(value) if value <= YELLOW_TONE_MAX_INCLUSIVE => PerformanceClassification {
            availability: PerformanceAvailability::Available,
            tone: PerformanceToneCategory::Yellow,
        },
        Some(_) => PerformanceClassification {
            availability: PerformanceAvailability::Available,
            tone: PerformanceToneCategory::Green,
        },
    }
}

pub fn classify_average_with_scored_entry_gate(
    average: Option<f64>,
    scored_entry_count: usize,
    min_scored_entry_count: usize,
) -> PerformanceClassification {
    if scored_entry_count < min_scored_entry_count {
        return PerformanceClassification {
            availability: PerformanceAvailability::NotEnoughData,
            tone: PerformanceToneCategory::Gray,
        };
    }

    classify_average(average)
}

pub fn tone_rank(tone: &str) -> i32 {
    match tone {
        "GREEN" => 0,
        "YELLOW" => 1,
        "RED" => 2,
        "GRAY" => 3,
        _ => 4,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_average, classify_average_with_scored_entry_gate, PerformanceAvailability,
        PerformanceToneCategory, MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION,
    };

    #[test]
    fn classify_average_marks_none_as_not_enough_data_gray() {
        let classification = classify_average(None);
        assert_eq!(
            classification.availability,
            PerformanceAvailability::NotEnoughData
        );
        assert_eq!(classification.tone, PerformanceToneCategory::Gray);
    }

    #[test]
    fn classify_average_uses_expected_threshold_boundaries() {
        let red = classify_average(Some(0.949_999_99));
        let yellow_at_lower = classify_average(Some(0.95));
        let yellow_at_upper = classify_average(Some(1.03));
        let green = classify_average(Some(1.030_000_01));

        assert_eq!(red.tone, PerformanceToneCategory::Red);
        assert_eq!(yellow_at_lower.tone, PerformanceToneCategory::Yellow);
        assert_eq!(yellow_at_upper.tone, PerformanceToneCategory::Yellow);
        assert_eq!(green.tone, PerformanceToneCategory::Green);
    }

    #[test]
    fn scored_entry_gate_overrides_average_when_under_minimum() {
        let classification = classify_average_with_scored_entry_gate(
            Some(1.2),
            MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION - 1,
            MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION,
        );

        assert_eq!(
            classification.availability,
            PerformanceAvailability::NotEnoughData
        );
        assert_eq!(classification.tone, PerformanceToneCategory::Gray);
    }
}
