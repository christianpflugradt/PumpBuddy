import { execFileSync } from "node:child_process";
import { verifyRelease as verifySourceRelease } from "./source-guard.mjs";

export function verifyRelease(_config, context) {
  const env = context.env ?? process.env;
  verifySourceRelease(_config, context);
  const execution = { cwd: context.cwd, env, encoding: "utf8" };
  execFileSync("python3", ["agent/scripts/release/artifacts.py", "verify"], execution);
}

export function prepare(config, context) {
  const execution = { cwd: context.cwd, env: context.env ?? process.env, stdio: "inherit" };
  execFileSync("python3", ["agent/scripts/release/artifacts.py", "load"], execution);
  // Recheck main after loading, immediately before Semantic Release tags the source.
  verifyRelease(config, context);
}

export function publish(_config, context) {
  execFileSync("python3", ["agent/scripts/release/artifacts.py", "publish"], {
    cwd: context.cwd, env: context.env ?? process.env, stdio: "inherit",
  });
}
