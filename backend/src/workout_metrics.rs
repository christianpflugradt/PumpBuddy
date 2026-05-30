use crate::domain::{
    normalize_repetition_kind, NewWorkoutSet, WorkoutExercisesPerformanceGroup,
    WorkoutExercisesPerformanceRow, WorkoutExercisesPersonalRecordEntry,
    WorkoutExercisesPersonalRecords12m, WorkoutExercisesScoreTrend30d,
    WorkoutExercisesScoreTrendPoint, WorkoutExercisesStrengthMetricMode,
    WorkoutExercisesStrengthPoint, WorkoutExercisesStrengthProgression12m, REPETITION_KIND_REPS,
};
use crate::performance::{
    classify_average_with_scored_entry_gate, tone_rank, MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION,
    PERFORMANCE_TONE_ORDER,
};
use std::collections::{HashMap, HashSet};

const LOAD_MILLI_SCALE: i128 = 1_000;
const MIN_WORKOUT_PROGRESS_RATIO: f64 = 0.70;
const MAX_WORKOUT_PROGRESS_RATIO: f64 = 1.20;

#[derive(Debug, Clone)]
pub(crate) struct ExercisePerformanceSample {
    pub(crate) workout_id: String,
    pub(crate) workout_exercise_id: String,
    pub(crate) variant_id: String,
    pub(crate) exercise_name: String,
    pub(crate) variant_name: String,
    pub(crate) station_id: Option<String>,
    pub(crate) completed_at: String,
    pub(crate) completed_at_ordering: String,
    pub(crate) last_performed_days_ago: i32,
    pub(crate) exercise_position: i32,
    pub(crate) repetition_kind: String,
    pub(crate) performance_score: Option<i32>,
    pub(crate) baseline: Option<i32>,
}

