import semanticRelease from "semantic-release";
import config from "../../../release.config.mjs";

if (process.env.GITHUB_REF !== "refs/heads/main" || !process.env.EXPECTED_RELEASE_VERSION) {
  throw new Error("Publication is restricted to the main-branch release workflow.");
}
const result = await semanticRelease(config);
if (!result) throw new Error("Planned release disappeared; refuse publication.");
