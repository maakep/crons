import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const name = process.argv[2];

if (!name) {
  console.error("Usage: node run.mjs <job-name>");
  console.error("Example: node run.mjs hello-world");
  process.exit(1);
}

const jobPath = resolve("jobs", `${name}.mjs`);
if (!existsSync(jobPath)) {
  console.error(`Job not found: jobs/${name}.mjs`);
  process.exit(1);
}

loadEnvFile(".env");
await import(pathToFileURL(jobPath).href);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}
