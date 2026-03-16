import { spawnSync } from "node:child_process";
import path from "node:path";

// Forward arguments to Vitest. Keep the existing script name so callers don't change.
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--run");

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
