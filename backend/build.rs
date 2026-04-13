fn main() {
    println!("cargo:rerun-if-env-changed=APP_VERSION");
    println!("cargo:rerun-if-env-changed=BUILD_COMMIT");
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
    println!("cargo:rerun-if-env-changed=BUILD_TIMESTAMP");
    println!("cargo:rerun-if-env-changed=SOURCE_DATE_EPOCH");

    let app_version = std::env::var("APP_VERSION")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            std::env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "0.0.0-dev".to_owned())
        });
    let build_commit = std::env::var("BUILD_COMMIT")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("GITHUB_SHA")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(git_head_commit)
        .unwrap_or_else(|| "unknown".to_owned());
    let build_timestamp = std::env::var("BUILD_TIMESTAMP")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("SOURCE_DATE_EPOCH")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(git_head_commit_timestamp)
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_owned());

    println!("cargo:rustc-env=PUMPBUDDY_APP_VERSION={app_version}");
    println!("cargo:rustc-env=PUMPBUDDY_BUILD_COMMIT={build_commit}");
    println!("cargo:rustc-env=PUMPBUDDY_BUILD_TIMESTAMP={build_timestamp}");
}

fn git_head_commit() -> Option<String> {
    run_git(&["rev-parse", "HEAD"])
}

fn git_head_commit_timestamp() -> Option<String> {
    run_git(&[
        "show",
        "--no-patch",
        "--date=iso-strict",
        "--format=%cd",
        "HEAD",
    ])
}

fn run_git(args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("git").args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_owned())
}
