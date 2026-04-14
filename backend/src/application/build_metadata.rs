use serde::Serialize;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const APP_VERSION: &str = env!("PUMPBUDDY_APP_VERSION");
const BUILD_COMMIT: &str = env!("PUMPBUDDY_BUILD_COMMIT");
const BUILD_TIMESTAMP: &str = env!("PUMPBUDDY_BUILD_TIMESTAMP");
const CHANNEL: &str = "stable";

#[derive(Clone, Copy, Debug, Serialize)]
pub struct BuildMetadata {
    pub app_version: &'static str,
    pub commit_hash: &'static str,
    pub build_timestamp: &'static str,
    pub channel: &'static str,
}

const BUILD_METADATA: BuildMetadata = BuildMetadata {
    app_version: APP_VERSION,
    commit_hash: BUILD_COMMIT,
    build_timestamp: BUILD_TIMESTAMP,
    channel: CHANNEL,
};

pub fn current_build_metadata() -> BuildMetadata {
    BUILD_METADATA
}

impl BuildMetadata {
    pub fn short_commit_hash(self) -> String {
        if self.commit_hash.len() <= 7 {
            return self.commit_hash.to_owned();
        }

        self.commit_hash.chars().take(7).collect()
    }
}

pub fn render_timestamp_utc(timestamp: &str) -> String {
    let normalized = timestamp.trim();

    if let Ok(parsed) = OffsetDateTime::parse(normalized, &Rfc3339) {
        let utc = parsed.to_offset(time::UtcOffset::UTC);
        return format!(
            "{:04}-{:02}-{:02} {:02}:{:02} UTC",
            utc.year(),
            u8::from(utc.month()),
            utc.day(),
            utc.hour(),
            utc.minute()
        );
    }

    if let Ok(epoch_seconds) = normalized.parse::<i64>() {
        if let Ok(parsed) = OffsetDateTime::from_unix_timestamp(epoch_seconds) {
            let utc = parsed.to_offset(time::UtcOffset::UTC);
            return format!(
                "{:04}-{:02}-{:02} {:02}:{:02} UTC",
                utc.year(),
                u8::from(utc.month()),
                utc.day(),
                utc.hour(),
                utc.minute()
            );
        }
    }

    if normalized.ends_with(" UTC") {
        return normalized.to_owned();
    }

    "1970-01-01 00:00 UTC".to_owned()
}

#[cfg(test)]
mod tests {
    use super::render_timestamp_utc;

    #[test]
    fn renders_rfc3339_timestamps_as_utc() {
        let rendered = render_timestamp_utc("2026-04-14T08:42:30+02:00");
        assert_eq!(rendered, "2026-04-14 06:42 UTC");
    }

    #[test]
    fn renders_unix_epoch_seconds_as_utc() {
        let rendered = render_timestamp_utc("1713076950");
        assert_eq!(rendered, "2024-04-14 06:42 UTC");
    }

    #[test]
    fn preserves_already_formatted_utc_timestamps() {
        let rendered = render_timestamp_utc("2026-04-14 06:42 UTC");
        assert_eq!(rendered, "2026-04-14 06:42 UTC");
    }
}
