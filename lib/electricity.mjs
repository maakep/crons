import { fetchWithRetry } from "./fetch.mjs";
import { buildChartShortUrl } from "./chart.mjs";

export async function fetchPrices(apiBaseUrl, priceArea, date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const url = `${apiBaseUrl}/${year}/${month}-${day}_${priceArea}.json`;
  const response = await fetchWithRetry(url, {}, { retries: 1 });
  const raw = await response.json();

  return raw.map((entry) => ({
    start: new Date(entry.time_start),
    örePerKwh: Math.round(entry.SEK_per_kWh * 100),
  }));
}

export function analyzePrices(prices, thresholds) {
  const values = prices.map((p) => p.örePerKwh);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const hourlyAvg = toHourlyAverages(prices);
  const cheapestWindow = findBestWindow(hourlyAvg, "min");
  const pricestWindow = findBestWindow(hourlyAvg, "max");

  return { avg, min, max, cheapestWindow, pricestWindow };
}

export async function buildPriceChartUrl(prices, config) {
  const { thresholds, chart } = config;

  // Show hour labels only on the hour (every 4th bar), empty string otherwise
  const labels = prices.map((p) => {
    const mins = p.start.getMinutes();
    return mins === 0 ? String(p.start.getHours()).padStart(2, "0") : "";
  });

  const colors = prices.map((p) => {
    if (p.örePerKwh <= thresholds.cheap) return chart.colors.cheap;
    if (p.örePerKwh >= thresholds.expensive) return chart.colors.expensive;
    return chart.colors.normal;
  });

  const chartConfig = {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: prices.map((p) => p.örePerKwh),
          backgroundColor: colors,
          borderWidth: 0,
          barPercentage: 1.0,
          categoryPercentage: 1.0,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Electricity Spot Price — ${config.priceArea} (${config.currency})`,
          font: { size: 16 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: false,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: config.currency,
          },
        },
      },
    },
  };

  return buildChartShortUrl(chartConfig, {
    width: chart.width,
    height: chart.height,
  });
}

export function formatDateSwedish(date) {
  return date.toLocaleDateString("sv-SE", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function toHourlyAverages(prices) {
  const hours = [];
  for (let i = 0; i < prices.length; i += 4) {
    const chunk = prices.slice(i, i + 4);
    const avg = Math.round(
      chunk.reduce((a, b) => a + b.örePerKwh, 0) / chunk.length
    );
    hours.push({ hour: prices[i].start.getHours(), avg });
  }
  return hours;
}

function findBestWindow(hourlyAvg, mode) {
  const windowSize = 3;
  let bestStart = 0;
  let bestAvg = mode === "min" ? Infinity : -Infinity;

  for (let i = 0; i <= hourlyAvg.length - windowSize; i++) {
    const windowAvg = Math.round(
      hourlyAvg.slice(i, i + windowSize).reduce((a, b) => a + b.avg, 0) /
        windowSize
    );

    if (
      (mode === "min" && windowAvg < bestAvg) ||
      (mode === "max" && windowAvg > bestAvg)
    ) {
      bestAvg = windowAvg;
      bestStart = i;
    }
  }

  const startHour = hourlyAvg[bestStart].hour;
  const endHour = (startHour + windowSize) % 24;

  return {
    start: String(startHour).padStart(2, "0") + ":00",
    end: String(endHour).padStart(2, "0") + ":00",
    avg: bestAvg,
  };
}
