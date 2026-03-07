export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function redact(value) {
  if (!value || value.length <= 4) return "***";
  return value.slice(0, 4) + "***";
}
