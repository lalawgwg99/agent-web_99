import { run } from "../src/cli/index.js";

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
