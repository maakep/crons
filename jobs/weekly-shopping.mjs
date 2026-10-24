import { runJob } from "../lib/run.mjs";
import { buildWeeklyShoppingList } from "../lib/shopping.mjs";
import { sendSlackMessage } from "../lib/slack.mjs";

await runJob("weekly-shopping", async (config) => {
  await sendSlackMessage(config.slackChannel, buildWeeklyShoppingList(config));
}, { requiredFields: ["slackChannel", "rotationStartDate", "everyWeek", "weeks"] });
