use super::{DomainRepository, PersistenceError};
use crate::domain::ActiveWorkoutSet;
use sqlx::Row;

const DEFAULT_REPS: i32 = 10;
const FREE_MODE_DEFAULT_LOAD_KG: f64 = 10.0;
const FORMULA_BASELINE_LOAD_KG: f64 = 20.0;
const BOUNDED_DISCRETE_START_RATIO: f64 = 0.30;
const FLOAT_TOLERANCE: f64 = 1e-9;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum LoadStepDirection {
    Increase,
    Decrease,
}

#[derive(Debug, Clone, Copy, Default)]
struct HistoricalScope<'a> {
    variant_eq: Option<&'a str>,
    variant_ne: Option<&'a str>,
    gym_eq: Option<&'a str>,
    gym_ne: Option<&'a str>,
    station_eq: Option<&'a str>,
    station_ne: Option<&'a str>,
    station_is_null_only: bool,
}

#[derive(Debug, Clone)]
pub(super) struct HistoricalSuggestionRuleContext<'a> {
    pub(super) user_id: &'a str,
    pub(super) current_workout_id: &'a str,
    pub(super) exercise_id: &'a str,
    pub(super) current_gym_id: Option<&'a str>,
    pub(super) selected_variant_id: Option<&'a str>,
    pub(super) selected_station_id: Option<&'a str>,
    pub(super) idx: i32,
    pub(super) last_current: Option<ActiveWorkoutSet>,
}

async fn fetch_historical_suggestions_for_scope(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    set_index: i32,
    allow_null_load: bool,
    scope: HistoricalScope<'_>,
) -> Result<Vec<ActiveWorkoutSet>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            ws.load_canonical_kg::double precision AS load_value,
            ws.reps
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         WHERE w.id <> $1::uuid
           AND tpe.exercise_id = $2::uuid
           AND ws.set_index = $3
           AND (NOT $10::boolean OR we.selected_station_id IS NULL)
           AND w.user_id = $11::uuid
           AND we.user_id = $11::uuid
           AND ws.user_id = $11::uuid
           AND tpe.user_id = $11::uuid
           AND ($4::uuid IS NULL OR we.selected_variant_id = $4::uuid)
           AND ($5::uuid IS NULL OR we.selected_variant_id IS NOT NULL AND we.selected_variant_id <> $5::uuid)
           AND ($6::uuid IS NULL OR w.gym_id = $6::uuid)
           AND ($7::uuid IS NULL OR w.gym_id IS NOT NULL AND w.gym_id <> $7::uuid)
           AND ($8::uuid IS NULL OR we.selected_station_id = $8::uuid)
           AND ($9::uuid IS NULL OR we.selected_station_id IS NOT NULL AND we.selected_station_id <> $9::uuid)
           AND ($12::boolean OR ws.load_canonical_kg IS NOT NULL)
         ORDER BY ws.completed_at DESC, w.updated_at DESC, w.id DESC, we.id DESC, ws.id DESC",
    )
    .bind(current_workout_id)
    .bind(exercise_id)
    .bind(set_index)
    .bind(scope.variant_eq)
    .bind(scope.variant_ne)
    .bind(scope.gym_eq)
    .bind(scope.gym_ne)
    .bind(scope.station_eq)
    .bind(scope.station_ne)
    .bind(scope.station_is_null_only)
    .bind(user_id)
    .bind(allow_null_load)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| ActiveWorkoutSet {
            load_value: row
                .get::<Option<f64>, _>("load_value")
                .unwrap_or(FREE_MODE_DEFAULT_LOAD_KG),
            reps: row.get("reps"),
        })
        .collect())
}

async fn fetch_latest_historical_suggestion_for_scope(
    repository: &DomainRepository,
    user_id: &str,
    current_workout_id: &str,
    exercise_id: &str,
    set_index: i32,
    allow_null_load: bool,
    scope: HistoricalScope<'_>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let candidates = fetch_historical_suggestions_for_scope(
        repository,
        user_id,
        current_workout_id,
        exercise_id,
        set_index,
        allow_null_load,
        scope,
    )
    .await?;
    Ok(candidates.into_iter().next())
}

