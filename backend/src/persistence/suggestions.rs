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

pub(super) async fn fetch_latest_historical_suggestion(
    repository: &DomainRepository,
    current_workout_id: &str,
    exercise_id: &str,
    selected_variant_id: Option<&str>,
    selected_station_id: Option<&str>,
) -> Result<Option<ActiveWorkoutSet>, PersistenceError> {
    let row = sqlx::query(
        "SELECT
            ws.load_display_value::double precision AS load_value,
            ws.reps
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         WHERE w.id <> $1::uuid
           AND tpe.exercise_id = $2::uuid
           AND ($3::uuid IS NULL OR we.selected_variant_id = $3::uuid)
           AND ($4::uuid IS NULL OR we.selected_station_id = $4::uuid)
         ORDER BY ws.completed_at DESC, w.updated_at DESC, ws.set_index DESC
         LIMIT 1",
    )
    .bind(current_workout_id)
    .bind(exercise_id)
    .bind(selected_variant_id)
    .bind(selected_station_id)
    .fetch_optional(&repository.pool)
    .await?;

    Ok(row.map(|row| ActiveWorkoutSet {
        load_value: row.get("load_value"),
        reps: row.get("reps"),
    }))
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

    if profile_loads_kg
        .iter()
        .any(|load| approx_eq(current_load_kg, *load))
    {
        return Some(current_load_kg);
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
}
