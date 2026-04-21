#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EnumTranslationError {
    pub(crate) field: &'static str,
    pub(crate) value: String,
}

impl std::fmt::Display for EnumTranslationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Invalid persisted enum value '{}' for {}",
            self.value, self.field
        )
    }
}

impl std::error::Error for EnumTranslationError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RepetitionKind {
    Reps,
    Secs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LoadInputMode {
    Total,
    PerSide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SetTrackingMode {
    Bilateral,
    Unilateral,
}

pub(crate) fn repetition_kind(value: &str) -> Result<RepetitionKind, EnumTranslationError> {
    match value {
        "REPS" => Ok(RepetitionKind::Reps),
        "SECS" => Ok(RepetitionKind::Secs),
        invalid => Err(invalid_enum("repetition_kind", invalid)),
    }
}

pub(crate) fn repetition_kind_optional(
    value: Option<&str>,
) -> Result<Option<RepetitionKind>, EnumTranslationError> {
    value.map(repetition_kind).transpose()
}

pub(crate) fn load_input_mode(value: &str) -> Result<LoadInputMode, EnumTranslationError> {
    match value {
        "TOTAL" => Ok(LoadInputMode::Total),
        "PER_SIDE" => Ok(LoadInputMode::PerSide),
        invalid => Err(invalid_enum("load_input_mode", invalid)),
    }
}

pub(crate) fn load_input_mode_optional(
    value: Option<&str>,
) -> Result<Option<LoadInputMode>, EnumTranslationError> {
    value.map(load_input_mode).transpose()
}

pub(crate) fn set_tracking_mode(value: &str) -> Result<SetTrackingMode, EnumTranslationError> {
    match value {
        "BILATERAL" => Ok(SetTrackingMode::Bilateral),
        "UNILATERAL" => Ok(SetTrackingMode::Unilateral),
        invalid => Err(invalid_enum("set_tracking_mode", invalid)),
    }
}

pub(crate) fn set_tracking_mode_optional(
    value: Option<&str>,
) -> Result<Option<SetTrackingMode>, EnumTranslationError> {
    value.map(set_tracking_mode).transpose()
}

fn invalid_enum(field: &'static str, value: &str) -> EnumTranslationError {
    EnumTranslationError {
        field,
        value: value.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        load_input_mode, load_input_mode_optional, repetition_kind, repetition_kind_optional,
        set_tracking_mode, set_tracking_mode_optional, LoadInputMode, RepetitionKind,
        SetTrackingMode,
    };

    #[test]
    fn translation_helpers_accept_known_values() {
        assert_eq!(repetition_kind("REPS").unwrap(), RepetitionKind::Reps);
        assert_eq!(repetition_kind("SECS").unwrap(), RepetitionKind::Secs);
        assert_eq!(load_input_mode("TOTAL").unwrap(), LoadInputMode::Total);
        assert_eq!(load_input_mode("PER_SIDE").unwrap(), LoadInputMode::PerSide);
        assert_eq!(
            set_tracking_mode("BILATERAL").unwrap(),
            SetTrackingMode::Bilateral
        );
        assert_eq!(
            set_tracking_mode("UNILATERAL").unwrap(),
            SetTrackingMode::Unilateral
        );
    }

    #[test]
    fn translation_helpers_reject_unknown_values() {
        let repetition_kind_error = repetition_kind("METERS").expect_err("must fail");
        assert_eq!(repetition_kind_error.field, "repetition_kind");
        assert_eq!(repetition_kind_error.value, "METERS");

        let load_input_mode_error = load_input_mode("ONE_SIDE").expect_err("must fail");
        assert_eq!(load_input_mode_error.field, "load_input_mode");
        assert_eq!(load_input_mode_error.value, "ONE_SIDE");

        let set_tracking_mode_error = set_tracking_mode("SINGLE").expect_err("must fail");
        assert_eq!(set_tracking_mode_error.field, "set_tracking_mode");
        assert_eq!(set_tracking_mode_error.value, "SINGLE");
    }

    #[test]
    fn optional_helpers_preserve_none_and_fail_on_unknown_values() {
        assert_eq!(repetition_kind_optional(None).unwrap(), None);
        assert_eq!(load_input_mode_optional(None).unwrap(), None);
        assert_eq!(set_tracking_mode_optional(None).unwrap(), None);

        let repetition_kind_error =
            repetition_kind_optional(Some("UNKNOWN")).expect_err("must fail");
        assert_eq!(repetition_kind_error.field, "repetition_kind");

        let load_input_mode_error =
            load_input_mode_optional(Some("UNKNOWN")).expect_err("must fail");
        assert_eq!(load_input_mode_error.field, "load_input_mode");

        let set_tracking_mode_error =
            set_tracking_mode_optional(Some("UNKNOWN")).expect_err("must fail");
        assert_eq!(set_tracking_mode_error.field, "set_tracking_mode");
    }
}
