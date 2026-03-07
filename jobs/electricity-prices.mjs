import { runJob } from "../lib/run.mjs";
import { sendSlackBlocks } from "../lib/slack.mjs";
import {
  fetchPrices,
  analyzePrices,
  buildPriceChartUrl,
  formatDateSwedish,
} from "../lib/electricity.mjs";

await runJob(
  "electricity-prices",
  async (config) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const prices = await fetchPrices(
      config.apiBaseUrl,
      config.priceArea,
      tomorrow,
    );
    const stats = analyzePrices(prices, config.thresholds);
    const chartUrl = await buildPriceChartUrl(prices, config);
    const dateStr = formatDateSwedish(tomorrow);

    await sendSlackBlocks(
      config.slackChannel,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `*⚡ Electricity Prices — ${dateStr}*`,
              `*${config.priceArea}* — ${config.currency}`,
              "",
              `Avg: *${stats.avg}* | Low: *${stats.min}* | High: *${stats.max}*`,
              `🟢 Cheapest: ${stats.cheapestWindow.start}–${stats.cheapestWindow.end} (avg ${stats.cheapestWindow.avg} öre)`,
              `🔴 Priciest: ${stats.pricestWindow.start}–${stats.pricestWindow.end} (avg ${stats.pricestWindow.avg} öre)`,
            ].join("\n"),
          },
        },
        {
          type: "image",
          title: {
            type: "plain_text",
            text: `Electricity prices for ${dateStr}`,
          },
          image_url: chartUrl,
          alt_text: `Electricity prices for ${dateStr}`,
        },
      ],
      `Electricity prices for ${dateStr}`,
    );
  },
  {
    requiredFields: [
      "apiBaseUrl",
      "priceArea",
      "currency",
      "slackChannel",
      "thresholds",
      "chart",
    ],
  },
);
