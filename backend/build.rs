fn main() {
    println!("cargo:rerun-if-env-changed=APP_VERSION");

    let app_version = std::env::var("APP_VERSION")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            std::env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0-dev".to_owned())
        });

    println!("cargo:rustc-env=PUMPBUDDY_APP_VERSION={app_version}");
}
