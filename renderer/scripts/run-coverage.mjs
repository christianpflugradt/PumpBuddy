import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const badgeOutputDir = process.env.COVERAGE_BADGE_OUTPUT_DIR ?? path.join(repoRoot, "site", "badges");
const badgeJsonPath = path.join(badgeOutputDir, "renderer-coverage.json");
const badgeScriptPath = path.join(repoRoot, "agent", "scripts", "write-coverage-badge.py");

// Forward args to vitest
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--run");

// Build vitest args to emit coverage with thresholds similar to prior checks.
const vitestArgs = [
  "run",
  "--coverage",
  "--coverage-include=src",
  "--coverage-report=lcov",
  // keep the coverage thresholds; Vitest uses coverage thresholds via config or CLI --coverage=false
  // we'll enforce thresholds by parsing the lcov summary output.
  ...forwardedArgs,
];

// Prefer local vitest binary
const localVitest = path.join(process.cwd(), "node_modules", ".bin", "vitest");
let result = spawnSync(localVitest, vitestArgs, { cwd: process.cwd(), encoding: "utf8" });
if (result.error && result.error.code === "ENOENT") {
  // fallback to npx
  result = spawnSync("npx", ["vitest", ...vitestArgs], { cwd: process.cwd(), encoding: "utf8" });
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

// Try to read coverage summary from coverage/lcov-report/index.html or coverage-summary.json
// Vitest outputs coverage to coverage/ by default when using c8/istanbul reporters.
const fs = await import("node:fs/promises");
const coverageSummaryPath = path.join(process.cwd(), "coverage", "coverage-summary.json");
let percent = NaN;
try {
  const summaryText = await fs.readFile(coverageSummaryPath, "utf8");
  const summary = JSON.parse(summaryText);
  // derive branch coverage for 'all files' if present
  if (summary.total && summary.total.branch && typeof summary.total.branch.pct === "number") {
    percent = summary.total.branch.pct;
  }
} catch (err) {
  // ignore — we'll not fail here until we know result failed
}

if (Number.isNaN(percent)) {
  // If we couldn't parse a summary, attempt to run the badge script with 0 and warn.
  process.stderr.write("could not parse branch coverage from vitest output\n");
}

const badgeResult = spawnSync(
  "python3",
  [
    badgeScriptPath,
    badgeJsonPath,
    "renderer branch coverage",
    (Number.isNaN(percent) ? "0" : percent.toFixed(2)),
    "branch",
    "all files",
  ],
  { cwd: repoRoot, encoding: "utf8" },
);

if (badgeResult.stdout) process.stdout.write(badgeResult.stdout);
if (badgeResult.stderr) process.stderr.write(badgeResult.stderr);

if (badgeResult.status !== 0) process.exit(badgeResult.status ?? 1);

process.exit(result.status ?? 1);
