import { readFile } from "node:fs/promises";

export async function loadConfig(jobName, requiredFields = []) {
  const path = new URL(`../config/${jobName}.json`, import.meta.url);
  const raw = await readFile(path, "utf-8");
  const config = JSON.parse(raw);

  for (const field of requiredFields) {
    if (config[field] === undefined || config[field] === null) {
      throw new Error(`Config "${jobName}" is missing required field: "${field}"`);
    }
  }

  return config;
}

export async function loadSettings() {
  const path = new URL("../config/settings.json", import.meta.url);
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw);
}
