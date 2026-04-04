import { spawnSync } from "node:child_process";
import path from "node:path";

const rawArgs = process.argv.slice(2);
const forwardedArgs = rawArgs.length === 0 ? [] : rawArgs;
const localPlaywright = path.join(process.cwd(), "node_modules", ".bin", "playwright");

let result;
try {
  result = spawnSync(localPlaywright, ["test", ...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
  if (result.error && result.error.code === "ENOENT") {
    result = spawnSync("npx", ["playwright", "test", ...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
  }
} catch (err) {
  result = spawnSync("npx", ["playwright", "test", ...forwardedArgs], { cwd: process.cwd(), stdio: "inherit" });
}

process.exit(result.status ?? 1);
