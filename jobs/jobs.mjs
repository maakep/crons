import { runJob } from "../lib/run.mjs";
import { sendSlackBlocks } from "../lib/slack.mjs";
import {
  fetchJobtechListings,
  filterByKeywords,
  deduplicateJobs,
  loadSeenIds,
  saveSeenIds,
  findNewJobs,
  buildSlackBlocks,
} from "../lib/jobs.mjs";

await runJob(
  "jobs",
  async (config) => {
    const listings = await fetchJobtechListings(config);
    console.log(`Fetched ${listings.length} listings`);

    const filtered = filterByKeywords(listings, config.keywords);
    if (filtered.length < listings.length) {
      console.log(`${filtered.length} match keyword filter`);
    }

    const deduped = deduplicateJobs(
      filtered,
      config.dedup.titleSimilarityThreshold,
    );

    const seenIds = await loadSeenIds();
    const isFirstRun = seenIds === null;
    const newJobs = findNewJobs(deduped, seenIds);

    if (isFirstRun) {
      console.log("First run — seeding seen IDs, skipping Slack notification");
    } else if (newJobs.length > 0) {
      console.log(`Found ${newJobs.length} new job(s)`);
      const blocks = buildSlackBlocks(newJobs);
      const fallback = `${newJobs.length} nya jobbannonser`;
      await sendSlackBlocks(config.slackChannel, blocks, fallback, {
        unfurl: false,
      });
    } else {
      console.log("No new jobs");
    }

    const allIds = new Set(deduped.map((j) => j.id));
    await saveSeenIds(allIds);
  },
  { requiredFields: ["slackChannel", "municipalities", "sources", "dedup"] },
);
