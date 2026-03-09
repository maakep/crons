import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchWithRetry } from "./fetch.mjs";

export async function fetchListings(searchUrl) {
  const response = await fetchWithRetry(searchUrl);
  const html = await response.text();

  const items = parseReactQueryState(html) ?? parseSeoStructuredData(html);
  if (!items) {
    throw new Error("Could not extract listings from page HTML");
  }
  return items;
}

function parseReactQueryState(html) {
  const match = html.match(
    /<script[^>]+data-react-query-state[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  const decoded = Buffer.from(match[1].trim(), "base64").toString("utf-8");
  const state = JSON.parse(decoded);

  const queries = state?.queries;
  if (!Array.isArray(queries)) return null;

  const searchQuery = queries.find((q) => q.state?.data?.docs);
  const docs = searchQuery?.state?.data?.docs;
  if (!Array.isArray(docs) || docs.length === 0) return null;

  return docs.map((doc) => ({
    id: String(doc.ad_id || doc.id),
    name: doc.heading,
    url: doc.canonical_url,
    image: doc.image?.url || null,
    brand: null,
    location: doc.location || null,
    timestamp: doc.timestamp || null,
  }));
}

function parseSeoStructuredData(html) {
  const match = html.match(
    /<script[^>]+id="seoStructuredData"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  const structured = JSON.parse(match[1]);
  const items = structured?.mainEntity?.itemListElement;
  if (!Array.isArray(items)) return null;

  return items.map((entry) => {
    const product = entry.item;
    const url = product.url;
    const id = url.match(/\/item\/(\d+)/)?.[1];
    if (!id) throw new Error(`Could not extract item ID from URL: ${url}`);

    return {
      id,
      name: product.name,
      url,
      image: product.image || null,
      brand: product.brand?.name || null,
      location: null,
      timestamp: null,
    };
  });
}

const SEEN_IDS_PATH = new URL("../data/blocket/seen-ids.json", import.meta.url);

export async function loadSeenIds() {
  try {
    const raw = await readFile(SEEN_IDS_PATH, "utf-8");
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return null;
    if (ids.length === 0) return null;
    return new Set(ids);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveSeenIds(ids) {
  const dir = dirname(SEEN_IDS_PATH.pathname.replace(/^\/([A-Z]:)/, "$1"));
  await mkdir(dir, { recursive: true });
  const sorted = [...ids].sort();
  await writeFile(SEEN_IDS_PATH, JSON.stringify(sorted, null, 2) + "\n");
}

export function findNewItems(items, seenIds) {
  if (!seenIds) return [];
  return items.filter((item) => !seenIds.has(item.id));
}

function formatTimeSince(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 60) return `${diffMinutes} min`;
  if (diffHours < 24) return `${diffHours} tim`;
  if (diffDays === 1) return "1 dag";
  return `${diffDays} dagar`;
}

export function buildSlackBlocks(newItems, searchUrl) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${newItems.length} nya listningar`,
      },
    },
  ];

  for (const item of newItems) {
    const label = item.brand ? `${item.name} (${item.brand})` : item.name;
    const meta = [item.location, formatTimeSince(item.timestamp)]
      .filter(Boolean)
      .join(" · ");
    const metaLine = meta ? `\n${meta}` : "";

    const section = {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${item.url}|${label}>${metaLine}`,
      },
    };

    if (item.image) {
      section.accessory = {
        type: "image",
        image_url: item.image,
        alt_text: item.name,
      };
    }

    blocks.push(section);
  }

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${searchUrl}|Visa alla annonser>`,
        },
      ],
    },
  );

  return blocks;
}
