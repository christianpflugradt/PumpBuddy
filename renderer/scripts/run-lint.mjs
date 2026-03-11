import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["./node_modules/typescript/bin/tsc", "--noEmit", "--pretty", "false", "--project", "tsconfig.json"],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
