import { spawnSync } from "node:child_process";

const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== "--run");
const result = spawnSync(
  process.execPath,
  [
    "--test",
    "--experimental-strip-types",
    "--experimental-test-coverage",
    "--test-coverage-branches=80",
    "--test-coverage-functions=80",
    "--test-coverage-lines=80",
    "./src/app.test.ts",
    ...forwardedArgs,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
