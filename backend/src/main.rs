use pumpbuddy_backend::{
    api::{app_router, print_help, AppState},
    application::build_metadata::current_build_metadata,
    persistence::DomainRepository,
};
use sqlx::postgres::PgPoolOptions;
use std::{env, net::SocketAddr};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MAX_LOG_VALUE_LEN: usize = 180;

fn formatted_timestamp_utc() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn sanitize_log_value(value: &str) -> String {
    let mut out = String::with_capacity(value.len().min(MAX_LOG_VALUE_LEN) + 8);

    for ch in value.chars() {
        let mapped = match ch {
            '\n' | '\r' => ' ',
            _ => ch,
        };
        out.push(mapped);
        if out.len() >= MAX_LOG_VALUE_LEN {
            out.truncate(MAX_LOG_VALUE_LEN);
            out.push_str("...");
            break;
        }
    }

    out.replace('\\', "\\\\").replace('"', "\\\"")
}

fn log_event(event: &str, fields: &[(&str, String)]) {
    let mut line = format!("{} event={event}", formatted_timestamp_utc());

    for (key, value) in fields {
        line.push(' ');
        line.push_str(key);
        line.push_str("=\"");
        line.push_str(&sanitize_log_value(value));
        line.push('"');
    }

    eprintln!("{line}");
}

#[tokio::main]
async fn main() {
    let build_metadata = current_build_metadata();
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        print_help();
        return;
    }

    let host = env::var("BACKEND_HOST").unwrap_or_else(|_| "0.0.0.0".to_owned());
    let port = env::var("BACKEND_PORT").unwrap_or_else(|_| "8080".to_owned());
    let bind_addr = format!("{host}:{port}");

    let addr: SocketAddr = bind_addr
        .parse()
        .unwrap_or_else(|err: std::net::AddrParseError| {
            log_event(
                "backend_startup_failed",
                &[
                    ("application_version", build_metadata.app_version.to_owned()),
                    ("reason", "invalid_bind_address".to_owned()),
                    ("bind_address", bind_addr.clone()),
                    ("error", err.to_string()),
                ],
            );
            std::process::exit(2);
        });

    let database_url = match env::var("DATABASE_URL") {
        Ok(value) => value,
        Err(_) => {
            log_event(
                "backend_startup_failed",
                &[
                    ("application_version", build_metadata.app_version.to_owned()),
                    ("reason", "missing_database_url".to_owned()),
                ],
            );
            std::process::exit(2);
        }
    };

    let db_pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .unwrap_or_else(|err| {
            log_event(
                "backend_startup_failed",
                &[
                    ("application_version", build_metadata.app_version.to_owned()),
                    ("reason", "database_connect_failed".to_owned()),
                    ("error", err.to_string()),
                ],
            );
            std::process::exit(1);
        });

    let app = app_router(AppState {
        repository: DomainRepository::new(db_pool),
    });

    let listener =
        tokio::net::TcpListener::bind(addr)
            .await
            .unwrap_or_else(|err: std::io::Error| {
                log_event(
                    "backend_bind_failed",
                    &[
                        ("application_version", build_metadata.app_version.to_owned()),
                        ("bind_address", addr.to_string()),
                        ("error", err.to_string()),
                    ],
                );
                std::process::exit(1);
            });

    log_event(
        "backend_startup_successful",
        &[
            ("application_version", build_metadata.app_version.to_owned()),
            ("bind_address", addr.to_string()),
        ],
    );

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap_or_else(|err: std::io::Error| {
        log_event(
            "backend_runtime_failed",
            &[
                ("application_version", build_metadata.app_version.to_owned()),
                ("bind_address", addr.to_string()),
                ("error", err.to_string()),
            ],
        );
        std::process::exit(1);
    });
}
