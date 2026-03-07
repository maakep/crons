export function buildChartUrl(chartConfig, options = {}) {
  const params = new URLSearchParams({
    c: JSON.stringify(chartConfig),
    w: String(options.width || 800),
    h: String(options.height || 400),
    bkg: options.backgroundColor || "white",
    devicePixelRatio: "2",
    v: "4",
  });
  return `https://quickchart.io/chart?${params}`;
}

export async function buildChartShortUrl(chartConfig, options = {}) {
  const res = await fetch("https://quickchart.io/chart/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chart: chartConfig,
      width: options.width || 800,
      height: options.height || 400,
      backgroundColor: options.backgroundColor || "white",
      devicePixelRatio: 2,
      version: "4",
      format: "png",
    }),
  });

  if (!res.ok) throw new Error(`QuickChart error: ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error("QuickChart failed to create short URL");

  await waitForUrl(data.url);
  return data.url;
}

// QuickChart short URLs may not be immediately resolvable after creation.
// Poll until the URL returns a non-error response so downstream consumers
// (e.g. Slack image blocks) don't reject it.
async function waitForUrl(url, { maxAttempts = 5, intervalMs = 300 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
