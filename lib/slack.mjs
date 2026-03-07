import { postJson } from "./fetch.mjs";
import { requireEnv } from "./env.mjs";

export async function sendSlackMessage(text) {
  const webhookUrl = requireEnv("SLACK_WEBHOOK_URL");
  await postJson(webhookUrl, { text });
  console.log("Message posted to Slack");
}

export async function sendSlackPayload(payload) {
  const webhookUrl = requireEnv("SLACK_WEBHOOK_URL");
  await postJson(webhookUrl, payload);
  console.log("Payload posted to Slack");
}
