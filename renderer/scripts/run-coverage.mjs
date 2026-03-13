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
const outputLines = output.split(/\r?\n/);
const normalizeCoverageLine = (line) => line.replace(/^#\s*/, "").trim();
const headerLine = outputLines.find((line) => {
  const normalized = normalizeCoverageLine(line);
  return /file\s*\|/i.test(normalized) && /branch/i.test(normalized);
});
const summaryLine = outputLines.find((line) => {
  const normalized = normalizeCoverageLine(line);
  return /^all files\s*\|/i.test(normalized);
});

if (!summaryLine) {
  process.stderr.write("renderer coverage output did not include all files summary\n");
  process.exit(result.status ?? 1);
}

const normalizedSummaryLine = normalizeCoverageLine(summaryLine);
const normalizedHeaderLine = headerLine ? normalizeCoverageLine(headerLine) : "";
const summaryColumns = normalizedSummaryLine.split("|").map((column) => column.trim());
const headerColumns = normalizedHeaderLine
  ? normalizedHeaderLine.split("|").map((column) => column.trim())
  : [];
const branchColumnIndex = headerColumns.findIndex((column) => /branch/i.test(column));

let percentString = summaryColumns[branchColumnIndex];

if (!percentString) {
  const numericMatches = normalizedSummaryLine.match(/(\d+(?:\.\d+)?)/g) ?? [];
  percentString = numericMatches[1] ?? numericMatches[0];
}

const percent = Number.parseFloat(percentString ?? "");

if (Number.isNaN(percent)) {
  process.stderr.write("renderer coverage output did not include branch coverage\n");
  process.exit(result.status ?? 1);
}
const badgeResult = spawnSync(
  "python3",
  [
    badgeScriptPath,
    badgeJsonPath,
    "renderer branch coverage",
    percent.toFixed(2),
    "branch",
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
