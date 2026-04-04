#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum ProgressionEntryPoint {
    Reps,
    Load,
}

pub(super) fn enough_data_for_progression(_entry_point: ProgressionEntryPoint) -> bool {
    false
}

pub(super) fn enough_data_for_reps_progression() -> bool {
    enough_data_for_progression(ProgressionEntryPoint::Reps)
}

pub(super) fn enough_data_for_load_progression() -> bool {
    enough_data_for_progression(ProgressionEntryPoint::Load)
}

#[cfg(test)]
mod tests {
    use super::{
        enough_data_for_load_progression, enough_data_for_progression,
        enough_data_for_reps_progression, ProgressionEntryPoint,
    };

    #[test]
    fn enough_data_for_progression_is_false_for_reps_entry_point() {
        assert!(!enough_data_for_progression(ProgressionEntryPoint::Reps));
    }

    #[test]
    fn enough_data_for_progression_is_false_for_load_entry_point() {
        assert!(!enough_data_for_progression(ProgressionEntryPoint::Load));
    }

    #[test]
    fn dedicated_reps_progression_entrypoint_returns_false() {
        assert!(!enough_data_for_reps_progression());
    }

    #[test]
    fn dedicated_load_progression_entrypoint_returns_false() {
        assert!(!enough_data_for_load_progression());
    }
}
