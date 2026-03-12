import { spawnSync } from "node:child_process";
import { prepareNodeTestEntry } from "./prepare-node-tests.mjs";

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--run");
const entryPoint = await prepareNodeTestEntry("./src/app.test.ts");
const result = spawnSync(
  process.execPath,
  [
    "--test",
    entryPoint,
    ...forwardedArgs,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
