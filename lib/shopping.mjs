const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildWeeklyShoppingList(config, now = new Date()) {
  if (!Array.isArray(config.weeks) || !config.weeks.length) {
    throw new Error('"weeks" must be a non-empty array of shopping plans.');
  }
  if (!Array.isArray(config.everyWeek)) {
    throw new Error('"everyWeek" must be an array of ingredients.');
  }

  const rotationStart = parseRotationStart(config.rotationStartDate);
  const weekStart = startOfNextWeek(now);
  const elapsedWeeks = Math.max(0, Math.floor((weekStart - rotationStart) / WEEK_MS));
  const weekIndex = elapsedWeeks % config.weeks.length;
  const week = config.weeks[weekIndex];
  const weekName = typeof week?.name === "string" && week.name.trim()
    ? week.name
    : `Week ${weekIndex + 1}`;
  const meals = week?.meals;

  if (!Array.isArray(meals) || meals.length === 0) {
    throw new Error(`Shopping plan "${weekName}" must contain at least one meal.`);
  }

  const byCategory = new Map();
  const numericItems = new Map();
  for (const ingredient of [
    ...meals.flatMap((meal) => {
      if (!meal || !Array.isArray(meal.ingredients)) {
        throw new Error(`Every meal in "${weekName}" must have an ingredients array.`);
      }
      return meal.ingredients;
    }),
    ...config.everyWeek,
  ]) {
    if (
      !ingredient ||
      typeof ingredient.name !== "string" ||
      !ingredient.name.trim() ||
      typeof ingredient.category !== "string" ||
      !ingredient.category.trim() ||
      !isValidQuantity(ingredient.quantity)
    ) {
      throw new Error(`Every ingredient in "${weekName}" needs a name, quantity, and category.`);
    }

    if (typeof ingredient.quantity === "number") {
      const key = ingredient.name.trim().toLocaleLowerCase("sv");
      const existing = numericItems.get(key);
      if (existing) {
        existing.quantity += ingredient.quantity;
        continue;
      }
      const item = { name: ingredient.name, quantity: ingredient.quantity };
      const items = byCategory.get(ingredient.category) ?? [];
      numericItems.set(key, item);
      items.push(item);
      byCategory.set(ingredient.category, items);
      continue;
    }
    const items = byCategory.get(ingredient.category) ?? [];
    items.push({ name: ingredient.name, quantity: ingredient.quantity.trim() });
    byCategory.set(ingredient.category, items);
  }

  const mondayLabel = formatDate(weekStart);
  const sunday = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const sections = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "sv"))
    .map(([category, items]) => `- - ${category} - -\n${items.map(formatItem).join("\n")}`);

  if (!sections.length) {
    throw new Error(`Shopping plan "${weekName}" has no ingredients.`);
  }

  return [
    `Weekly shopping — ${weekName} (${mondayLabel}–${formatDate(sunday)})`,
    ...sections,
  ].join("\n\n");
}

function isValidQuantity(value) {
  return (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim().length > 0);
}

function formatItem({ name, quantity }) {
  const formattedQuantity = typeof quantity === "number"
    ? String(Number(quantity.toPrecision(15)))
    : quantity;
  return `☐ ${formattedQuantity} ${name}`;
}

function parseRotationStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('"rotationStartDate" must be a Monday in YYYY-MM-DD format.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1) {
    throw new Error('"rotationStartDate" must be a valid Monday in YYYY-MM-DD format.');
  }
  return date;
}

function startOfNextWeek(date) {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) + 7);
  return monday;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
