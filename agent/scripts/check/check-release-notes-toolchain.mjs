import { readFile } from "node:fs/promises";
import process from "node:process";

import { generateNotes } from "@semantic-release/release-notes-generator";

const releaseConfig = JSON.parse(await readFile(".releaserc.json", "utf8"));
const releaseNotesPlugin = releaseConfig.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/release-notes-generator",
);

if (!releaseNotesPlugin) {
  throw new Error("Missing @semantic-release/release-notes-generator configuration.");
}

const notes = await generateNotes(releaseNotesPlugin[1], {
  commits: [
    {
      hash: "0123456789abcdef0123456789abcdef01234567",
      message: "feat: verify release notes compatibility",
    },
  ],
  cwd: process.cwd(),
  lastRelease: { gitHead: "abcdef0123456789abcdef0123456789abcdef01", gitTag: "v0.0.0" },
  nextRelease: { gitHead: "0123456789abcdef0123456789abcdef01234567", gitTag: "v0.1.0", version: "0.1.0" },
  options: { repositoryUrl: "https://github.com/openai/pumpbuddy.git" },
});

if (!notes.includes("verify release notes compatibility")) {
  throw new Error("Release-notes generation did not include the fixture commit.");
}

console.log("OK semantic-release changelog preset and writer are compatible");
