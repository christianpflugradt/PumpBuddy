mod auth;
pub(crate) mod error;
mod handlers;
mod router;
mod middleware;
pub(crate) mod models;

use crate::persistence::DomainRepository;

pub use error::{map_persistence_error, ApiError};
pub use router::app_router;

#[derive(Clone)]
pub struct AppState {
    pub repository: DomainRepository,
}

pub fn print_help() {
    println!("PumpBuddy backend");
    println!();
    println!("Environment variables:");
    println!("  BACKEND_HOST  Host interface to bind (default: 0.0.0.0)");
    println!("  BACKEND_PORT  TCP port to bind (default: 8080)");
    println!("  DATABASE_URL  PostgreSQL connection string (required)");
    println!();
    println!("Usage:");
    println!("  pumpbuddy-backend");
    println!("  pumpbuddy-backend --help");
}
