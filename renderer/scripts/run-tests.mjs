import { spawnSync } from "node:child_process";
import path from "node:path";

// Default to non-watch mode so CI/make check never hangs.
const rawArgs = process.argv.slice(2);
const forwardedArgs =
  rawArgs.length === 0 ? ["run"] : rawArgs.filter((argument) => argument !== "--run");

// Prefer the local installed vitest binary when available, fall back to npx.
const localVitest = path.join(process.cwd(), "node_modules", ".bin", "vitest");

let result;
try {
  result = spawnSync(localVitest, [...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
  if (result.error && result.error.code === 'ENOENT') {
    // local binary not found — fall back to npx
    result = spawnSync("npx", ["vitest", ...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
  }
} catch (err) {
  result = spawnSync("npx", ["vitest", ...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
}

process.exit(result.status ?? 1);