pub(super) async fn evaluate_historical_suggestion_rules(
    repository: &DomainRepository,
    context: HistoricalSuggestionRuleContext<'_>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let HistoricalSuggestionRuleContext {
        user_id,
        current_workout_id,
        exercise_id,
        current_gym_id,
        selected_variant_id,
        selected_station_id,
        idx,
        last_current,
    } = context;
    let allow_null_load = selected_station_id.is_none();

    if idx <= 0 {
        return Ok(last_current);
    }

    // Rule 1: same variant + same gym + same station with exact index match.
    if let (Some(variant_id), Some(gym_id), Some(station_id)) =
        (selected_variant_id, current_gym_id, selected_station_id)
    {
        let exact = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            idx,
            allow_null_load,
            HistoricalScope {
                variant_eq: Some(variant_id),
                gym_eq: Some(gym_id),
                station_eq: Some(station_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if exact.is_some() {
            return Ok(exact);
        }
    } else if let (Some(variant_id), Some(gym_id)) = (selected_variant_id, current_gym_id) {
        let stationless_exact = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            idx,
            allow_null_load,
            HistoricalScope {
                variant_eq: Some(variant_id),
                gym_eq: Some(gym_id),
                station_is_null_only: true,
                ..HistoricalScope::default()
            },
        )
        .await?;
        if stationless_exact.is_some() {
            return Ok(stationless_exact);
        }
    }
    if last_current.is_some() {
        return Ok(last_current);
    }

    // Rules 2-6: historical lookups are only valid when idx == 1.
    if idx != 1 {
        return Ok(None);
    }

    // Rule 2: same variant + same gym + different station.
    if let (Some(variant_id), Some(gym_id), Some(station_id)) =
        (selected_variant_id, current_gym_id, selected_station_id)
    {
        let rule_2 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            HistoricalScope {
                variant_eq: Some(variant_id),
                gym_eq: Some(gym_id),
                station_ne: Some(station_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_2.is_some() {
            return Ok(rule_2);
        }
    }

    // Rule 3: same variant + other gym.
    if let (Some(variant_id), Some(gym_id)) = (selected_variant_id, current_gym_id) {
        let rule_3 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            HistoricalScope {
                variant_eq: Some(variant_id),
                gym_ne: Some(gym_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_3.is_some() {
            return Ok(rule_3);
        }
    }

    // Rule 4: same exercise + same gym + same station + other variant.
    if let (Some(variant_id), Some(gym_id), Some(station_id)) =
        (selected_variant_id, current_gym_id, selected_station_id)
    {
        let rule_4 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            HistoricalScope {
                variant_ne: Some(variant_id),
                gym_eq: Some(gym_id),
                station_eq: Some(station_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_4.is_some() {
            return Ok(rule_4);
        }
    }

    // Rule 5: same exercise + same gym + other variant + other station.
    if let (Some(variant_id), Some(gym_id), Some(station_id)) =
        (selected_variant_id, current_gym_id, selected_station_id)
    {
        let rule_5 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            HistoricalScope {
                variant_ne: Some(variant_id),
                gym_eq: Some(gym_id),
                station_ne: Some(station_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_5.is_some() {
            return Ok(rule_5);
        }
    }

    // Rule 6: same exercise + other gym.
    if let Some(gym_id) = current_gym_id {
        let rule_6 = fetch_latest_historical_suggestion_for_scope(
            repository,
            user_id,
            current_workout_id,
            exercise_id,
            1,
            allow_null_load,
            HistoricalScope {
                gym_ne: Some(gym_id),
                ..HistoricalScope::default()
            },
        )
        .await?;
        if rule_6.is_some() {
            return Ok(rule_6);
        }
    }

    Ok(None)
}

pub(super) async fn fetch_station_profile_loads(
    repository: &DomainRepository,
    selected_station_id: &str,
) -> Result<Vec<f64>, PersistenceError> {
    fetch_station_profile_loads_for_gym(repository, selected_station_id, None).await
}

pub(super) async fn fetch_station_profile_loads_for_gym(
    repository: &DomainRepository,
    selected_station_id: &str,
    gym_id: Option<&str>,
) -> Result<Vec<f64>, PersistenceError> {
    let maybe_row = sqlx::query(
        "SELECT
            lp.definition AS station_profile_definition,
            lp.weight_unit AS station_profile_weight_unit
         FROM equipment_stations es
         JOIN load_profiles lp ON lp.id = es.load_profile_id
         WHERE es.id = $1::uuid
           AND ($2::uuid IS NULL OR es.gym_id = $2::uuid)",
    )
    .bind(selected_station_id)
    .bind(gym_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(row) = maybe_row else {
        return Ok(Vec::new());
    };

    let definition: sqlx::types::JsonValue = row.get("station_profile_definition");
    let weight_unit: String = row.get("station_profile_weight_unit");

    DomainRepository::load_profile_definition_to_kg(&definition, &weight_unit)
}

fn approx_eq(left: f64, right: f64) -> bool {
    (left - right).abs() <= FLOAT_TOLERANCE
}

pub(super) fn step_profile_load(
    profile_loads_kg: &[f64],
    current_load_kg: f64,
    direction: LoadStepDirection,
) -> Option<f64> {
    if profile_loads_kg.is_empty() || !current_load_kg.is_finite() {
        return None;
    }

    let min = profile_loads_kg[0];
    let max = profile_loads_kg[profile_loads_kg.len() - 1];

    if current_load_kg <= min {
        return Some(min);
    }
    if current_load_kg >= max {
        return Some(max);
    }

    for (idx, load) in profile_loads_kg.iter().enumerate() {
        if approx_eq(current_load_kg, *load) {
            return Some(match direction {
                LoadStepDirection::Decrease => {
                    if idx == 0 {
                        *load
                    } else {
                        profile_loads_kg[idx - 1]
                    }
                }
                LoadStepDirection::Increase => {
                    if idx + 1 >= profile_loads_kg.len() {
                        *load
                    } else {
                        profile_loads_kg[idx + 1]
                    }
                }
            });
        }

        if current_load_kg < *load {
            return Some(match direction {
                LoadStepDirection::Decrease => profile_loads_kg[idx - 1],
                LoadStepDirection::Increase => *load,
            });
        }
    }

    Some(max)
}

pub(super) fn snap_to_profile_load(profile_loads_kg: &[f64], current_load_kg: f64) -> Option<f64> {
    if profile_loads_kg.is_empty() || !current_load_kg.is_finite() {
        return None;
    }

    if let Some(exact_match) = profile_loads_kg
        .iter()
        .copied()
        .find(|load| approx_eq(current_load_kg, *load))
    {
        return Some(exact_match);
    }

    let lower = step_profile_load(
        profile_loads_kg,
        current_load_kg,
        LoadStepDirection::Decrease,
    )?;
    let upper = step_profile_load(
        profile_loads_kg,
        current_load_kg,
        LoadStepDirection::Increase,
    )?;

    let lower_distance = (current_load_kg - lower).abs();
    let upper_distance = (upper - current_load_kg).abs();

    if upper_distance + FLOAT_TOLERANCE < lower_distance {
        Some(upper)
    } else {
        Some(lower)
    }
}

pub(super) fn suggest_profile_start_load(profile_loads_kg: &[f64]) -> Option<f64> {
    if profile_loads_kg.is_empty() {
        return None;
    }

    if is_formula_min_step_profile(profile_loads_kg) {
        suggest_formula_min_step_start_load(profile_loads_kg)
    } else {
        suggest_bounded_discrete_start_load(profile_loads_kg)
    }
}

fn suggest_bounded_discrete_start_load(profile_loads_kg: &[f64]) -> Option<f64> {
    let max = *profile_loads_kg.last()?;
    let target = max * BOUNDED_DISCRETE_START_RATIO;
    profile_loads_kg
        .iter()
        .copied()
        .find(|load| *load + FLOAT_TOLERANCE >= target)
        .or(Some(max))
}

fn suggest_formula_min_step_start_load(profile_loads_kg: &[f64]) -> Option<f64> {
    if profile_loads_kg
        .iter()
        .any(|load| approx_eq(*load, FORMULA_BASELINE_LOAD_KG))
    {
        return Some(FORMULA_BASELINE_LOAD_KG);
    }

    profile_loads_kg
        .iter()
        .copied()
        .find(|load| *load > FORMULA_BASELINE_LOAD_KG + FLOAT_TOLERANCE)
        .or_else(|| profile_loads_kg.last().copied())
}

fn is_formula_min_step_profile(profile_loads_kg: &[f64]) -> bool {
    if profile_loads_kg.len() < 2 {
        return false;
    }

    let mut deltas = profile_loads_kg
        .windows(2)
        .map(|window| window[1] - window[0]);
    let first_delta = deltas.next().unwrap_or_default();

    if first_delta <= FLOAT_TOLERANCE {
        return false;
    }

    deltas.all(|delta| (delta - first_delta).abs() <= FLOAT_TOLERANCE)
}

pub(super) fn default_suggested_set() -> ActiveWorkoutSet {
    ActiveWorkoutSet {
        load_value: FREE_MODE_DEFAULT_LOAD_KG,
        reps: Some(DEFAULT_REPS),
    }
}

pub(super) fn profile_start_suggested_set(profile_loads_kg: &[f64]) -> Option<ActiveWorkoutSet> {
    suggest_profile_start_load(profile_loads_kg).map(|load_value| ActiveWorkoutSet {
        load_value,
        reps: Some(DEFAULT_REPS),
    })
}

#[cfg(test)]
mod tests {
    use super::{
        profile_start_suggested_set, snap_to_profile_load, step_profile_load, LoadStepDirection,
        FORMULA_BASELINE_LOAD_KG,
    };

    #[test]
    fn step_profile_load_moves_between_adjacent_values_for_non_uniform_steps() {
        let loads = [5.0, 12.5, 20.0, 27.5, 40.0];

        assert_eq!(
            step_profile_load(&loads, 20.0, LoadStepDirection::Increase),
            Some(27.5)
        );
        assert_eq!(
            step_profile_load(&loads, 20.0, LoadStepDirection::Decrease),
            Some(12.5)
        );

        // Invalid intermediary values should still snap to previous/next valid values.
        assert_eq!(
            step_profile_load(&loads, 21.2, LoadStepDirection::Increase),
            Some(27.5)
        );
        assert_eq!(
            step_profile_load(&loads, 21.2, LoadStepDirection::Decrease),
            Some(20.0)
        );
    }

    #[test]
    fn step_profile_load_clamps_at_profile_boundaries() {
        let loads = [10.0, 15.0, 20.0];

        assert_eq!(
            step_profile_load(&loads, 2.0, LoadStepDirection::Decrease),
            Some(10.0)
        );
        assert_eq!(
            step_profile_load(&loads, 2.0, LoadStepDirection::Increase),
            Some(10.0)
        );
        assert_eq!(
            step_profile_load(&loads, 99.0, LoadStepDirection::Decrease),
            Some(20.0)
        );
        assert_eq!(
            step_profile_load(&loads, 99.0, LoadStepDirection::Increase),
            Some(20.0)
        );
    }

    #[test]
    fn profile_start_suggestion_for_bounded_discrete_uses_near_thirty_percent() {
        let bounded_discrete = [5.0, 12.5, 20.0, 27.5, 40.0];
        let suggested = profile_start_suggested_set(&bounded_discrete)
            .expect("bounded discrete profile should produce suggestion");

        // 30% of 40 is 12; the next valid value at/above target is 12.5.
        assert_eq!(suggested.load_value, 12.5);
        assert_eq!(suggested.reps, Some(10));
    }

    #[test]
    fn profile_start_suggestion_for_formula_uses_twenty_or_next_above_twenty() {
        let with_20 = [10.0, 15.0, FORMULA_BASELINE_LOAD_KG, 25.0];
        let suggested_with_20 = profile_start_suggested_set(&with_20)
            .expect("formula profile with 20 should produce suggestion");
        assert_eq!(suggested_with_20.load_value, FORMULA_BASELINE_LOAD_KG);

        let without_20 = [7.5, 12.5, 17.5, 22.5, 27.5];
        let suggested_without_20 = profile_start_suggested_set(&without_20)
            .expect("formula profile without 20 should produce suggestion");
        assert_eq!(suggested_without_20.load_value, 22.5);
    }

    #[test]
    fn snap_to_profile_load_picks_nearest_valid_load_for_intermediate_values() {
        let loads = [5.0, 12.5, 20.0, 27.5, 40.0];

        assert_eq!(snap_to_profile_load(&loads, 21.2), Some(20.0));
        assert_eq!(snap_to_profile_load(&loads, 24.9), Some(27.5));
        assert_eq!(snap_to_profile_load(&loads, 27.5), Some(27.5));
    }

    #[test]
    fn snap_to_profile_load_uses_lower_value_on_exact_tie() {
        let loads = [10.0, 15.0];
        assert_eq!(snap_to_profile_load(&loads, 12.5), Some(10.0));
    }

    #[test]
    fn snap_to_profile_load_returns_profile_member_for_near_equal_input() {
        let loads = [10.0, 12.5, 15.0];
        assert_eq!(snap_to_profile_load(&loads, 10.0 + 5e-10), Some(10.0));
    }

    #[test]
    fn snap_to_profile_load_is_stable_for_float_adjacent_inputs() {
        let loads = [20.0, 22.5, 25.0];
        assert_eq!(snap_to_profile_load(&loads, 20.0), Some(20.0));
        assert_eq!(snap_to_profile_load(&loads, 20.0 + 1e-10), Some(20.0));
    }
}
