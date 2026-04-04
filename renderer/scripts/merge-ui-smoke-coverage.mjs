import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const repoRoot = path.resolve(cwd, '..');
const coverageDir = path.join(cwd, 'coverage');
const baseCoveragePath = path.join(coverageDir, 'coverage-final.json');
const uiSmokeCoverageDir = path.join(coverageDir, 'ui-smoke');
const uiSmokeMergedPath = path.join(coverageDir, 'coverage-ui-smoke.json');
const mergedPath = path.join(coverageDir, 'coverage-merged.json');
const badgeOutputDir = process.env.COVERAGE_BADGE_OUTPUT_DIR ?? path.join(repoRoot, 'site', 'badges');
const badgeJsonPath = path.join(badgeOutputDir, 'renderer-coverage.json');
const badgeScriptPath = path.join(repoRoot, 'agent', 'scripts', 'write-coverage-badge.py');

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const mergeIstanbulMaps = (target, source) => {
  for (const [filePath, sourceFileCoverage] of Object.entries(source)) {
    if (!target[filePath]) {
      target[filePath] = sourceFileCoverage;
      continue;
    }

    const targetFileCoverage = target[filePath];
    for (const metric of ['s', 'f', 'b']) {
      const sourceMetric = sourceFileCoverage[metric] ?? {};
      const targetMetric = targetFileCoverage[metric] ?? {};
      for (const [key, value] of Object.entries(sourceMetric)) {
        if (Array.isArray(value)) {
          const prior = Array.isArray(targetMetric[key]) ? targetMetric[key] : [];
          const nextLength = Math.max(prior.length, value.length);
          const merged = [];
          for (let idx = 0; idx < nextLength; idx += 1) {
            merged[idx] = (Number(prior[idx]) || 0) + (Number(value[idx]) || 0);
          }
          targetMetric[key] = merged;
        } else {
          targetMetric[key] = (Number(targetMetric[key]) || 0) + (Number(value) || 0);
        }
      }
      targetFileCoverage[metric] = targetMetric;
    }
  }
};

const buildSummary = (coverageMap) => {
  let linesTotal = 0;
  let linesCovered = 0;

  for (const fileCoverage of Object.values(coverageMap)) {
    if (!fileCoverage || typeof fileCoverage !== 'object') {
      continue;
    }
    const lineHits = fileCoverage.l;
    if (lineHits && typeof lineHits === 'object') {
      for (const hits of Object.values(lineHits)) {
        linesTotal += 1;
        if (Number(hits) > 0) {
          linesCovered += 1;
        }
      }
      continue;
    }

    if (!fileCoverage.s || !fileCoverage.statementMap) {
      continue;
    }
    const statementLineHits = new Map();
    for (const [key, rawHits] of Object.entries(fileCoverage.s)) {
      const statement = fileCoverage.statementMap[key];
      if (!statement || !statement.start || typeof statement.start.line !== 'number') {
        continue;
      }
      const line = statement.start.line;
      const isCovered = Number(rawHits) > 0;
      statementLineHits.set(line, (statementLineHits.get(line) ?? false) || isCovered);
    }
    for (const isCovered of statementLineHits.values()) {
      linesTotal += 1;
      if (isCovered) {
        linesCovered += 1;
      }
    }
  }

  return {
    total: {
      lines: {
        total: linesTotal,
        covered: linesCovered,
        skipped: 0,
        pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0,
      },
    },
  };
};

if (!(await pathExists(baseCoveragePath))) {
  console.error('Expected base coverage file missing:', baseCoveragePath);
  process.exit(1);
}

const writeBadge = (linePercent) => {
  const badgeResult = spawnSync(
    'python3',
    [
      badgeScriptPath,
      badgeJsonPath,
      'renderer line coverage',
      linePercent.toFixed(2),
      'line',
      'all files',
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (badgeResult.stdout) process.stdout.write(badgeResult.stdout);
  if (badgeResult.stderr) process.stderr.write(badgeResult.stderr);
  if (badgeResult.status !== 0) {
    process.exit(badgeResult.status ?? 1);
  }
};

if (!(await pathExists(uiSmokeCoverageDir))) {
  console.log('No UI smoke coverage directory found, leaving Vitest coverage unchanged.');
  const baseCoverageMap = await readJson(baseCoveragePath);
  const baseSummary = buildSummary(baseCoverageMap);
  writeBadge(baseSummary.total.lines.pct);
  process.exit(0);
}

const coverageFiles = (await fs.readdir(uiSmokeCoverageDir))
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => path.join(uiSmokeCoverageDir, entry));

if (coverageFiles.length === 0) {
  console.log('No UI smoke coverage files found, leaving Vitest coverage unchanged.');
  const baseCoverageMap = await readJson(baseCoveragePath);
  const baseSummary = buildSummary(baseCoverageMap);
  writeBadge(baseSummary.total.lines.pct);
  process.exit(0);
}

const combinedUiSmokeMap = {};
for (const filePath of coverageFiles) {
  const coverageMap = await readJson(filePath);
  mergeIstanbulMaps(combinedUiSmokeMap, coverageMap);
}

await fs.writeFile(uiSmokeMergedPath, JSON.stringify(combinedUiSmokeMap), 'utf8');

const baseCoverageMap = await readJson(baseCoveragePath);
mergeIstanbulMaps(baseCoverageMap, combinedUiSmokeMap);
await fs.writeFile(mergedPath, JSON.stringify(baseCoverageMap), 'utf8');
await fs.writeFile(baseCoveragePath, JSON.stringify(baseCoverageMap), 'utf8');

const summary = buildSummary(baseCoverageMap);
await fs.writeFile(
  path.join(coverageDir, 'coverage-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8',
);
await fs.writeFile(
  path.join(coverageDir, 'ui-smoke-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8',
);

writeBadge(summary.total.lines.pct);

console.log(`Merged UI smoke coverage from ${coverageFiles.length} file(s).`);
