import { runJob } from "../lib/run.mjs";
import { sendSlackMessage } from "../lib/slack.mjs";

await runJob("hello-world", async (config) => {
  await sendSlackMessage(config.message);
}, { requiredFields: ["message"] });
