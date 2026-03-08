import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchWithRetry } from "./fetch.mjs";

export async function fetchListings(searchUrl) {
  const response = await fetchWithRetry(searchUrl);
  const html = await response.text();

  const match = html.match(
    /<script[^>]+id="seoStructuredData"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error("Could not find seoStructuredData in page HTML");

  const structured = JSON.parse(match[1]);
  const items = structured?.mainEntity?.itemListElement;
  if (!Array.isArray(items)) {
    throw new Error("Unexpected seoStructuredData structure — no itemListElement array");
  }

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
    };
  });
}

export async function loadSeenIds(seenIdsPath) {
  const path = new URL(`../${seenIdsPath}`, import.meta.url);
  try {
    const raw = await readFile(path, "utf-8");
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return null;
    if (ids.length === 0) return null;
    return new Set(ids);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveSeenIds(seenIdsPath, ids) {
  const path = new URL(`../${seenIdsPath}`, import.meta.url);
  const dir = dirname(path.pathname.replace(/^\/([A-Z]:)/, "$1"));
  await mkdir(dir, { recursive: true });
  const sorted = [...ids].sort();
  await writeFile(path, JSON.stringify(sorted, null, 2) + "\n");
}

export function findNewItems(items, seenIds) {
  if (!seenIds) return [];
  return items.filter((item) => !seenIds.has(item.id));
}

export function buildSlackBlocks(newItems, searchUrl) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${newItems.length} nya gratisgrejor nara Eslov`,
      },
    },
  ];

  for (const item of newItems) {
    const label = item.brand ? `${item.name} (${item.brand})` : item.name;

    const section = {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${item.url}|${label}>`,
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
