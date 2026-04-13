use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MAX_VALUE_LEN: usize = 180;

fn formatted_timestamp_utc() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn sanitize_value(value: &str) -> String {
    let mut out = String::with_capacity(value.len().min(MAX_VALUE_LEN) + 8);

    for ch in value.chars() {
        let mapped = match ch {
            '\n' | '\r' => ' ',
            _ => ch,
        };
        out.push(mapped);
        if out.len() >= MAX_VALUE_LEN {
            out.truncate(MAX_VALUE_LEN);
            out.push_str("...");
            break;
        }
    }

    out.replace('\\', "\\\\").replace('"', "\\\"")
}

pub(crate) fn log_business_warning(event: &str, fields: &[(&str, String)]) {
    let mut line = format!("{} event={event} level=\"warn\"", formatted_timestamp_utc());

    for (key, value) in fields {
        let cleaned = sanitize_value(value);
        line.push(' ');
        line.push_str(key);
        line.push_str("=\"");
        line.push_str(&cleaned);
        line.push('"');
    }

    eprintln!("{line}");
}
