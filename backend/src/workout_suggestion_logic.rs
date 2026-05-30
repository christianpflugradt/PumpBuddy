use crate::domain::{
    normalize_repetition_kind, ActiveWorkoutSet, CompletedActiveWorkoutSet, REPETITION_KIND_REPS,
    REPETITION_KIND_SECS,
};

const DEFAULT_REPS: i32 = 10;
pub(crate) const FREE_MODE_DEFAULT_LOAD_KG: f64 = 10.0;
const FORMULA_BASELINE_LOAD_KG: f64 = 20.0;
const BOUNDED_DISCRETE_START_RATIO: f64 = 0.30;
const MIN_WEIGHTED_HISTORY_ENTRIES: usize = 5;
const LOAD_PROMOTION_REP_DROP: i32 = 2;
const FLOAT_TOLERANCE: f64 = 1e-9;
const WINDOW_WEIGHTS_3_5: &[(usize, f64)] = &[(3, 0.6), (5, 0.4)];
const WINDOW_WEIGHTS_3_5_8: &[(usize, f64)] = &[(3, 0.5), (5, 0.3), (8, 0.2)];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LoadStepDirection {
    Increase,
    Decrease,
}

#[derive(Debug, Clone)]
pub(crate) struct HistoricalProgressionSample {
    pub(crate) reps: i32,
    pub(crate) load_value: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NextSetPlan {
    pub(crate) set_index: i32,
    pub(crate) set_side: String,
}

pub(crate) struct SuggestedSetInput<'a> {
    pub(crate) repetition_kind: &'a str,
    pub(crate) selected_station_id: Option<&'a str>,
    pub(crate) load_input_mode: Option<&'a str>,
    pub(crate) profile_loads: &'a [f64],
    pub(crate) from_rules: Option<ActiveWorkoutSet>,
    pub(crate) no_load_option_selection: bool,
    pub(crate) no_load_prior_repetition_value: Option<i32>,
    pub(crate) enough_data_for_load_progression: bool,
    pub(crate) enough_data_for_reps_progression: bool,
    pub(crate) rep_min: Option<i32>,
    pub(crate) rep_max: Option<i32>,
    pub(crate) weighted_progression_history: &'a [HistoricalProgressionSample],
    pub(crate) set_index: i32,
    pub(crate) set_side: &'a str,
}

fn approx_eq(left: f64, right: f64) -> bool {
    (left - right).abs() <= FLOAT_TOLERANCE
}

