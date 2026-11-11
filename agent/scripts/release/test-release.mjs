import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeCommits } from "@semantic-release/commit-analyzer";
import { generateNotes } from "@semantic-release/release-notes-generator";
import config from "../../../release.config.mjs";
import { verifyRelease } from "./semantic-release-plugin.mjs";

const analyzer = config.plugins[0][1];
const notesConfig = config.plugins[1][1];
const logger = { log() {} };
const commit = (message, hash = "a".repeat(40)) => ({ message, hash });

for (const [message, expected] of [
  ["feat: add workout options", "minor"],
  ["fix: correct load calculation", "patch"],
  ["perf: speed up workout lookup", "patch"],
  ["chore(deps): update a dependency", "patch"],
  ["build(docker): update runtime", "patch"],
  ["refactor(backend): simplify the handler", "patch"],
  ["ci: align repository governance", null],
  ["docs: explain deployment", null],
  ["config: adjust local defaults", null],
  ["style: format source", null],
  ["test: cover a regression", null],
  ["build(release): stamp version", null],
  ["feat!: replace the API\n\nBREAKING CHANGE: replace the API", "major"],
]) {
  test("stable release policy: " + message.split("\n")[0], async () => {
    assert.equal(await analyzeCommits(analyzer, { commits: [commit(message)], logger, cwd: process.cwd() }), expected);
  });
}

test("scoped reverts cancel unreleased originals and their notes", async () => {
  const original = commit("feat(backend): add an option", "1".repeat(40));
  const revert = commit('revert(backend): "feat(backend): add an option"\n\nThis reverts commit ' + original.hash + ".", "2".repeat(40));
  assert.equal(await analyzeCommits(analyzer, { commits: [revert, original], logger, cwd: process.cwd() }), null);
  const notes = await generateNotes(notesConfig, {
    commits: [revert, original], cwd: process.cwd(), logger,
    lastRelease: { gitTag: "v4.3.4" }, nextRelease: { version: "4.4.0", gitTag: "v4.4.0" },
    options: { repositoryUrl: config.repositoryUrl },
  });
  assert.ok(!notes.includes("add an option"));
});

test("release entry points refuse execution outside the main workflow before any publication", () => {
  for (const file of ["release-plan.mjs", "publish-release.mjs"]) {
    const result = spawnSync(process.execPath, ["agent/scripts/release/" + file], {
      encoding: "utf8", env: { PATH: process.env.PATH, GITHUB_REF: "refs/heads/other" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restricted/);
  }
});

test("version, checkout and remote-main guards precede candidate verification", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pumpbuddy-release-"));
  try {
    const fixtureEnv = { PATH: process.env.PATH, HOME: directory, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(directory, "empty-config") };
    const git = (...args) => execFileSync("git", args, { cwd: directory, env: fixtureEnv, encoding: "utf8" }).trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Offline Fixture");
    git("config", "user.email", "fixture@example.invalid");
    writeFileSync(path.join(directory, "source"), "fixture");
    git("add", "source");
    git("commit", "-qm", "feat: create fixture");
    const remote = path.join(directory, "remote.git");
    git("init", "--bare", "-q", remote);
    git("remote", "add", "origin", remote);
    git("push", "-q", "origin", "main");
    const source = git("rev-parse", "HEAD");
    // A local stub isolates the guard from artifact validation, tested separately in Python.
    mkdirSync(path.join(directory, "tools"));
    writeFileSync(path.join(directory, "tools", "python3"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const env = {
      ...fixtureEnv, GITHUB_REPOSITORY: "christianpflugradt/PumpBuddy", GITHUB_REF: "refs/heads/main", PATH: path.join(directory, "tools") + path.delimiter + process.env.PATH,
      EXPECTED_RELEASE_VERSION: "4.4.0", GITHUB_SHA: source,
    };
    const context = { cwd: directory, env, nextRelease: { version: "4.4.0" } };
    verifyRelease({}, context);
    assert.throws(() => verifyRelease({}, { ...context, nextRelease: { version: "4.4.1" } }), /version changed/);
    assert.throws(() => verifyRelease({}, { ...context, env: { ...env, GITHUB_SHA: "b".repeat(40) } }), /main changed/);
    writeFileSync(path.join(directory, "source"), "remote moved");
    git("commit", "-qam", "fix: advance main");
    git("push", "-q", "origin", "main");
    git("checkout", "-q", "--detach", source);
    assert.throws(() => verifyRelease({}, context), /main changed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
