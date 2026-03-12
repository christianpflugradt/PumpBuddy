import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(rendererRoot, "src");

const importPattern =
  /((?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?|import\s*\(\s*)["'](\.[^"']+)["'](\s*\)?)/g;

const toPosixPath = (value) => value.split(path.sep).join("/");

const rewriteRelativeTypeScriptImports = (sourceText, fromRelativePath) =>
  sourceText.replace(importPattern, (fullMatch, prefix, specifier, suffix) => {
    if (!specifier.endsWith(".ts")) {
      return fullMatch;
    }

    const resolvedImportPath = path.resolve(srcRoot, path.dirname(fromRelativePath), specifier);
    const emittedImportPath = resolvedImportPath.replace(/\.ts$/, ".js");
    const relativeImportPath = path.relative(
      path.resolve(srcRoot, path.dirname(fromRelativePath)),
      emittedImportPath,
    );
    const normalizedImportPath = toPosixPath(relativeImportPath.startsWith(".") ? relativeImportPath : `./${relativeImportPath}`);

    return `${prefix}"${normalizedImportPath}"${suffix}`;
  });

const collectRelativeTypeScriptImports = (sourceText) =>
  Array.from(sourceText.matchAll(importPattern), (match) => match[2]).filter(
    (specifier) => specifier.startsWith(".") && specifier.endsWith(".ts"),
  );

const transpileFile = async (relativePath, outputRoot, seen) => {
  if (seen.has(relativePath)) {
    return;
  }

  seen.add(relativePath);

  const sourcePath = path.join(srcRoot, relativePath);
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const rewrittenSource = rewriteRelativeTypeScriptImports(sourceText, relativePath);

  for (const specifier of collectRelativeTypeScriptImports(sourceText)) {
    const importedPath = path.relative(
      srcRoot,
      path.resolve(srcRoot, path.dirname(relativePath), specifier),
    );
    await transpileFile(importedPath, outputRoot, seen);
  }

  const transpiled = ts.transpileModule(rewrittenSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const outputPath = path.join(outputRoot, relativePath.replace(/\.ts$/, ".js"));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, transpiled.outputText, "utf8");
};

export const prepareNodeTestEntry = async (entryPoint) => {
  const relativeEntryPoint = path.relative(srcRoot, path.resolve(rendererRoot, entryPoint));
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pumpbuddy-renderer-tests-"));
  await transpileFile(relativeEntryPoint, outputRoot, new Set());
  return path.join(outputRoot, relativeEntryPoint.replace(/\.ts$/, ".js"));
};
