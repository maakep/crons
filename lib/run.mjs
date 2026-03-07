import { loadConfig } from "./config.mjs";

export async function runJob(name, fn, { requiredFields = [] } = {}) {
  const start = performance.now();
  console.log(`[${name}] Starting`);

  try {
    const config = await loadConfig(name, requiredFields);
    await fn(config);

    const duration = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`[${name}] Completed in ${duration}s`);
  } catch (error) {
    const duration = ((performance.now() - start) / 1000).toFixed(2);
    console.error(`[${name}] Failed after ${duration}s`);
    console.error(error);

    await notifyFailure(name, error).catch((notifyError) => {
      console.error(`[${name}] Additionally, failure notification failed:`);
      console.error(notifyError);
    });

    process.exit(1);
  }
}

async function notifyFailure(jobName, error) {
  if (!process.env.SLACK_BOT_TOKEN) return;

  const { loadSettings } = await import("./config.mjs");
  const { sendSlackMessage } = await import("./slack.mjs");
  const settings = await loadSettings();
  await sendSlackMessage(
    settings.errorChannel,
    `Job \`${jobName}\` failed: ${error.message}`,
  );
}
