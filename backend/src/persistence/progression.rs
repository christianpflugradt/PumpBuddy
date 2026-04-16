use super::{DomainRepository, PersistenceError};
use crate::domain::{normalize_repetition_kind, REPETITION_KIND_REPS};
use sqlx::Row;
use std::collections::HashMap;

const MIN_COVERAGE_RATIO: f64 = 0.80;
const MIN_WORKOUT_PROGRESS_RATIO: f64 = 0.70;
const MAX_WORKOUT_PROGRESS_RATIO: f64 = 1.20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ProgressionEntryPoint {
    Reps,
    Load,
}

#[derive(Debug, Clone, Copy)]
pub(super) struct RepsProgressionEligibilityContext<'a> {
    pub(super) user_id: &'a str,
    pub(super) current_workout_id: &'a str,
    pub(super) exercise_id: &'a str,
    pub(super) selected_variant_id: Option<&'a str>,
    pub(super) selected_station_id: Option<&'a str>,
    pub(super) requested_set_side: &'a str,
    pub(super) max_set_index: i32,
    pub(super) repetition_kind: &'a str,
}

fn enough_data_for_progression(entry_point: ProgressionEntryPoint) -> bool {
    match entry_point {
        ProgressionEntryPoint::Reps => true,
        ProgressionEntryPoint::Load => false,
    }
}

fn has_required_coverage(
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

pub(super) fn compute_workout_progress(
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

pub(super) async fn enough_data_for_reps_progression(
    repository: &DomainRepository,
    context: RepsProgressionEligibilityContext<'_>,
) -> Result<bool, PersistenceError> {
    if !enough_data_for_progression(ProgressionEntryPoint::Reps) {
        return Ok(false);
    }

    if normalize_repetition_kind(Some(context.repetition_kind)) != REPETITION_KIND_REPS {
        return Ok(false);
    }

    let Some(selected_variant_id) = context.selected_variant_id else {
        return Ok(false);
    };

    if context.max_set_index <= 0 {
        return Ok(false);
    }

    let matched_workout_count = sqlx::query(
        "SELECT COUNT(DISTINCT w.id)::bigint AS matched_workout_count
         FROM workouts w
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND (
             ($5::uuid IS NULL AND we.selected_station_id IS NULL)
             OR we.selected_station_id = $5::uuid
           )
           AND COALESCE(ev.repetition_kind, 'REPS') = $6",
    )
    .bind(context.current_workout_id)
    .bind(context.user_id)
    .bind(context.exercise_id)
    .bind(selected_variant_id)
    .bind(context.selected_station_id)
    .bind(REPETITION_KIND_REPS)
    .fetch_one(&repository.pool)
    .await?
    .get::<i64, _>("matched_workout_count");

    if matched_workout_count <= 0 {
        return Ok(false);
    }

    let coverage_rows = sqlx::query(
        "SELECT
            ws.set_index,
            COUNT(DISTINCT w.id)::bigint AS covered_workout_count
         FROM workouts w
         JOIN workout_exercises we ON we.workout_id = w.id
         JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE w.id <> $1::uuid
           AND w.user_id = $2::uuid
           AND we.user_id = $2::uuid
           AND ws.user_id = $2::uuid
           AND tpe.user_id = $2::uuid
           AND tpe.exercise_id = $3::uuid
           AND we.selected_variant_id = $4::uuid
           AND (
             ($5::uuid IS NULL AND we.selected_station_id IS NULL)
             OR we.selected_station_id = $5::uuid
           )
           AND ws.set_side = $6
           AND ws.set_index BETWEEN 1 AND $7
           AND COALESCE(ev.repetition_kind, 'REPS') = $8
         GROUP BY ws.set_index",
    )
    .bind(context.current_workout_id)
    .bind(context.user_id)
    .bind(context.exercise_id)
    .bind(selected_variant_id)
    .bind(context.selected_station_id)
    .bind(context.requested_set_side)
    .bind(context.max_set_index)
    .bind(REPETITION_KIND_REPS)
    .fetch_all(&repository.pool)
    .await?;

    let coverage_by_set_index: HashMap<i32, i64> = coverage_rows
        .into_iter()
        .map(|row| {
            (
                row.get::<i32, _>("set_index"),
                row.get::<i64, _>("covered_workout_count"),
            )
        })
        .collect();

    Ok(has_required_coverage(
        matched_workout_count,
        context.max_set_index,
        &coverage_by_set_index,
    ))
}

pub(super) fn enough_data_for_load_progression() -> bool {
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
