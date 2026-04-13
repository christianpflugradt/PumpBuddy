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
    if let Ok(parsed) = OffsetDateTime::parse(timestamp, &Rfc3339) {
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

    if timestamp.ends_with(" UTC") {
        return timestamp.to_owned();
    }

    "1970-01-01 00:00 UTC".to_owned()
}
