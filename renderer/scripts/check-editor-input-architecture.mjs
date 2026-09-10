import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(scriptsDirectory, "../src");
const editorPattern = /^pb-configurator-.*-editor-screen\.ts$/;
const editorFiles = (await readdir(sourceDirectory)).filter((file) => editorPattern.test(file));
const failures = [];

for (const file of editorFiles) {
  const source = await readFile(path.join(sourceDirectory, file), "utf8");
  if (!source.includes('from "./text-input-binding"')) failures.push(`${file}: must import TextInputBinding`);
  if (!source.includes("new TextInputBinding(")) failures.push(`${file}: must create a TextInputBinding`);
  if (/\.(add|remove)EventListener\("input"/.test(source)) failures.push(`${file}: must not register input listeners directly`);
}

if (failures.length) {
  process.stderr.write(`Text-input architecture violations:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
}
