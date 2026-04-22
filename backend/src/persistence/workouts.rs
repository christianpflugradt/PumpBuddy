use super::{logging, progression, DomainRepository, PersistenceError};
use crate::domain::{
    normalize_repetition_kind, NewWorkout, NewWorkoutSet, Workout, WorkoutDetail,
    WorkoutDetailCompletionStats, WorkoutDetailExercise, WorkoutDetailHero, WorkoutDetailSetLine,
    WorkoutExercise, WorkoutExercisesPerformanceGroup, WorkoutExercisesPerformanceRow,
    WorkoutHistorySummary, WorkoutProgressEntry, WorkoutSet, WorkoutSummary, REPETITION_KIND_REPS,
};
use sqlx::Row;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

const LOAD_MILLI_SCALE: i128 = 1_000;
const MIN_WORKOUT_PROGRESS_RATIO: f64 = 0.70;
const MAX_WORKOUT_PROGRESS_RATIO: f64 = 1.20;
const MIN_SCORED_SAMPLES_FOR_EXERCISES_PERFORMANCE: usize = 3;

#[derive(Debug, Clone)]
struct ExercisePerformanceSample {
    workout_id: String,
    workout_exercise_id: String,
    variant_id: String,
    variant_name: String,
    station_id: Option<String>,
    completed_at: String,
    completed_at_ordering: String,
    last_performed_days_ago: i32,
    exercise_position: i32,
    repetition_kind: String,
    progress_score: Option<f64>,
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
struct FirstSetSummary {
    load_kg: Option<f64>,
    repetition_value: Option<i32>,
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
        let (Some(load_kg), Some(repetition_value)) = (set.load_canonical_kg, set.reps) else {
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
        if let Some(repetition_value) = set.reps {
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
        .any(|set| set.load_canonical_kg.is_some() && set.reps.is_some());
    let has_repetition_data = sets.iter().any(|set| set.reps.is_some());

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

pub(super) fn compute_performance_score(
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

fn tone_from_average(value: Option<f64>) -> &'static str {
    match value {
        None => "GRAY",
        Some(score) if score < 0.95 => "RED",
        Some(score) if score <= 1.03 => "YELLOW",
        Some(_) => "GREEN",
    }
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

fn tone_rank(tone: &str) -> i32 {
    match tone {
        "GREEN" => 0,
        "YELLOW" => 1,
        "RED" => 2,
        "GRAY" => 3,
        _ => 4,
    }
}

pub(super) async fn fetch_workout_history(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<WorkoutHistorySummary>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            g.name AS gym_name,
            CASE
                WHEN w.started_at IS NOT NULL
                     AND w.completed_at IS NOT NULL
                     AND w.completed_at > w.started_at
                    THEN GREATEST(
                        1,
                        FLOOR(EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0)::bigint
                    )
                ELSE 1
            END AS duration_minutes
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         WHERE w.user_id = $1::uuid
         ORDER BY COALESCE(w.completed_at, w.started_at, w.created_at) DESC, w.id DESC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| WorkoutHistorySummary {
            id: row.get("id"),
            training_plan_name: row.get("training_plan_name"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
            gym_name: row.get("gym_name"),
            duration_minutes: row.get("duration_minutes"),
        })
        .collect())
}

pub(super) async fn fetch_workout_progress(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<WorkoutProgressEntry>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.completed_at::text AS completed_at
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         WHERE w.user_id = $1::uuid
           AND w.completed_at IS NOT NULL
           AND w.completed_at >= (NOW() - INTERVAL '30 days')
         ORDER BY w.completed_at ASC, w.id ASC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut entries = Vec::with_capacity(rows.len());
    for row in rows {
        let workout_id: String = row.get("id");
        let exercise_scores_by_id =
            fetch_exercise_scores_by_workout_exercise_id(repository, &workout_id, user_id).await?;
        let baseline_by_exercise_id =
            fetch_historical_baseline_max_by_workout_exercise(repository, &workout_id, user_id)
                .await?;
        let workout_progress =
            progression::compute_workout_progress(&exercise_scores_by_id, &baseline_by_exercise_id);

        entries.push(WorkoutProgressEntry {
            id: workout_id,
            training_plan_name: row.get("training_plan_name"),
            completed_at: row.get("completed_at"),
            workout_progress,
        });
    }

    Ok(entries)
}

pub(super) async fn fetch_workout_exercises_performance(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<WorkoutExercisesPerformanceGroup>, PersistenceError> {
    let samples = fetch_in_window_exercise_performance_samples(repository, user_id).await?;
    if samples.is_empty() {
        return Ok(Vec::new());
    }

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
    let mut last_performed_by_variant: HashMap<String, LastPerformedSummaryRef> = HashMap::new();

    for sample in &samples {
        session_counts_by_variant
            .entry(sample.variant_id.clone())
            .or_default()
            .insert(sample.workout_id.clone());

        variant_name_by_id
            .entry(sample.variant_id.clone())
            .or_insert_with(|| sample.variant_name.clone());

        let station_selection = station_selection_by_variant
            .entry(sample.variant_id.clone())
            .or_default()
            .entry(sample.station_id.clone())
            .or_insert_with(|| StationSelectionAggregate {
                scored_sample_count: 0,
                most_recent_completed_at_ordering: sample.completed_at_ordering.clone(),
                station_id: sample.station_id.clone(),
            });
        if sample.progress_score.is_some() {
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

    let exercise_ids_for_first_sets: Vec<String> = last_performed_by_variant
        .values()
        .map(|summary| summary.workout_exercise_id.clone())
        .collect();
    let first_sets_by_exercise_id =
        fetch_first_set_summaries(repository, user_id, &exercise_ids_for_first_sets).await?;

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
            .filter_map(|sample| sample.progress_score)
            .collect();

        let selected_station_average_score_30d =
            if scored_values.len() >= MIN_SCORED_SAMPLES_FOR_EXERCISES_PERFORMANCE {
                Some(scored_values.iter().sum::<f64>() / scored_values.len() as f64)
            } else {
                None
            };
        let performance_tone = tone_from_average(selected_station_average_score_30d).to_owned();
        let performance_status = if selected_station_average_score_30d.is_some() {
            "AVAILABLE".to_owned()
        } else {
            "NOT_ENOUGH_DATA".to_owned()
        };

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

    let tone_order = ["GREEN", "YELLOW", "RED", "GRAY"];
    let groups = tone_order
        .into_iter()
        .filter_map(|tone| {
            grouped_rows
                .remove(tone)
                .map(|rows| WorkoutExercisesPerformanceGroup {
                    tone: tone.to_owned(),
                    rows,
                })
        })
        .collect();

    Ok(groups)
}

async fn fetch_in_window_exercise_performance_samples(
    repository: &DomainRepository,
    user_id: &str,
) -> Result<Vec<ExercisePerformanceSample>, PersistenceError> {
    let rows = sqlx::query(
        "SELECT
            w.id::text AS workout_id,
            we.id::text AS workout_exercise_id,
            we.selected_variant_id::text AS variant_id,
            ev.name AS variant_name,
            we.selected_station_id::text AS station_id,
            w.completed_at::text AS completed_at,
            w.completed_at::text AS completed_at_ordering,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - w.completed_at)) / 86400.0)::int AS last_performed_days_ago,
            we.position AS exercise_position,
            COALESCE(ev.repetition_kind, 'REPS') AS repetition_kind,
            we.performance_score AS performance_score,
            historical.max_historical_performance_score AS max_historical_performance_score
        FROM workouts w
        JOIN workout_exercises we
          ON we.workout_id = w.id
         AND we.user_id = $1::uuid
        JOIN exercise_variants ev ON ev.id = we.selected_variant_id
        LEFT JOIN LATERAL (
            SELECT MAX(we_historical.performance_score) AS max_historical_performance_score
            FROM workouts w_historical
            JOIN workout_exercises we_historical ON we_historical.workout_id = w_historical.id
            WHERE w_historical.user_id = $1::uuid
              AND we_historical.user_id = $1::uuid
              AND w_historical.completed_at IS NOT NULL
              AND w_historical.completed_at < w.completed_at
              AND we_historical.performance_score IS NOT NULL
              AND we_historical.selected_variant_id = we.selected_variant_id
              AND (
                    (we_historical.selected_station_id IS NULL AND we.selected_station_id IS NULL)
                    OR we_historical.selected_station_id = we.selected_station_id
              )
        ) historical ON TRUE
        WHERE w.user_id = $1::uuid
          AND w.completed_at IS NOT NULL
          AND w.completed_at >= (NOW() - INTERVAL '30 days')
          AND we.selected_variant_id IS NOT NULL
        ORDER BY w.completed_at DESC, w.id DESC, we.position ASC, we.id ASC",
    )
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| {
            let performance_score: Option<i32> = row.get("performance_score");
            let baseline: Option<i32> = row.get("max_historical_performance_score");
            ExercisePerformanceSample {
                workout_id: row.get("workout_id"),
                workout_exercise_id: row.get("workout_exercise_id"),
                variant_id: row.get("variant_id"),
                variant_name: row.get("variant_name"),
                station_id: row.get("station_id"),
                completed_at: row.get("completed_at"),
                completed_at_ordering: row.get("completed_at_ordering"),
                last_performed_days_ago: row.get("last_performed_days_ago"),
                exercise_position: row.get("exercise_position"),
                repetition_kind: row.get("repetition_kind"),
                progress_score: compute_progress_ratio(performance_score, baseline),
            }
        })
        .collect())
}

async fn fetch_first_set_summaries(
    repository: &DomainRepository,
    user_id: &str,
    workout_exercise_ids: &[String],
) -> Result<HashMap<String, FirstSetSummary>, PersistenceError> {
    if workout_exercise_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let parsed_ids: Vec<Uuid> = workout_exercise_ids
        .iter()
        .filter_map(|id| id.parse::<Uuid>().ok())
        .collect();
    if parsed_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = sqlx::query(
        "SELECT
            ws.workout_exercise_id::text AS workout_exercise_id,
            ws.load_canonical_kg::double precision AS load_kg,
            ws.repetition_value AS repetition_value
         FROM workout_sets ws
         WHERE ws.user_id = $1::uuid
           AND ws.workout_exercise_id = ANY($2)
         ORDER BY
            ws.workout_exercise_id ASC,
            ws.set_index ASC,
            CASE ws.set_side
                WHEN 'LEFT' THEN 0
                WHEN 'RIGHT' THEN 1
                WHEN 'BILATERAL' THEN 2
                ELSE 3
            END ASC",
    )
    .bind(user_id)
    .bind(&parsed_ids)
    .fetch_all(&repository.pool)
    .await?;

    let mut first_sets_by_exercise_id: HashMap<String, FirstSetSummary> = HashMap::new();
    for row in rows {
        let workout_exercise_id: String = row.get("workout_exercise_id");
        first_sets_by_exercise_id
            .entry(workout_exercise_id)
            .or_insert_with(|| FirstSetSummary {
                load_kg: row.get("load_kg"),
                repetition_value: row.get("repetition_value"),
            });
    }

    Ok(first_sets_by_exercise_id)
}

async fn fetch_exercise_scores_by_workout_exercise_id(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<HashMap<String, Option<i32>>, PersistenceError> {
    let exercise_score_rows = sqlx::query(
        "SELECT
            id::text AS workout_exercise_id,
            performance_score
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    Ok(exercise_score_rows
        .into_iter()
        .map(|exercise_row| {
            (
                exercise_row.get("workout_exercise_id"),
                exercise_row.get("performance_score"),
            )
        })
        .collect())
}

pub(super) async fn fetch_workout_summary(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutSummary>, PersistenceError> {
    let maybe_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.id::text AS training_plan_id,
            tp.name AS training_plan_name,
            w.gym_id::text AS gym_id,
            g.name AS gym_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            COUNT(DISTINCT we.id)::bigint AS exercise_count,
            COUNT(ws.id)::bigint AS completed_set_count
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         LEFT JOIN workout_exercises we ON we.workout_id = w.id
         LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid
         GROUP BY w.id, tp.id, tp.name, g.name",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(row) = maybe_row else {
        return Ok(None);
    };

    let exercise_scores_by_id =
        fetch_exercise_scores_by_workout_exercise_id(repository, workout_id, user_id).await?;

    let baseline_by_exercise_id =
        fetch_historical_baseline_max_by_workout_exercise(repository, workout_id, user_id).await?;
    let workout_progress =
        progression::compute_workout_progress(&exercise_scores_by_id, &baseline_by_exercise_id);
    let average_duration_minutes =
        fetch_average_duration_minutes_for_matching_history(repository, workout_id, user_id)
            .await?;

    Ok(Some(WorkoutSummary {
        id: row.get("id"),
        training_plan_id: row.get("training_plan_id"),
        training_plan_name: row.get("training_plan_name"),
        gym_id: row.get("gym_id"),
        gym_name: row.get("gym_name"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        exercise_count: row.get("exercise_count"),
        completed_set_count: row.get("completed_set_count"),
        average_duration_minutes,
        workout_progress,
    }))
}

pub(super) async fn fetch_workout_detail(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<WorkoutDetail>, PersistenceError> {
    let maybe_hero_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.name AS training_plan_name,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at,
            CASE
                WHEN w.started_at IS NOT NULL
                     AND w.completed_at IS NOT NULL
                     AND w.completed_at > w.started_at
                    THEN GREATEST(
                        1,
                        FLOOR(EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0)::bigint
                    )
                ELSE NULL
            END AS duration_minutes,
            g.name AS gym_name
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         LEFT JOIN gyms g ON g.id = w.gym_id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(hero_row) = maybe_hero_row else {
        return Ok(None);
    };

    let summary = fetch_workout_summary(repository, workout_id, user_id)
        .await?
        .ok_or_else(|| PersistenceError::NotFound("Workout not found".to_owned()))?;

    let exercise_rows = sqlx::query(
        "SELECT
            we.id::text AS workout_exercise_id,
            we.training_plan_exercise_id::text AS training_plan_exercise_id,
            we.position AS exercise_position,
            e.name AS exercise_name,
            ev.name AS variant_name,
            es.name AS station_name,
            ev.set_tracking_mode AS set_tracking_mode,
            ev.repetition_kind AS repetition_kind,
            ws.set_index AS set_index,
            ws.set_side AS set_side,
            ws.load_canonical_kg::double precision AS load_value,
            ws.repetition_value AS repetition_value
         FROM workout_exercises we
         JOIN training_plan_exercises tpe ON tpe.id = we.training_plan_exercise_id
         JOIN exercises e ON e.id = tpe.exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         LEFT JOIN equipment_stations es ON es.id = we.selected_station_id
         LEFT JOIN workout_sets ws
           ON ws.workout_exercise_id = we.id
          AND ws.user_id = $2::uuid
         WHERE we.workout_id = $1::uuid
           AND we.user_id = $2::uuid
         ORDER BY we.position ASC,
                  ws.set_index ASC NULLS LAST,
                  CASE ws.set_side
                      WHEN 'LEFT' THEN 0
                      WHEN 'RIGHT' THEN 1
                      WHEN 'BILATERAL' THEN 2
                      ELSE 3
                  END ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut exercises: Vec<WorkoutDetailExercise> = Vec::new();
    let mut exercise_index_by_id: HashMap<String, usize> = HashMap::new();

    for row in exercise_rows {
        let workout_exercise_id: String = row.get("workout_exercise_id");
        let exercise_index = match exercise_index_by_id.get(&workout_exercise_id).copied() {
            Some(index) => index,
            None => {
                let normalized_repetition_kind = row
                    .get::<Option<String>, _>("repetition_kind")
                    .as_deref()
                    .map(|kind| normalize_repetition_kind(Some(kind)).to_owned());
                let index = exercises.len();
                exercise_index_by_id.insert(workout_exercise_id, index);
                exercises.push(WorkoutDetailExercise {
                    training_plan_exercise_id: row.get("training_plan_exercise_id"),
                    exercise_position: row.get("exercise_position"),
                    exercise_name: row.get("exercise_name"),
                    variant_name: row.get("variant_name"),
                    station_name: row.get("station_name"),
                    set_tracking_mode: row.get("set_tracking_mode"),
                    repetition_kind: normalized_repetition_kind,
                    sets: Vec::new(),
                });
                index
            }
        };

        let maybe_set_index: Option<i32> = row.get("set_index");
        if let Some(set_index) = maybe_set_index {
            let normalized_set_repetition_kind = row
                .get::<Option<String>, _>("repetition_kind")
                .as_deref()
                .map(|kind| normalize_repetition_kind(Some(kind)).to_owned());
            exercises[exercise_index].sets.push(WorkoutDetailSetLine {
                set_index,
                set_side: row.get("set_side"),
                load_value: row.get("load_value"),
                repetition_kind: normalized_set_repetition_kind,
                repetition_value: row.get("repetition_value"),
            });
        }
    }

    let hero = WorkoutDetailHero {
        training_plan_name: hero_row.get("training_plan_name"),
        started_at: hero_row.get("started_at"),
        completed_at: hero_row.get("completed_at"),
        duration_minutes: hero_row.get("duration_minutes"),
        gym_name: hero_row.get("gym_name"),
    };

    let completion_stats = WorkoutDetailCompletionStats {
        exercise_count: summary.exercise_count,
        completed_set_count: summary.completed_set_count,
        average_duration_minutes: summary.average_duration_minutes,
        workout_progress: summary.workout_progress,
    };

    Ok(Some(WorkoutDetail {
        id: hero_row.get("id"),
        hero,
        completion_stats,
        exercises,
    }))
}

async fn fetch_average_duration_minutes_for_matching_history(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<i64>, PersistenceError> {
    let row = sqlx::query(
        "WITH current_workout AS (
            SELECT
              training_plan_version_id,
              gym_id,
              COALESCE(completed_at, started_at, created_at) AS comparison_cutoff
            FROM workouts
            WHERE id = $1::uuid
              AND user_id = $2::uuid
          ),
          recent_durations AS (
            SELECT
              EXTRACT(EPOCH FROM (w.completed_at - w.started_at)) / 60.0 AS duration_minutes
            FROM workouts w
            JOIN current_workout cw ON TRUE
            WHERE w.user_id = $2::uuid
              AND w.id <> $1::uuid
              AND w.training_plan_version_id = cw.training_plan_version_id
              AND (
                (cw.gym_id IS NULL AND w.gym_id IS NULL)
                OR w.gym_id = cw.gym_id
              )
              AND w.completed_at IS NOT NULL
              AND w.started_at IS NOT NULL
              AND w.completed_at > w.started_at
              AND w.completed_at < cw.comparison_cutoff
            ORDER BY w.completed_at DESC, w.id DESC
            LIMIT 10
          )
          SELECT ROUND(AVG(duration_minutes))::bigint AS average_duration_minutes
          FROM recent_durations",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_one(&repository.pool)
    .await?;

    Ok(row.get("average_duration_minutes"))
}

pub(super) async fn fetch_historical_baseline_max_by_workout_exercise(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<HashMap<String, i32>, PersistenceError> {
    let workout_exists = sqlx::query(
        "SELECT 1
         FROM workouts
         WHERE id = $1::uuid
           AND user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?
    .is_some();

    if !workout_exists {
        return Err(PersistenceError::NotFound("Workout not found".to_owned()));
    }

    let rows = sqlx::query(
        "SELECT
            we_current.id::text AS workout_exercise_id,
            historical.max_historical_performance_score AS max_historical_performance_score
         FROM workout_exercises we_current
         JOIN workouts w_current ON w_current.id = we_current.workout_id
         LEFT JOIN LATERAL (
            SELECT MAX(we_historical.performance_score) AS max_historical_performance_score
            FROM workouts w_historical
            JOIN workout_exercises we_historical ON we_historical.workout_id = w_historical.id
            WHERE w_historical.user_id = $2::uuid
              AND we_historical.user_id = $2::uuid
              AND w_historical.id <> $1::uuid
              AND w_historical.completed_at IS NOT NULL
              AND w_historical.completed_at >= (
                COALESCE(w_current.completed_at, w_current.started_at, w_current.created_at)
                - INTERVAL '30 days'
              )
              AND w_historical.completed_at < COALESCE(
                w_current.completed_at,
                w_current.started_at,
                w_current.created_at
              )
              AND we_historical.performance_score IS NOT NULL
              AND we_historical.selected_variant_id = we_current.selected_variant_id
              AND (
                (we_historical.selected_station_id IS NULL AND we_current.selected_station_id IS NULL)
                OR we_historical.selected_station_id = we_current.selected_station_id
              )
         ) historical ON TRUE
         WHERE we_current.workout_id = $1::uuid
           AND we_current.user_id = $2::uuid
           AND w_current.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let baseline_by_workout_exercise_id = rows
        .into_iter()
        .filter_map(|row| {
            let baseline: Option<i32> = row.get("max_historical_performance_score");
            baseline.map(|value| (row.get::<String, _>("workout_exercise_id"), value))
        })
        .collect();

    Ok(baseline_by_workout_exercise_id)
}

pub(super) async fn create_workout(
    repository: &DomainRepository,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<Workout, PersistenceError> {
    let mut tx = logging::begin_transaction(&repository.pool, "create_workout", "workout").await?;

    let workout_row = sqlx::query(
        "INSERT INTO workouts (
            training_plan_version_id,
            gym_id,
            started_at,
            completed_at,
            current_exercise_position,
            user_id
         )
         VALUES (
            (
                SELECT tpv.id
                FROM training_plan_versions tpv
                WHERE tpv.training_plan_id = $1::uuid
                ORDER BY tpv.version_number DESC, tpv.created_at DESC, tpv.id DESC
                LIMIT 1
            ),
            $2::uuid,
            $3::timestamptz,
            $4::timestamptz,
            $5,
            $6::uuid
         )
         RETURNING id::text AS id",
    )
    .bind(&new_workout.training_plan_id)
    .bind(new_workout.gym_id.as_deref())
    .bind(new_workout.started_at.as_deref())
    .bind(new_workout.completed_at.as_deref())
    .bind(new_workout.current_exercise_position)
    .bind(user_id)
    .fetch_one(&mut *tx)
    .await?;

    let workout_id: String = workout_row.get("id");

    insert_workout_progress(&mut tx, &workout_id, new_workout, user_id).await?;
    logging::commit_transaction(tx, "create_workout", "workout").await?;

    let created = fetch_workout(repository, &workout_id, user_id).await?;
    match created {
        Some(workout) => Ok(workout),
        None => Err(PersistenceError::Sqlx(sqlx::Error::RowNotFound)),
    }
}

pub(super) async fn insert_workout_progress(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workout_id: &str,
    new_workout: &NewWorkout,
    user_id: &str,
) -> Result<(), PersistenceError> {
    let selected_variant_ids: Vec<Uuid> = new_workout
        .exercises
        .iter()
        .filter_map(|exercise| {
            exercise
                .selected_variant_id
                .as_deref()
                .and_then(|id| id.parse().ok())
        })
        .collect();

    let repetition_kind_by_variant_id: HashMap<Uuid, String> = if selected_variant_ids.is_empty() {
        HashMap::new()
    } else {
        let rows = sqlx::query(
            "SELECT id, repetition_kind
             FROM exercise_variants
             WHERE id = ANY($1::uuid[])",
        )
        .bind(&selected_variant_ids)
        .fetch_all(&mut **tx)
        .await?;

        rows.into_iter()
            .map(|row| {
                (
                    row.get::<Uuid, _>("id"),
                    row.get::<String, _>("repetition_kind"),
                )
            })
            .collect()
    };

    let write_completion_scores = new_workout.completed_at.is_some();

    for exercise in &new_workout.exercises {
        // The current renderer may not yet submit final option/variant/station selections for
        // every exercise. Those nullable columns deliberately persist `NULL` until later work
        // replaces this temporary path with real user-selected references.
        // Prefer sending typed UUID parameters for optional ids to avoid
        // relying on Postgres string-to-uuid parsing which can produce
        // 22P02 errors if unexpected characters slip in. Parse here and
        // bind Option<uuid::Uuid> so the client driver sends a proper UUID
        // binary parameter when available.
        let selected_variant_uuid: Option<Uuid> = exercise
            .selected_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_station_uuid: Option<Uuid> = exercise
            .selected_station_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_plan_option_uuid: Option<Uuid> = exercise
            .selected_training_plan_exercise_variant_id
            .as_deref()
            .and_then(|s| s.parse().ok());
        let selected_repetition_kind = selected_variant_uuid
            .as_ref()
            .and_then(|variant_id| repetition_kind_by_variant_id.get(variant_id))
            .map(|kind| normalize_repetition_kind(Some(kind.as_str())))
            .unwrap_or(REPETITION_KIND_REPS);
        let completion_transition_marks_exercise_completed = exercise.completed_at.is_some()
            || (exercise.skipped_at.is_none() && !exercise.sets.is_empty());
        let performance_score =
            if write_completion_scores && completion_transition_marks_exercise_completed {
                compute_performance_score(&exercise.sets, selected_repetition_kind)
            } else {
                None
            };

        let workout_exercise_row = sqlx::query(
            "INSERT INTO workout_exercises (
                workout_id,
                training_plan_exercise_id,
                position,
                selected_variant_id,
                selected_station_id,
                selected_training_plan_exercise_variant_id,
                performance_score,
                skipped_at,
                completed_at,
                user_id
             )
             VALUES (
                $1::uuid,
                $2::uuid,
                $3,
                $4::uuid,
                $5::uuid,
                $6::uuid,
                $7,
                $8::timestamptz,
                COALESCE($9::timestamptz, $8::timestamptz, CASE WHEN $10 > 0 THEN NOW() ELSE NULL END),
                $11::uuid
             )
             RETURNING id::text AS id",
        )
        .bind(workout_id)
        .bind(&exercise.training_plan_exercise_id)
        .bind(exercise.position)
        .bind(selected_variant_uuid)
        .bind(selected_station_uuid)
        .bind(selected_plan_option_uuid)
        .bind(performance_score)
        .bind(exercise.skipped_at.as_deref())
        .bind(exercise.completed_at.as_deref())
        .bind(i32::try_from(exercise.sets.len()).unwrap_or(i32::MAX))
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

        let workout_exercise_id: String = workout_exercise_row.get("id");
        for set in &exercise.sets {
            let repetition_value = set.reps;
            sqlx::query(
                "INSERT INTO workout_sets (
                    workout_exercise_id,
                    set_index,
                    set_side,
                    repetition_value,
                    load_display_value,
                    load_display_unit,
                    load_canonical_kg,
                    completed_at,
                    user_id
                 )
                 VALUES (
                    $1::uuid,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    COALESCE($8::timestamptz, NOW()),
                    $9::uuid
                 )",
            )
            .bind(&workout_exercise_id)
            .bind(set.set_index)
            .bind(&set.set_side)
            .bind(repetition_value)
            .bind(set.load_display_value)
            .bind(&set.load_display_unit)
            .bind(set.load_canonical_kg)
            .bind(set.completed_at.as_deref())
            .bind(user_id)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

pub(super) async fn fetch_workout(
    repository: &DomainRepository,
    workout_id: &str,
    user_id: &str,
) -> Result<Option<Workout>, PersistenceError> {
    let maybe_workout_row = sqlx::query(
        "SELECT
            w.id::text AS id,
            tp.id::text AS training_plan_id,
            w.gym_id::text AS gym_id,
            w.started_at::text AS started_at,
            w.completed_at::text AS completed_at
         FROM workouts w
         JOIN training_plan_versions tpv ON tpv.id = w.training_plan_version_id
         JOIN training_plans tp ON tp.id = tpv.training_plan_id
         WHERE w.id = $1::uuid
           AND w.user_id = $2::uuid",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_optional(&repository.pool)
    .await?;

    let Some(workout_row) = maybe_workout_row else {
        return Ok(None);
    };

    let mut workout = Workout {
        id: workout_row.get("id"),
        training_plan_id: workout_row.get("training_plan_id"),
        gym_id: workout_row.get("gym_id"),
        started_at: workout_row.get("started_at"),
        completed_at: workout_row.get("completed_at"),
        exercises: Vec::new(),
    };

    let exercise_rows = sqlx::query(
        "SELECT
            id::text AS id,
            training_plan_exercise_id::text AS training_plan_exercise_id,
            position,
            selected_variant_id::text AS selected_variant_id,
            selected_station_id::text AS selected_station_id,
            selected_training_plan_exercise_variant_id::text AS selected_training_plan_exercise_variant_id,
            performance_score,
            skipped_at::text AS skipped_at,
            completed_at::text AS completed_at
         FROM workout_exercises
         WHERE workout_id = $1::uuid
           AND user_id = $2::uuid
         ORDER BY position ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    let mut index_by_workout_exercise_id = HashMap::new();

    for row in exercise_rows {
        let current_workout_exercise_id: String = row.get("id");
        index_by_workout_exercise_id
            .insert(current_workout_exercise_id.clone(), workout.exercises.len());

        workout.exercises.push(WorkoutExercise {
            id: current_workout_exercise_id,
            training_plan_exercise_id: row.get("training_plan_exercise_id"),
            position: row.get("position"),
            selected_variant_id: row.get("selected_variant_id"),
            selected_station_id: row.get("selected_station_id"),
            selected_training_plan_exercise_variant_id: row
                .get("selected_training_plan_exercise_variant_id"),
            performance_score: row.get("performance_score"),
            skipped_at: row.get("skipped_at"),
            completed_at: row.get("completed_at"),
            sets: Vec::new(),
        });
    }

    let set_rows = sqlx::query(
        "SELECT
            ws.id::text AS id,
            workout_exercise_id::text AS workout_exercise_id,
            set_index,
            set_side,
            ws.repetition_value AS repetition_value,
            COALESCE(ev.repetition_kind, 'REPS') AS repetition_kind,
            load_display_value::double precision AS load_display_value,
            load_display_unit,
            load_canonical_kg::double precision AS load_canonical_kg,
            ws.completed_at::text AS completed_at
         FROM workout_sets ws
         JOIN workout_exercises we ON we.id = ws.workout_exercise_id
         LEFT JOIN exercise_variants ev ON ev.id = we.selected_variant_id
         WHERE ws.workout_exercise_id IN (
            SELECT id
            FROM workout_exercises
            WHERE workout_id = $1::uuid
              AND user_id = $2::uuid
         )
           AND ws.user_id = $2::uuid
         ORDER BY ws.workout_exercise_id ASC,
                  ws.set_index ASC,
                  CASE ws.set_side WHEN 'LEFT' THEN 0 WHEN 'RIGHT' THEN 1 ELSE 2 END ASC",
    )
    .bind(workout_id)
    .bind(user_id)
    .fetch_all(&repository.pool)
    .await?;

    for row in set_rows {
        let set_workout_exercise_id: String = row.get("workout_exercise_id");
        if let Some(exercise_index) = index_by_workout_exercise_id.get(&set_workout_exercise_id) {
            let _set_repetition_kind =
                normalize_repetition_kind(Some(row.get::<String, _>("repetition_kind").as_str()));
            workout.exercises[*exercise_index].sets.push(WorkoutSet {
                id: row.get("id"),
                set_index: row.get("set_index"),
                set_side: row.get("set_side"),
                reps: row.get("repetition_value"),
                load_display_value: row.get::<Option<f64>, _>("load_display_value"),
                load_display_unit: row.get("load_display_unit"),
                load_canonical_kg: row.get::<Option<f64>, _>("load_canonical_kg"),
                completed_at: row.get("completed_at"),
            });
        }
    }

    Ok(Some(workout))
}
