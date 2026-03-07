import { requireEnv } from "./env.mjs";

const SLACK_API = "https://slack.com/api";

export async function sendSlackMessage(channel, text) {
  await callSlackApi("chat.postMessage", { channel, text });
  console.log(`Message posted to Slack (#${channel})`);
}

export async function sendSlackBlocks(channel, blocks, fallbackText) {
  await callSlackApi("chat.postMessage", {
    channel,
    text: fallbackText,
    blocks,
  });
  console.log(`Blocks posted to Slack (#${channel})`);
}

async function callSlackApi(method, body) {
  const token = requireEnv("SLACK_BOT_TOKEN");

  const response = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API error (${method}): ${data.error}`);
  }
  return data;
}