pub(crate) fn step_profile_load(
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

pub(crate) fn snap_to_profile_load(profile_loads_kg: &[f64], current_load_kg: f64) -> Option<f64> {
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

pub(crate) fn suggest_profile_start_load(profile_loads_kg: &[f64]) -> Option<f64> {
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

pub(crate) fn default_suggested_set(repetition_kind: &str) -> ActiveWorkoutSet {
    let repetition_value =
        if normalize_repetition_kind(Some(repetition_kind)) == REPETITION_KIND_SECS {
            None
        } else {
            Some(DEFAULT_REPS)
        };

    ActiveWorkoutSet {
        set_index: 1,
        set_side: "BILATERAL".to_owned(),
        load_value: FREE_MODE_DEFAULT_LOAD_KG,
        repetition_value,
    }
}

pub(crate) fn profile_start_suggested_set(
    profile_loads_kg: &[f64],
    repetition_kind: &str,
) -> Option<ActiveWorkoutSet> {
    let repetition_value =
        if normalize_repetition_kind(Some(repetition_kind)) == REPETITION_KIND_SECS {
            None
        } else {
            Some(DEFAULT_REPS)
        };

    suggest_profile_start_load(profile_loads_kg).map(|load_value| ActiveWorkoutSet {
        set_index: 1,
        set_side: "BILATERAL".to_owned(),
        load_value,
        repetition_value,
    })
}

pub(crate) fn map_suggestion_to_station_profile(
    suggestion: ActiveWorkoutSet,
    load_input_mode: Option<&str>,
    profile_loads: &[f64],
    suggestion_uses_profile_units: bool,
) -> ActiveWorkoutSet {
    let profile_candidate = match (load_input_mode, suggestion_uses_profile_units) {
        (Some("PER_SIDE"), true) => suggestion.load_value,
        (Some("PER_SIDE"), false) => suggestion.load_value / 2.0,
        _ => suggestion.load_value,
    };
    let Some(snapped_load) = snap_to_profile_load(profile_loads, profile_candidate) else {
        return suggestion;
    };

    let canonical_snapped_load = match load_input_mode {
        Some("PER_SIDE") => snapped_load * 2.0,
        _ => snapped_load,
    };

    ActiveWorkoutSet {
        set_index: suggestion.set_index,
        set_side: suggestion.set_side,
        load_value: canonical_snapped_load,
        repetition_value: suggestion.repetition_value,
    }
}

pub(crate) fn valid_rep_bounds(rep_min: Option<i32>, rep_max: Option<i32>) -> Option<(i32, i32)> {
    match (rep_min, rep_max) {
        (Some(min), Some(max)) if min < max => Some((min, max)),
        _ => None,
    }
}

fn clamp_reps(value: i32, rep_min: i32, rep_max: i32) -> i32 {
    value.clamp(rep_min, rep_max)
}

fn weighted_windows_for_history_count(history_count: usize) -> &'static [(usize, f64)] {
    if history_count >= 8 {
        WINDOW_WEIGHTS_3_5_8
    } else {
        WINDOW_WEIGHTS_3_5
    }
}

fn weighted_average(values: &[f64], windows: &[(usize, f64)]) -> Option<f64> {
    if values.is_empty() {
        return None;
    }

    let mut weighted_total = 0.0;
    let mut total_weight = 0.0;

    for &(window, weight) in windows {
        if values.len() < window {
            continue;
        }
        let avg = values.iter().take(window).sum::<f64>() / window as f64;
        weighted_total += avg * weight;
        total_weight += weight;
    }

    if total_weight <= FLOAT_TOLERANCE {
        None
    } else {
        Some(weighted_total / total_weight)
    }
}

fn canonical_to_profile_units(load_value: f64, load_input_mode: Option<&str>) -> f64 {
    if matches!(load_input_mode, Some("PER_SIDE")) {
        load_value / 2.0
    } else {
        load_value
    }
}

fn profile_to_canonical_units(load_value: f64, load_input_mode: Option<&str>) -> f64 {
    if matches!(load_input_mode, Some("PER_SIDE")) {
        load_value * 2.0
    } else {
        load_value
    }
}

pub(crate) fn clamp_profile_loads_to_max(profile_loads: &[f64], max_load_kg: f64) -> Vec<f64> {
    profile_loads
        .iter()
        .copied()
        .filter(|load| *load <= max_load_kg + FLOAT_TOLERANCE)
        .collect()
}

pub(crate) fn build_weighted_progression_suggestion(
    history: &[HistoricalProgressionSample],
    rep_min: i32,
    rep_max: i32,
    fallback_suggestion: &ActiveWorkoutSet,
    load_input_mode: Option<&str>,
    profile_loads: &[f64],
) -> Option<ActiveWorkoutSet> {
    if history.len() < MIN_WEIGHTED_HISTORY_ENTRIES {
        return None;
    }

    let windows = weighted_windows_for_history_count(history.len());
    let reps_values: Vec<f64> = history.iter().map(|sample| sample.reps as f64).collect();
    let weighted_reps = weighted_average(&reps_values, windows)?;
    let mut bounded_reps = clamp_reps(weighted_reps.round() as i32, rep_min, rep_max);

    if profile_loads.is_empty() {
        return Some(ActiveWorkoutSet {
            set_index: fallback_suggestion.set_index,
            set_side: fallback_suggestion.set_side.clone(),
            load_value: fallback_suggestion.load_value,
            repetition_value: Some(bounded_reps),
        });
    }

    let load_values: Vec<f64> = history
        .iter()
        .filter_map(|sample| sample.load_value)
        .collect();
    let weighted_load =
        weighted_average(&load_values, windows).unwrap_or(fallback_suggestion.load_value);
    let profile_candidate = canonical_to_profile_units(weighted_load, load_input_mode);
    let snapped_profile =
        snap_to_profile_load(profile_loads, profile_candidate).unwrap_or(profile_candidate);

    let mut final_profile_load = snapped_profile;
    if bounded_reps >= rep_max {
        if let Some(next_profile_load) =
            step_profile_load(profile_loads, snapped_profile, LoadStepDirection::Increase)
        {
            if next_profile_load > snapped_profile + FLOAT_TOLERANCE {
                final_profile_load = next_profile_load;
                bounded_reps = clamp_reps(bounded_reps - LOAD_PROMOTION_REP_DROP, rep_min, rep_max);
            }
        }
    }

    Some(ActiveWorkoutSet {
        set_index: fallback_suggestion.set_index,
        set_side: fallback_suggestion.set_side.clone(),
        load_value: profile_to_canonical_units(final_profile_load, load_input_mode),
        repetition_value: Some(bounded_reps),
    })
}

pub(crate) fn derive_next_set_plan(
    set_tracking_mode: Option<&str>,
    completed_sets: &[CompletedActiveWorkoutSet],
) -> NextSetPlan {
    match (
        set_tracking_mode,
        completed_sets.last().map(|set| set.set_side.as_str()),
        completed_sets.last().map(|set| set.set_index),
    ) {
        (Some("UNILATERAL"), Some("LEFT"), Some(last_index)) => NextSetPlan {
            set_index: last_index,
            set_side: "RIGHT".to_owned(),
        },
        (Some("UNILATERAL"), _, Some(last_index)) => NextSetPlan {
            set_index: last_index + 1,
            set_side: "LEFT".to_owned(),
        },
        (Some("UNILATERAL"), _, None) => NextSetPlan {
            set_index: 1,
            set_side: "LEFT".to_owned(),
        },
        (_, _, Some(last_index)) => NextSetPlan {
            set_index: last_index + 1,
            set_side: "BILATERAL".to_owned(),
        },
        (_, _, None) => NextSetPlan {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
        },
    }
}

pub(crate) fn derive_last_current(
    completed_sets: &[CompletedActiveWorkoutSet],
    selected_station_id: Option<&str>,
    repetition_kind: &str,
) -> Option<ActiveWorkoutSet> {
    completed_sets.last().and_then(|set| {
        if let Some(load_value) = set.load_value {
            return Some(ActiveWorkoutSet {
                set_index: set.set_index,
                set_side: set.set_side.clone(),
                load_value,
                repetition_value: set.repetition_value,
            });
        }
        if selected_station_id.is_none() {
            return Some(ActiveWorkoutSet {
                set_index: set.set_index,
                set_side: set.set_side.clone(),
                load_value: default_suggested_set(repetition_kind).load_value,
                repetition_value: set.repetition_value,
            });
        }
        None
    })
}

pub(crate) fn should_use_historical_suggestion_rules(repetition_kind: &str) -> bool {
    normalize_repetition_kind(Some(repetition_kind)) != REPETITION_KIND_SECS
}

pub(crate) fn can_use_weighted_reps_progression(
    repetition_kind: &str,
    enough_data_for_reps_progression: bool,
    rep_min: Option<i32>,
    rep_max: Option<i32>,
) -> bool {
    normalize_repetition_kind(Some(repetition_kind)) == REPETITION_KIND_REPS
        && enough_data_for_reps_progression
        && valid_rep_bounds(rep_min, rep_max).is_some()
}

pub(crate) fn build_suggested_set(input: SuggestedSetInput<'_>) -> ActiveWorkoutSet {
    let mut suggested_set = match (input.from_rules, input.selected_station_id) {
        (Some(suggestion), Some(_)) => map_suggestion_to_station_profile(
            suggestion,
            input.load_input_mode,
            input.profile_loads,
            false,
        ),
        (Some(suggestion), None) => suggestion,
        (None, Some(_)) => {
            let suggestion = if input.enough_data_for_load_progression {
                default_suggested_set(input.repetition_kind)
            } else {
                profile_start_suggested_set(input.profile_loads, input.repetition_kind)
                    .unwrap_or_else(|| default_suggested_set(input.repetition_kind))
            };
            map_suggestion_to_station_profile(
                suggestion,
                input.load_input_mode,
                input.profile_loads,
                true,
            )
        }
        (None, None) => default_suggested_set(input.repetition_kind),
    };

    suggested_set.set_index = input.set_index;
    suggested_set.set_side = input.set_side.to_owned();

    if let Some(repetition_value) = input.no_load_prior_repetition_value {
        suggested_set.repetition_value = Some(repetition_value);
    } else if normalize_repetition_kind(Some(input.repetition_kind)) == REPETITION_KIND_SECS
        && !input.no_load_option_selection
    {
        suggested_set.repetition_value = None;
    }

    if can_use_weighted_reps_progression(
        input.repetition_kind,
        input.enough_data_for_reps_progression,
        input.rep_min,
        input.rep_max,
    ) {
        let (rep_min, rep_max) = valid_rep_bounds(input.rep_min, input.rep_max)
            .expect("rep bounds were checked before weighted progression");
        if let Some(progressed) = build_weighted_progression_suggestion(
            input.weighted_progression_history,
            rep_min,
            rep_max,
            &suggested_set,
            input.load_input_mode,
            input.profile_loads,
        ) {
            suggested_set.load_value = progressed.load_value;
            suggested_set.repetition_value = progressed.repetition_value;
        }
    }

    suggested_set
}

#[cfg(test)]
mod tests {
    use super::{
        build_suggested_set, build_weighted_progression_suggestion, default_suggested_set,
        derive_next_set_plan, map_suggestion_to_station_profile, profile_start_suggested_set,
        snap_to_profile_load, step_profile_load, HistoricalProgressionSample, LoadStepDirection,
        SuggestedSetInput, FORMULA_BASELINE_LOAD_KG,
    };
    use crate::domain::{ActiveWorkoutSet, CompletedActiveWorkoutSet};

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
        let suggested = profile_start_suggested_set(&bounded_discrete, "REPS")
            .expect("bounded discrete profile should produce suggestion");

        assert_eq!(suggested.load_value, 12.5);
        assert_eq!(suggested.repetition_value, Some(10));
    }

    #[test]
    fn profile_start_suggestion_for_formula_uses_twenty_or_next_above_twenty() {
        let with_20 = [10.0, 15.0, FORMULA_BASELINE_LOAD_KG, 25.0];
        let suggested_with_20 = profile_start_suggested_set(&with_20, "REPS")
            .expect("formula profile with 20 should produce suggestion");
        assert_eq!(suggested_with_20.load_value, FORMULA_BASELINE_LOAD_KG);

        let without_20 = [7.5, 12.5, 17.5, 22.5, 27.5];
        let suggested_without_20 = profile_start_suggested_set(&without_20, "REPS")
            .expect("formula profile without 20 should produce suggestion");
        assert_eq!(suggested_without_20.load_value, 22.5);
    }

    #[test]
    fn default_suggested_set_for_secs_omits_repetition_value() {
        let suggested = default_suggested_set("SECS");
        assert_eq!(suggested.repetition_value, None);
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

    #[test]
    fn map_suggestion_to_station_profile_keeps_total_mode_behavior() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 31.2,
            repetition_value: Some(8),
        };
        let profile_loads = [10.0, 12.5, 15.0, 20.0, 30.0];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("TOTAL"), &profile_loads, false);
        assert_eq!(mapped.load_value, 30.0);
        assert_eq!(mapped.repetition_value, Some(8));
    }

    #[test]
    fn map_suggestion_to_station_profile_converts_per_side_and_returns_canonical_total() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 31.2,
            repetition_value: Some(8),
        };
        let profile_loads = [10.0, 12.5, 15.0, 20.0, 30.0];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("PER_SIDE"), &profile_loads, false);
        assert_eq!(mapped.load_value, 30.0);
        assert_eq!(mapped.repetition_value, Some(8));
    }

    #[test]
    fn map_suggestion_to_station_profile_preserves_per_side_profile_units_for_start_suggestions() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 12.5,
            repetition_value: Some(10),
        };
        let profile_loads = [2.5, 6.25, 12.5, 17.5];

        let mapped =
            map_suggestion_to_station_profile(suggestion, Some("PER_SIDE"), &profile_loads, true);
        assert_eq!(mapped.load_value, 25.0);
        assert_eq!(mapped.repetition_value, Some(10));
    }

    #[test]
    fn map_suggestion_to_station_profile_falls_back_to_nearest_lower_clamped_load() {
        let suggestion = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 230.0,
            repetition_value: Some(8),
        };
        let clamped_profile_loads = [185.0, 195.0];

        let mapped = map_suggestion_to_station_profile(
            suggestion,
            Some("TOTAL"),
            &clamped_profile_loads,
            false,
        );
        assert_eq!(mapped.load_value, 195.0);
        assert_eq!(mapped.repetition_value, Some(8));
    }

    #[test]
    fn derive_next_set_plan_preserves_unilateral_side_sequence() {
        let completed = [CompletedActiveWorkoutSet {
            set_index: 2,
            set_side: "LEFT".to_owned(),
            load_value: Some(10.0),
            repetition_value: Some(8),
        }];

        let plan = derive_next_set_plan(Some("UNILATERAL"), &completed);

        assert_eq!(plan.set_index, 2);
        assert_eq!(plan.set_side, "RIGHT");
    }

    #[test]
    fn weighted_progression_promotes_load_when_reps_reach_upper_bound() {
        let history = vec![
            HistoricalProgressionSample {
                reps: 12,
                load_value: Some(20.0),
            },
            HistoricalProgressionSample {
                reps: 12,
                load_value: Some(20.0),
            },
            HistoricalProgressionSample {
                reps: 12,
                load_value: Some(20.0),
            },
            HistoricalProgressionSample {
                reps: 12,
                load_value: Some(20.0),
            },
            HistoricalProgressionSample {
                reps: 12,
                load_value: Some(20.0),
            },
        ];
        let fallback = ActiveWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            load_value: 20.0,
            repetition_value: Some(10),
        };
        let profile_loads = [10.0, 20.0, 25.0];

        let suggested = build_weighted_progression_suggestion(
            &history,
            8,
            12,
            &fallback,
            Some("TOTAL"),
            &profile_loads,
        )
        .expect("weighted history should produce suggestion");

        assert_eq!(suggested.load_value, 25.0);
        assert_eq!(suggested.repetition_value, Some(10));
    }

    #[test]
    fn build_suggested_set_preserves_timed_sets_without_repetition_value() {
        let suggested = build_suggested_set(SuggestedSetInput {
            repetition_kind: "SECS",
            selected_station_id: None,
            load_input_mode: None,
            profile_loads: &[],
            from_rules: Some(ActiveWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                load_value: 10.0,
                repetition_value: Some(30),
            }),
            no_load_option_selection: false,
            no_load_prior_repetition_value: None,
            enough_data_for_load_progression: false,
            enough_data_for_reps_progression: false,
            rep_min: None,
            rep_max: None,
            weighted_progression_history: &[],
            set_index: 1,
            set_side: "BILATERAL",
        });

        assert_eq!(suggested.repetition_value, None);
    }

    #[test]
    fn build_suggested_set_preserves_stationless_timed_current_fallback_without_prior_history() {
        let suggested = build_suggested_set(SuggestedSetInput {
            repetition_kind: "SECS",
            selected_station_id: None,
            load_input_mode: None,
            profile_loads: &[],
            from_rules: Some(ActiveWorkoutSet {
                set_index: 1,
                set_side: "BILATERAL".to_owned(),
                load_value: 10.0,
                repetition_value: Some(50),
            }),
            no_load_option_selection: true,
            no_load_prior_repetition_value: None,
            enough_data_for_load_progression: false,
            enough_data_for_reps_progression: false,
            rep_min: None,
            rep_max: None,
            weighted_progression_history: &[],
            set_index: 2,
            set_side: "BILATERAL",
        });

        assert_eq!(suggested.set_index, 2);
        assert_eq!(suggested.repetition_value, Some(50));
    }
}
