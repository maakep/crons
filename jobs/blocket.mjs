import { runJob } from "../lib/run.mjs";
import { sendSlackBlocks } from "../lib/slack.mjs";
import {
  fetchListings,
  loadSeenIds,
  saveSeenIds,
  findNewItems,
  buildSlackBlocks,
} from "../lib/blocket.mjs";

await runJob(
  "blocket",
  async (config) => {
    const items = await fetchListings(config.searchUrl);
    console.log(`Fetched ${items.length} listings`);

    const seenIds = await loadSeenIds(config.seenIdsPath);
    const isFirstRun = seenIds === null;
    const newItems = findNewItems(items, seenIds);

    if (isFirstRun) {
      console.log("First run — seeding seen IDs, skipping Slack notification");
    } else if (newItems.length > 0) {
      console.log(`Found ${newItems.length} new item(s)`);
      const blocks = buildSlackBlocks(newItems, config.searchUrl);
      const fallback = `${newItems.length} nya gratisgrejor nara Eslov`;
      await sendSlackBlocks(config.slackChannel, blocks, fallback);
    } else {
      console.log("No new items");
    }

    const allIds = new Set(items.map((i) => i.id));
    await saveSeenIds(config.seenIdsPath, allIds);
  },
  { requiredFields: ["searchUrl", "slackChannel", "seenIdsPath"] },
);
