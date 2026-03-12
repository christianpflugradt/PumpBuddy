import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareNodeTestEntry } from "./prepare-node-tests.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const badgeOutputDir = process.env.COVERAGE_BADGE_OUTPUT_DIR ?? path.join(repoRoot, "site", "badges");
const badgeJsonPath = path.join(badgeOutputDir, "renderer-coverage.json");
const badgeScriptPath = path.join(repoRoot, "agent", "scripts", "write-coverage-badge.py");

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--run");
const entryPoint = await prepareNodeTestEntry("./src/app.test.ts");
const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-branches=80",
    "--test-coverage-functions=80",
    "--test-coverage-lines=80",
    entryPoint,
    ...forwardedArgs,
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const lineCoverageMatch = output.match(/all files\s+\|\s+(\d+(?:\.\d+)?)/);

if (!lineCoverageMatch) {
  process.stderr.write("renderer coverage output did not include all files line coverage\n");
  process.exit(result.status ?? 1);
}

const percent = Number.parseFloat(lineCoverageMatch[1]);
const badgeResult = spawnSync(
  "python3",
  [
    badgeScriptPath,
    badgeJsonPath,
    "renderer line coverage",
    percent.toFixed(2),
    "line",
    "all files",
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);

if (badgeResult.stdout) {
  process.stdout.write(badgeResult.stdout);
}

if (badgeResult.stderr) {
  process.stderr.write(badgeResult.stderr);
}

if (badgeResult.status !== 0) {
  process.exit(badgeResult.status ?? 1);
}

process.exit(result.status ?? 1);
