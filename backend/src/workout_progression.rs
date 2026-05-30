use std::collections::HashMap;

const MIN_COVERAGE_RATIO: f64 = 0.80;
const MIN_WORKOUT_PROGRESS_RATIO: f64 = 0.70;
const MAX_WORKOUT_PROGRESS_RATIO: f64 = 1.20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProgressionEntryPoint {
    Reps,
    Load,
}

pub(crate) fn enough_data_for_progression(entry_point: ProgressionEntryPoint) -> bool {
    match entry_point {
        ProgressionEntryPoint::Reps => true,
        ProgressionEntryPoint::Load => false,
    }
}

pub(crate) fn has_required_coverage(
    matched_workout_count: i64,
    max_set_index: i32,
    coverage_by_set_index: &HashMap<i32, i64>,
) -> bool {
    if matched_workout_count <= 0 || max_set_index <= 0 {
        return false;
    }

    (1..=max_set_index).all(|set_index| {
        let covered = *coverage_by_set_index.get(&set_index).unwrap_or(&0);
        let ratio = covered as f64 / matched_workout_count as f64;
        ratio + f64::EPSILON >= MIN_COVERAGE_RATIO
    })
}

pub(crate) fn compute_workout_progress(
    exercise_scores_by_id: &HashMap<String, Option<i32>>,
    baseline_by_exercise_id: &HashMap<String, i32>,
) -> Option<f64> {
    let total_exercise_count = exercise_scores_by_id.len();
    if total_exercise_count == 0 {
        return None;
    }

    let covered_exercise_count = exercise_scores_by_id
        .keys()
        .filter(|exercise_id| baseline_by_exercise_id.contains_key(*exercise_id))
        .count();

    // Strict majority: exactly 50% baseline coverage is insufficient.
    if covered_exercise_count * 2 <= total_exercise_count {
        return None;
    }

    let clamped_ratios: Vec<f64> = exercise_scores_by_id
        .iter()
        .filter_map(|(exercise_id, score)| {
            let baseline = *baseline_by_exercise_id.get(exercise_id)?;
            let score = (*score)?;
            if baseline <= 0 {
                return None;
            }

            let ratio = score as f64 / baseline as f64;
            Some(ratio.clamp(MIN_WORKOUT_PROGRESS_RATIO, MAX_WORKOUT_PROGRESS_RATIO))
        })
        .collect();

    if clamped_ratios.is_empty() {
        return None;
    }

    Some(clamped_ratios.iter().sum::<f64>() / clamped_ratios.len() as f64)
}