impl ExercisePerformanceSample {
    fn progress_score(&self) -> Option<f64> {
        compute_progress_ratio(self.performance_score, self.baseline)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct StrengthSampleSetRow {
    pub(crate) variant_id: String,
    pub(crate) repetition_kind: String,
    pub(crate) completed_at: String,
    pub(crate) workout_id: String,
    pub(crate) station_id: Option<String>,
    pub(crate) station_label: Option<String>,
    pub(crate) load_kg: Option<f64>,
    pub(crate) repetition_value: Option<i32>,
}

#[derive(Debug, Clone)]
struct LastPerformedSummaryRef {
    completed_at: String,
    completed_at_ordering: String,
    workout_exercise_id: String,
    workout_id: String,
    exercise_position: i32,
    repetition_kind: String,
    last_performed_days_ago: i32,
}

#[derive(Debug, Clone)]
struct StationSelectionAggregate {
    scored_sample_count: usize,
    most_recent_completed_at_ordering: String,
    station_id: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct FirstSetSummary {
    pub(crate) load_kg: Option<f64>,
    pub(crate) repetition_value: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PerformanceScoreFormula {
    LoadReps,
    LoadSecs,
    TotalReps,
    TotalSecs,
}

fn saturating_i128_to_i32(value: i128) -> i32 {
    if value <= i32::MIN as i128 {
        i32::MIN
    } else if value >= i32::MAX as i128 {
        i32::MAX
    } else {
        value as i32
    }
}

fn sum_weighted_score(sets: &[NewWorkoutSet]) -> Option<i32> {
    let mut total_milli: i128 = 0;
    let mut has_weighted_data = false;

    for set in sets {
        let (Some(load_kg), Some(repetition_value)) = (set.load_canonical_kg, set.repetition_value)
        else {
            continue;
        };

        let load_milli = (load_kg * LOAD_MILLI_SCALE as f64).round() as i128;
        total_milli += load_milli * repetition_value as i128;
        has_weighted_data = true;
    }

    if !has_weighted_data {
        return None;
    }

    Some(saturating_i128_to_i32(total_milli / LOAD_MILLI_SCALE))
}

fn sum_total_repetition_value(sets: &[NewWorkoutSet]) -> Option<i32> {
    let mut total: i128 = 0;
    let mut has_repetition_data = false;

    for set in sets {
        if let Some(repetition_value) = set.repetition_value {
            total += repetition_value as i128;
            has_repetition_data = true;
        }
    }

    if !has_repetition_data {
        return None;
    }

    Some(saturating_i128_to_i32(total))
}

fn selected_performance_formula(
    sets: &[NewWorkoutSet],
    repetition_kind: &str,
) -> Option<PerformanceScoreFormula> {
    let normalized_repetition_kind = normalize_repetition_kind(Some(repetition_kind));
    let has_weighted_data = sets
        .iter()
        .any(|set| set.load_canonical_kg.is_some() && set.repetition_value.is_some());
    let has_repetition_data = sets.iter().any(|set| set.repetition_value.is_some());

    if normalized_repetition_kind == REPETITION_KIND_REPS {
        if has_weighted_data {
            Some(PerformanceScoreFormula::LoadReps)
        } else if has_repetition_data {
            Some(PerformanceScoreFormula::TotalReps)
        } else {
            None
        }
    } else if has_weighted_data {
        Some(PerformanceScoreFormula::LoadSecs)
    } else if has_repetition_data {
        Some(PerformanceScoreFormula::TotalSecs)
    } else {
        None
    }
}

pub(crate) fn compute_performance_score(
    sets: &[NewWorkoutSet],
    repetition_kind: &str,
) -> Option<i32> {
    match selected_performance_formula(sets, repetition_kind) {
        Some(PerformanceScoreFormula::LoadReps | PerformanceScoreFormula::LoadSecs) => {
            sum_weighted_score(sets)
        }
        Some(PerformanceScoreFormula::TotalReps | PerformanceScoreFormula::TotalSecs) => {
            sum_total_repetition_value(sets)
        }
        None => None,
    }
}

fn compute_progress_ratio(score: Option<i32>, baseline: Option<i32>) -> Option<f64> {
    let score = score?;
    let baseline = baseline?;
    if baseline <= 0 {
        return None;
    }

    Some(
        (score as f64 / baseline as f64)
            .clamp(MIN_WORKOUT_PROGRESS_RATIO, MAX_WORKOUT_PROGRESS_RATIO),
    )
}

fn format_load_kg(load_kg: f64) -> String {
    if (load_kg.fract()).abs() <= f64::EPSILON {
        format!("{:.0}", load_kg)
    } else {
        let mut text = format!("{load_kg:.3}");
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
        text
    }
}

fn first_set_display(summary: Option<&FirstSetSummary>, repetition_kind: &str) -> String {
    let Some(summary) = summary else {
        return "No set data".to_owned();
    };

    let repetition_label =
        if normalize_repetition_kind(Some(repetition_kind)) == REPETITION_KIND_REPS {
            "reps"
        } else {
            "secs"
        };

    match (summary.load_kg, summary.repetition_value) {
        (Some(load_kg), Some(repetition_value)) => {
            format!(
                "{} kg x {} {}",
                format_load_kg(load_kg),
                repetition_value,
                repetition_label
            )
        }
        (Some(load_kg), None) => format!("{} kg", format_load_kg(load_kg)),
        (None, Some(repetition_value)) => format!("{repetition_value} {repetition_label}"),
        (None, None) => "No set data".to_owned(),
    }
}

fn estimate_epley_1rm(load_kg: f64, reps: i32) -> f64 {
    load_kg * (1.0 + (reps as f64 / 30.0))
}

fn resolve_station_label(station_label: Option<&str>) -> String {
    match station_label {
        Some(value) if !value.trim().is_empty() => value.to_owned(),
        _ => "Unknown station".to_owned(),
    }
}

fn derive_strength_progression_by_variant(
    rows: &[StrengthSampleSetRow],
) -> HashMap<String, WorkoutExercisesStrengthProgression12m> {
    #[derive(Debug, Clone)]
    struct SessionAggregate {
        variant_id: String,
        repetition_kind: String,
        occurred_at: String,
        workout_id: String,
        station_id: Option<String>,
        station_label: String,
        max_load_kg: Option<f64>,
        max_reps: Option<i32>,
        max_seconds: Option<i32>,
        max_estimated_1rm: Option<f64>,
    }

    let mut by_session: HashMap<(String, String), SessionAggregate> = HashMap::new();
    for row in rows {
        let key = (row.variant_id.clone(), row.workout_id.clone());
        let entry = by_session.entry(key).or_insert_with(|| SessionAggregate {
            variant_id: row.variant_id.clone(),
            repetition_kind: normalize_repetition_kind(Some(&row.repetition_kind)).to_owned(),
            occurred_at: row.completed_at.clone(),
            workout_id: row.workout_id.clone(),
            station_id: row.station_id.clone(),
            station_label: resolve_station_label(row.station_label.as_deref()),
            max_load_kg: None,
            max_reps: None,
            max_seconds: None,
            max_estimated_1rm: None,
        });

        if let Some(load_kg) = row.load_kg {
            entry.max_load_kg = Some(
                entry
                    .max_load_kg
                    .map_or(load_kg, |current| current.max(load_kg)),
            );
        }

        if let Some(repetition_value) = row.repetition_value {
            if entry.repetition_kind == REPETITION_KIND_REPS {
                entry.max_reps = Some(
                    entry
                        .max_reps
                        .map_or(repetition_value, |current| current.max(repetition_value)),
                );
                if let Some(load_kg) = row.load_kg {
                    let estimated = estimate_epley_1rm(load_kg, repetition_value);
                    entry.max_estimated_1rm = Some(
                        entry
                            .max_estimated_1rm
                            .map_or(estimated, |current| current.max(estimated)),
                    );
                }
            } else {
                entry.max_seconds = Some(
                    entry
                        .max_seconds
                        .map_or(repetition_value, |current| current.max(repetition_value)),
                );
            }
        }
    }

    let mut sessions_by_variant: HashMap<String, Vec<SessionAggregate>> = HashMap::new();
    for session in by_session.into_values() {
        sessions_by_variant
            .entry(session.variant_id.clone())
            .or_default()
            .push(session);
    }

    let mut result = HashMap::new();
    for (variant_id, mut sessions) in sessions_by_variant {
        sessions.sort_by(|left, right| {
            left.occurred_at
                .cmp(&right.occurred_at)
                .then_with(|| left.workout_id.cmp(&right.workout_id))
        });

        let mut station_counts: HashMap<Option<String>, usize> = HashMap::new();
        let mut station_latest_at: HashMap<Option<String>, String> = HashMap::new();
        for session in &sessions {
            *station_counts
                .entry(session.station_id.clone())
                .or_insert(0) += 1;
            let latest = station_latest_at
                .entry(session.station_id.clone())
                .or_insert_with(|| session.occurred_at.clone());
            if session.occurred_at > *latest {
                *latest = session.occurred_at.clone();
            }
        }

        let primary_station_id = station_counts
            .into_iter()
            .max_by(
                |(left_station_id, left_count), (right_station_id, right_count)| {
                    left_count.cmp(right_count).then_with(|| {
                        station_latest_at
                            .get(left_station_id)
                            .cmp(&station_latest_at.get(right_station_id))
                    })
                },
            )
            .map(|(station_id, _)| station_id)
            .unwrap_or(None);

        let repetition_kind = sessions
            .first()
            .map(|session| session.repetition_kind.clone())
            .unwrap_or_else(|| REPETITION_KIND_REPS.to_owned());
        let has_any_load = sessions.iter().any(|session| session.max_load_kg.is_some());

        let mut metric_modes = Vec::new();
        if repetition_kind == REPETITION_KIND_REPS {
            if has_any_load {
                let points: Vec<WorkoutExercisesStrengthPoint> = sessions
                    .iter()
                    .filter_map(|session| {
                        session
                            .max_load_kg
                            .map(|value| WorkoutExercisesStrengthPoint {
                                occurred_at: session.occurred_at.clone(),
                                value,
                                station_id: session.station_id.clone(),
                                station_label: Some(session.station_label.clone()),
                                is_primary_station: Some(session.station_id == primary_station_id),
                            })
                    })
                    .collect();
                if !points.is_empty() {
                    metric_modes.push(WorkoutExercisesStrengthMetricMode {
                        id: "weight".to_owned(),
                        label: "Weight".to_owned(),
                        family: "kg".to_owned(),
                        station_modes: vec!["primary".to_owned(), "all".to_owned()],
                        points,
                    });
                }

                let points_1rm: Vec<WorkoutExercisesStrengthPoint> = sessions
                    .iter()
                    .filter_map(|session| {
                        session
                            .max_estimated_1rm
                            .map(|value| WorkoutExercisesStrengthPoint {
                                occurred_at: session.occurred_at.clone(),
                                value,
                                station_id: session.station_id.clone(),
                                station_label: Some(session.station_label.clone()),
                                is_primary_station: Some(session.station_id == primary_station_id),
                            })
                    })
                    .collect();
                if !points_1rm.is_empty() {
                    metric_modes.push(WorkoutExercisesStrengthMetricMode {
                        id: "estimated-1rm".to_owned(),
                        label: "1RM".to_owned(),
                        family: "kg".to_owned(),
                        station_modes: vec!["primary".to_owned(), "all".to_owned()],
                        points: points_1rm,
                    });
                }
            } else {
                let points: Vec<WorkoutExercisesStrengthPoint> = sessions
                    .iter()
                    .filter_map(|session| {
                        session.max_reps.map(|value| WorkoutExercisesStrengthPoint {
                            occurred_at: session.occurred_at.clone(),
                            value: value as f64,
                            station_id: session.station_id.clone(),
                            station_label: Some(session.station_label.clone()),
                            is_primary_station: Some(session.station_id == primary_station_id),
                        })
                    })
                    .collect();
                if !points.is_empty() {
                    metric_modes.push(WorkoutExercisesStrengthMetricMode {
                        id: "reps".to_owned(),
                        label: "Reps".to_owned(),
                        family: "reps".to_owned(),
                        station_modes: vec!["primary".to_owned(), "all".to_owned()],
                        points,
                    });
                }
            }
        } else if has_any_load {
            let points: Vec<WorkoutExercisesStrengthPoint> = sessions
                .iter()
                .filter_map(|session| {
                    session
                        .max_load_kg
                        .map(|value| WorkoutExercisesStrengthPoint {
                            occurred_at: session.occurred_at.clone(),
                            value,
                            station_id: session.station_id.clone(),
                            station_label: Some(session.station_label.clone()),
                            is_primary_station: Some(session.station_id == primary_station_id),
                        })
                })
                .collect();
            if !points.is_empty() {
                metric_modes.push(WorkoutExercisesStrengthMetricMode {
                    id: "weight".to_owned(),
                    label: "Weight".to_owned(),
                    family: "kg".to_owned(),
                    station_modes: vec!["primary".to_owned(), "all".to_owned()],
                    points,
                });
            }
        } else {
            let points: Vec<WorkoutExercisesStrengthPoint> = sessions
                .iter()
                .filter_map(|session| {
                    session
                        .max_seconds
                        .map(|value| WorkoutExercisesStrengthPoint {
                            occurred_at: session.occurred_at.clone(),
                            value: value as f64,
                            station_id: session.station_id.clone(),
                            station_label: Some(session.station_label.clone()),
                            is_primary_station: Some(session.station_id == primary_station_id),
                        })
                })
                .collect();
            if !points.is_empty() {
                metric_modes.push(WorkoutExercisesStrengthMetricMode {
                    id: "time".to_owned(),
                    label: "Time".to_owned(),
                    family: "time".to_owned(),
                    station_modes: vec!["primary".to_owned(), "all".to_owned()],
                    points,
                });
            }
        }

        if !metric_modes.is_empty() {
            result.insert(
                variant_id,
                WorkoutExercisesStrengthProgression12m { metric_modes },
            );
        }
    }

    result
}

fn derive_personal_records_by_variant(
    rows: &[StrengthSampleSetRow],
) -> HashMap<String, WorkoutExercisesPersonalRecords12m> {
    const PERSONAL_RECORDS_ROW_LIMIT: usize = 10;
    const LOAD_BUCKET_PRECISION: f64 = 1000.0;

    let mut rows_by_variant: HashMap<String, Vec<&StrengthSampleSetRow>> = HashMap::new();
    for row in rows {
        if row.repetition_value.is_none() {
            continue;
        }
        rows_by_variant
            .entry(row.variant_id.clone())
            .or_default()
            .push(row);
    }

    let mut result = HashMap::new();
    for (variant_id, variant_rows) in rows_by_variant {
        let has_load = variant_rows.iter().any(|row| row.load_kg.is_some());
        let is_reps = variant_rows.iter().any(|row| {
            normalize_repetition_kind(Some(&row.repetition_kind)) == REPETITION_KIND_REPS
        });
        let metric_family = if has_load && is_reps {
            "load_x_reps"
        } else if has_load {
            "load_x_seconds"
        } else if is_reps {
            "reps_only"
        } else {
            "seconds_only"
        };

        let mut best_entries: Vec<&StrengthSampleSetRow> = Vec::new();
        if metric_family == "load_x_reps" || metric_family == "load_x_seconds" {
            let mut best_by_load: HashMap<i64, &StrengthSampleSetRow> = HashMap::new();
            for row in &variant_rows {
                let (Some(load_kg), Some(repetition_value)) = (row.load_kg, row.repetition_value)
                else {
                    continue;
                };
                let load_key = (load_kg * LOAD_BUCKET_PRECISION).round() as i64;
                let Some(existing) = best_by_load.get(&load_key).copied() else {
                    best_by_load.insert(load_key, row);
                    continue;
                };
                let existing_repetition_value = existing.repetition_value.unwrap_or_default();
                let should_replace = repetition_value > existing_repetition_value
                    || (repetition_value == existing_repetition_value
                        && row.completed_at > existing.completed_at);
                if should_replace {
                    best_by_load.insert(load_key, row);
                }
            }

            let mut unique_load_entries: Vec<&StrengthSampleSetRow> =
                best_by_load.into_values().collect();
            unique_load_entries.sort_by(|left, right| {
                right
                    .load_kg
                    .unwrap_or(f64::NEG_INFINITY)
                    .total_cmp(&left.load_kg.unwrap_or(f64::NEG_INFINITY))
                    .then_with(|| {
                        left.repetition_value
                            .unwrap_or_default()
                            .cmp(&right.repetition_value.unwrap_or_default())
                    })
                    .then_with(|| right.completed_at.cmp(&left.completed_at))
            });

            let mut last_kept_repetition_value: Option<i32> = None;
            for row in unique_load_entries {
                let repetition_value = row.repetition_value.unwrap_or_default();
                let should_keep = match last_kept_repetition_value {
                    Some(last_value) => repetition_value > last_value,
                    None => true,
                };
                if should_keep {
                    best_entries.push(row);
                    last_kept_repetition_value = Some(repetition_value);
                }
            }
            best_entries.truncate(PERSONAL_RECORDS_ROW_LIMIT);
        } else {
            let mut best_overall: Option<&StrengthSampleSetRow> = None;
            for row in &variant_rows {
                let Some(repetition_value) = row.repetition_value else {
                    continue;
                };
                let should_replace = match best_overall {
                    Some(existing) => {
                        let existing_repetition_value =
                            existing.repetition_value.unwrap_or_default();
                        repetition_value > existing_repetition_value
                            || (repetition_value == existing_repetition_value
                                && row.completed_at > existing.completed_at)
                    }
                    None => true,
                };
                if should_replace {
                    best_overall = Some(row);
                }
            }
            if let Some(best) = best_overall {
                best_entries.push(best);
            }
        }

        let entries = best_entries
            .into_iter()
            .filter_map(|row| {
                let repetition_value = row.repetition_value?;
                let normalized_kind = normalize_repetition_kind(Some(&row.repetition_kind));
                let reps = if normalized_kind == REPETITION_KIND_REPS {
                    Some(repetition_value)
                } else {
                    None
                };
                let seconds = if normalized_kind == REPETITION_KIND_REPS {
                    None
                } else {
                    Some(repetition_value)
                };

                Some(WorkoutExercisesPersonalRecordEntry {
                    occurred_at: row.completed_at.clone(),
                    load_kg: row.load_kg,
                    reps,
                    seconds,
                })
            })
            .collect::<Vec<_>>();

        if !entries.is_empty() {
            result.insert(
                variant_id,
                WorkoutExercisesPersonalRecords12m {
                    metric_family: metric_family.to_owned(),
                    entries,
                },
            );
        }
    }

    result
}

pub(crate) fn variant_ids_for_performance_samples(
    samples: &[ExercisePerformanceSample],
) -> Vec<String> {
    samples
        .iter()
        .map(|sample| sample.variant_id.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

fn last_performed_by_variant(
    samples: &[ExercisePerformanceSample],
) -> HashMap<String, LastPerformedSummaryRef> {
    let mut last_performed_by_variant: HashMap<String, LastPerformedSummaryRef> = HashMap::new();

    for sample in samples {
        let candidate = LastPerformedSummaryRef {
            completed_at: sample.completed_at.clone(),
            completed_at_ordering: sample.completed_at_ordering.clone(),
            workout_exercise_id: sample.workout_exercise_id.clone(),
            workout_id: sample.workout_id.clone(),
            exercise_position: sample.exercise_position,
            repetition_kind: sample.repetition_kind.clone(),
            last_performed_days_ago: sample.last_performed_days_ago,
        };
        match last_performed_by_variant.get(&sample.variant_id) {
            Some(existing)
                if existing.completed_at_ordering > candidate.completed_at_ordering
                    || (existing.completed_at_ordering == candidate.completed_at_ordering
                        && (existing.workout_id > candidate.workout_id
                            || (existing.workout_id == candidate.workout_id
                                && existing.exercise_position <= candidate.exercise_position))) => {
            }
            _ => {
                last_performed_by_variant.insert(sample.variant_id.clone(), candidate);
            }
        }
    }

    last_performed_by_variant
}

pub(crate) fn last_performed_workout_exercise_ids(
    samples: &[ExercisePerformanceSample],
) -> Vec<String> {
    last_performed_by_variant(samples)
        .values()
        .map(|summary| summary.workout_exercise_id.clone())
        .collect()
}

pub(crate) fn build_workout_exercises_performance_groups(
    samples: &[ExercisePerformanceSample],
    first_sets_by_exercise_id: &HashMap<String, FirstSetSummary>,
    strength_sample_rows: &[StrengthSampleSetRow],
) -> Vec<WorkoutExercisesPerformanceGroup> {
    let strength_progression_by_variant =
        derive_strength_progression_by_variant(strength_sample_rows);
    let personal_records_by_variant = derive_personal_records_by_variant(strength_sample_rows);

    let mut session_counts_by_variant: HashMap<String, HashSet<String>> = HashMap::new();
    let mut station_selection_by_variant: HashMap<
        String,
        HashMap<Option<String>, StationSelectionAggregate>,
    > = HashMap::new();
    let mut samples_by_variant_station: HashMap<
        (String, Option<String>),
        Vec<ExercisePerformanceSample>,
    > = HashMap::new();
    let mut variant_name_by_id: HashMap<String, String> = HashMap::new();
    let mut exercise_name_by_variant_id: HashMap<String, String> = HashMap::new();

    for sample in samples {
        session_counts_by_variant
            .entry(sample.variant_id.clone())
            .or_default()
            .insert(sample.workout_id.clone());

        variant_name_by_id
            .entry(sample.variant_id.clone())
            .or_insert_with(|| sample.variant_name.clone());
        exercise_name_by_variant_id
            .entry(sample.variant_id.clone())
            .or_insert_with(|| sample.exercise_name.clone());

        let station_selection = station_selection_by_variant
            .entry(sample.variant_id.clone())
            .or_default()
            .entry(sample.station_id.clone())
            .or_insert_with(|| StationSelectionAggregate {
                scored_sample_count: 0,
                most_recent_completed_at_ordering: sample.completed_at_ordering.clone(),
                station_id: sample.station_id.clone(),
            });
        if sample.progress_score().is_some() {
            station_selection.scored_sample_count += 1;
        }
        if sample.completed_at_ordering > station_selection.most_recent_completed_at_ordering {
            station_selection.most_recent_completed_at_ordering =
                sample.completed_at_ordering.clone();
        }

        samples_by_variant_station
            .entry((sample.variant_id.clone(), sample.station_id.clone()))
            .or_default()
            .push(sample.clone());
    }

    let last_performed_by_variant = last_performed_by_variant(samples);

    let mut rows: Vec<WorkoutExercisesPerformanceRow> = Vec::new();
    for (variant_id, station_aggregates) in station_selection_by_variant {
        let selected_station = station_aggregates
            .values()
            .max_by(|left, right| {
                left.scored_sample_count
                    .cmp(&right.scored_sample_count)
                    .then_with(|| {
                        left.most_recent_completed_at_ordering
                            .cmp(&right.most_recent_completed_at_ordering)
                    })
                    .then_with(|| left.station_id.cmp(&right.station_id))
            })
            .cloned();

        let Some(selected_station) = selected_station else {
            continue;
        };

        let selected_samples = samples_by_variant_station
            .get(&(variant_id.clone(), selected_station.station_id.clone()))
            .cloned()
            .unwrap_or_default();
        let scored_values: Vec<f64> = selected_samples
            .iter()
            .filter_map(|sample| sample.progress_score())
            .collect();

        let selected_station_average_score_30d = if scored_values.is_empty() {
            None
        } else {
            Some(scored_values.iter().sum::<f64>() / scored_values.len() as f64)
        };
        let classification = classify_average_with_scored_entry_gate(
            selected_station_average_score_30d,
            scored_values.len(),
            MIN_SCORED_ENTRIES_FOR_TONE_CLASSIFICATION,
        );
        let selected_station_average_score_30d = if classification.is_available() {
            selected_station_average_score_30d
        } else {
            None
        };
        let performance_tone = classification.tone.as_str().to_owned();
        let performance_status = classification.availability.as_str().to_owned();
        let score_trend_entries: Vec<WorkoutExercisesScoreTrendPoint> = selected_samples
            .iter()
            .filter_map(|sample| {
                sample
                    .progress_score()
                    .map(|score| WorkoutExercisesScoreTrendPoint {
                        occurred_at: sample.completed_at.clone(),
                        score,
                    })
            })
            .collect();

        let Some(last_performed) = last_performed_by_variant.get(&variant_id) else {
            continue;
        };
        let first_set_display = first_set_display(
            first_sets_by_exercise_id.get(&last_performed.workout_exercise_id),
            &last_performed.repetition_kind,
        );

        let variant_session_count_30d = session_counts_by_variant
            .get(&variant_id)
            .map_or(0_i32, |workout_ids| workout_ids.len() as i32);

        rows.push(WorkoutExercisesPerformanceRow {
            variant_id: variant_id.clone(),
            exercise_name: exercise_name_by_variant_id
                .get(&variant_id)
                .cloned()
                .unwrap_or_default(),
            variant_name: variant_name_by_id
                .get(&variant_id)
                .cloned()
                .unwrap_or_default(),
            last_performed_at: last_performed.completed_at.clone(),
            last_performed_days_ago: last_performed.last_performed_days_ago,
            last_performed_first_set_display: first_set_display,
            selected_station_average_score_30d,
            variant_session_count_30d,
            performance_status,
            performance_tone,
            score_trend_30d: if score_trend_entries.is_empty() {
                None
            } else {
                Some(WorkoutExercisesScoreTrend30d {
                    entries: score_trend_entries,
                })
            },
            strength_progression_12m: strength_progression_by_variant.get(&variant_id).cloned(),
            personal_records_12m: personal_records_by_variant.get(&variant_id).cloned(),
        });
    }

    rows.sort_by(|left, right| {
        tone_rank(&left.performance_tone)
            .cmp(&tone_rank(&right.performance_tone))
            .then_with(|| right.last_performed_at.cmp(&left.last_performed_at))
            .then_with(|| left.variant_name.cmp(&right.variant_name))
            .then_with(|| left.variant_id.cmp(&right.variant_id))
    });

    let mut grouped_rows: HashMap<String, Vec<WorkoutExercisesPerformanceRow>> = HashMap::new();
    for row in rows {
        grouped_rows
            .entry(row.performance_tone.clone())
            .or_default()
            .push(row);
    }

    PERFORMANCE_TONE_ORDER
        .into_iter()
        .filter_map(|tone| {
            grouped_rows
                .remove(tone)
                .map(|rows| WorkoutExercisesPerformanceGroup {
                    tone: tone.to_owned(),
                    rows,
                })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        build_workout_exercises_performance_groups, compute_performance_score, first_set_display,
        FirstSetSummary,
    };
    use crate::domain::NewWorkoutSet;
    use std::collections::HashMap;

    fn set(load_canonical_kg: Option<f64>, repetition_value: Option<i32>) -> NewWorkoutSet {
        NewWorkoutSet {
            set_index: 1,
            set_side: "BILATERAL".to_owned(),
            repetition_value,
            load_display_value: load_canonical_kg,
            load_display_unit: "kg".to_owned(),
            load_canonical_kg,
            completed_at: None,
        }
    }

    #[test]
    fn performance_score_uses_weighted_load_when_available() {
        let sets = [set(Some(12.5), Some(8)), set(Some(15.0), Some(6))];

        assert_eq!(compute_performance_score(&sets, "REPS"), Some(190));
    }

    #[test]
    fn performance_score_falls_back_to_total_repetition_value() {
        let sets = [set(None, Some(8)), set(None, Some(6))];

        assert_eq!(compute_performance_score(&sets, "REPS"), Some(14));
    }

    #[test]
    fn performance_score_returns_none_without_usable_set_data() {
        let sets = [set(Some(10.0), None), set(None, None)];

        assert_eq!(compute_performance_score(&sets, "REPS"), None);
    }

    #[test]
    fn first_set_display_preserves_repetition_kind_and_compact_load_formatting() {
        let summary = FirstSetSummary {
            load_kg: Some(12.5),
            repetition_value: Some(30),
        };

        assert_eq!(
            first_set_display(Some(&summary), "SECS"),
            "12.5 kg x 30 secs"
        );
        assert_eq!(first_set_display(None, "REPS"), "No set data");
    }

    #[test]
    fn performance_groups_build_gray_projection_when_scored_entries_are_under_gate() {
        let samples = vec![
            super::ExercisePerformanceSample {
                workout_id: "w1".to_owned(),
                workout_exercise_id: "we1".to_owned(),
                variant_id: "v1".to_owned(),
                exercise_name: "Press".to_owned(),
                variant_name: "Machine".to_owned(),
                station_id: Some("s1".to_owned()),
                completed_at: "2026-01-01T00:00:00Z".to_owned(),
                completed_at_ordering: "2026-01-01T00:00:00Z".to_owned(),
                last_performed_days_ago: 1,
                exercise_position: 1,
                repetition_kind: "REPS".to_owned(),
                performance_score: Some(100),
                baseline: Some(100),
            },
            super::ExercisePerformanceSample {
                workout_id: "w2".to_owned(),
                workout_exercise_id: "we2".to_owned(),
                variant_id: "v1".to_owned(),
                exercise_name: "Press".to_owned(),
                variant_name: "Machine".to_owned(),
                station_id: Some("s1".to_owned()),
                completed_at: "2026-01-02T00:00:00Z".to_owned(),
                completed_at_ordering: "2026-01-02T00:00:00Z".to_owned(),
                last_performed_days_ago: 0,
                exercise_position: 1,
                repetition_kind: "REPS".to_owned(),
                performance_score: Some(110),
                baseline: Some(100),
            },
        ];
        let first_sets = HashMap::from([(
            "we2".to_owned(),
            FirstSetSummary {
                load_kg: Some(20.0),
                repetition_value: Some(8),
            },
        )]);

        let groups = build_workout_exercises_performance_groups(&samples, &first_sets, &[]);

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].tone, "GRAY");
        assert_eq!(groups[0].rows[0].performance_status, "NOT_ENOUGH_DATA");
        assert_eq!(
            groups[0].rows[0].last_performed_first_set_display,
            "20 kg x 8 reps"
        );
    }
}
