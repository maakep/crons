import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchWithRetry } from "./fetch.mjs";

export async function fetchJobtechListings(config) {
  const { apiBaseUrl, limit } = config.sources.jobtech;
  const conceptIds = config.municipalities.map((m) => m.conceptId);
  const municipalityParams = conceptIds
    .map((id) => `municipality=${encodeURIComponent(id)}`)
    .join("&");

  const allHits = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${apiBaseUrl}/search?${municipalityParams}&limit=${limit}&offset=${offset}`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    total = data.total.value;
    allHits.push(...data.hits);
    offset += limit;
  }

  return allHits.map(normalizeJobtechHit);
}

function normalizeJobtechHit(hit) {
  return {
    id: `jobtech-${hit.id}`,
    source: "jobtech",
    title: hit.headline,
    company: hit.employer?.name || null,
    workplace: hit.employer?.workplace || null,
    url: hit.webpage_url,
    municipality: hit.workplace_address?.municipality || null,
    publishedAt: hit.publication_date || null,
    deadline: hit.application_deadline || null,
    employmentType: hit.working_hours_type?.label || null,
    occupationField: hit.occupation_field?.label || null,
  };
}

export function filterByKeywords(jobs, keywords) {
  if (!keywords || keywords.length === 0) return jobs;

  const lower = keywords.map((k) => k.toLowerCase());
  return jobs.filter((job) => {
    const text = `${job.title} ${job.company || ""} ${job.occupationField || ""}`.toLowerCase();
    return lower.some((keyword) => text.includes(keyword));
  });
}

export function deduplicateJobs(jobs, threshold) {
  const groups = [];

  for (const job of jobs) {
    const match = groups.find(
      (g) =>
        normalizeName(g.primary.company) === normalizeName(job.company) &&
        tokenSimilarity(g.primary.title, job.title) >= threshold,
    );

    if (match) {
      match.duplicates.push(job);
    } else {
      groups.push({ primary: job, duplicates: [] });
    }
  }

  return groups.map((g) => ({
    ...g.primary,
    duplicateCount: g.duplicates.length,
    duplicateSources: g.duplicates.map((d) => d.source),
  }));
}

function normalizeName(name) {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-zåäö0-9]/g, "");
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSimilarity(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

const SEEN_IDS_PATH = new URL("../data/jobs/seen-ids.json", import.meta.url);

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

export function findNewJobs(jobs, seenIds) {
  if (!seenIds) return [];
  return jobs.filter((job) => !seenIds.has(job.id));
}

export function buildSlackBlocks(newJobs) {
  const byMunicipality = new Map();
  for (const job of newJobs) {
    const key = job.municipality || "Okänd plats";
    if (!byMunicipality.has(key)) byMunicipality.set(key, []);
    byMunicipality.get(key).push(job);
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${newJobs.length} nya jobbannonser`,
      },
    },
  ];

  for (const [municipality, jobs] of byMunicipality) {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `*${municipality}*` },
      ],
    });

    for (const job of jobs) {
      const parts = [`<${job.url}|${job.title}>`];
      if (job.company) parts.push(job.company);

      const meta = [job.employmentType, formatDeadline(job.deadline)]
        .filter(Boolean)
        .join(" · ");
      if (meta) parts.push(meta);

      if (job.duplicateCount > 0) {
        parts.push(`_(+${job.duplicateCount} liknande)_`);
      }

      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: parts.join("\n") },
      });
    }

    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "<https://arbetsformedlingen.se/platsbanken|Visa Platsbanken>",
      },
    ],
  });

  return blocks;
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return null;
  const day = date.getDate();
  const month = date.toLocaleDateString("sv-SE", { month: "short" });
  return `Sista dag: ${day} ${month}`;
}