pub(crate) fn enough_data_for_load_progression() -> bool {
    enough_data_for_progression(ProgressionEntryPoint::Load)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::{
        compute_workout_progress, enough_data_for_load_progression, enough_data_for_progression,
        has_required_coverage, ProgressionEntryPoint,
    };

    #[test]
    fn enough_data_for_progression_is_true_for_reps_entry_point() {
        assert!(enough_data_for_progression(ProgressionEntryPoint::Reps));
    }

    #[test]
    fn enough_data_for_progression_is_false_for_load_entry_point() {
        assert!(!enough_data_for_progression(ProgressionEntryPoint::Load));
    }

    #[test]
    fn coverage_gate_requires_at_least_eighty_percent_for_each_set_index() {
        let mut coverage = HashMap::new();
        coverage.insert(1, 8);
        coverage.insert(2, 7);

        assert!(!has_required_coverage(10, 2, &coverage));

        coverage.insert(2, 8);
        assert!(has_required_coverage(10, 2, &coverage));
    }

    #[test]
    fn dedicated_load_progression_entrypoint_returns_false() {
        assert!(!enough_data_for_load_progression());
    }

    #[test]
    fn workout_progress_clamps_ratios_and_averages_only_covered_exercises() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(200)),
            ("b".to_owned(), Some(50)),
            ("c".to_owned(), Some(100)),
            ("d".to_owned(), Some(75)),
        ]);
        let baselines = HashMap::from([
            ("a".to_owned(), 100),
            ("b".to_owned(), 100),
            ("c".to_owned(), 100),
        ]);

        let progress = compute_workout_progress(&exercise_scores, &baselines)
            .expect("strict-majority covered workout should produce progress");

        let expected = (1.20 + 0.70 + 1.00) / 3.0;
        assert!((progress - expected).abs() < 1e-9);
    }

    #[test]
    fn workout_progress_requires_strict_majority_for_even_exercise_counts() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(100)),
            ("b".to_owned(), Some(100)),
            ("c".to_owned(), Some(100)),
            ("d".to_owned(), Some(100)),
        ]);
        let baselines = HashMap::from([("a".to_owned(), 100), ("b".to_owned(), 100)]);

        assert!(
            compute_workout_progress(&exercise_scores, &baselines).is_none(),
            "2/4 covered must fail strict-majority coverage"
        );
    }

    #[test]
    fn workout_progress_requires_strict_majority_for_odd_exercise_counts() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(100)),
            ("b".to_owned(), Some(100)),
            ("c".to_owned(), Some(100)),
            ("d".to_owned(), Some(100)),
            ("e".to_owned(), Some(100)),
        ]);

        let two_of_five_baselines = HashMap::from([("a".to_owned(), 100), ("b".to_owned(), 100)]);
        assert!(
            compute_workout_progress(&exercise_scores, &two_of_five_baselines).is_none(),
            "2/5 covered must fail strict-majority coverage"
        );

        let three_of_five_baselines = HashMap::from([
            ("a".to_owned(), 100),
            ("b".to_owned(), 100),
            ("c".to_owned(), 100),
        ]);
        assert!(
            compute_workout_progress(&exercise_scores, &three_of_five_baselines).is_some(),
            "3/5 covered must pass strict-majority coverage"
        );
    }

    #[test]
    fn workout_progress_excludes_missing_baselines_from_average_but_counts_toward_gate() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(120)),
            ("b".to_owned(), Some(80)),
            ("c".to_owned(), Some(100)),
            ("d".to_owned(), Some(60)),
            ("e".to_owned(), Some(200)),
        ]);
        let baselines = HashMap::from([
            ("a".to_owned(), 100),
            ("b".to_owned(), 100),
            ("c".to_owned(), 100),
        ]);

        let progress = compute_workout_progress(&exercise_scores, &baselines)
            .expect("3/5 covered should produce progress");

        let expected = (1.20 + 0.80 + 1.00) / 3.0;
        assert!((progress - expected).abs() < 1e-9);
    }

    #[test]
    fn workout_progress_returns_unrounded_raw_numeric_value() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(100)),
            ("b".to_owned(), Some(70)),
            ("c".to_owned(), Some(90)),
        ]);
        let baselines = HashMap::from([
            ("a".to_owned(), 100),
            ("b".to_owned(), 90),
            ("c".to_owned(), 100),
        ]);

        let progress = compute_workout_progress(&exercise_scores, &baselines)
            .expect("3/3 covered should produce progress");

        let expected = (1.00 + (70.0 / 90.0) + 0.90) / 3.0;
        assert!((progress - expected).abs() < 1e-9);
        assert_ne!(
            progress, 0.89,
            "backend must return raw value without display rounding"
        );
    }

    #[test]
    fn workout_progress_respects_exact_clamp_boundaries() {
        let exercise_scores = HashMap::from([
            ("a".to_owned(), Some(70)),
            ("b".to_owned(), Some(120)),
            ("c".to_owned(), Some(100)),
        ]);
        let baselines = HashMap::from([
            ("a".to_owned(), 100),
            ("b".to_owned(), 100),
            ("c".to_owned(), 100),
        ]);

        let progress = compute_workout_progress(&exercise_scores, &baselines)
            .expect("3/3 covered should produce progress");
        let expected = (0.70 + 1.20 + 1.00) / 3.0;
        assert!((progress - expected).abs() < 1e-9);
    }
}
