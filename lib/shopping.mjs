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
  if (meals.some((meal) => typeof meal?.name !== "string" || !meal.name.trim())) {
    throw new Error(`Every meal in "${weekName}" must have a name.`);
  }
  const categoryOrder = config.categoryOrder ?? [];
  if (!Array.isArray(categoryOrder) || categoryOrder.some((category) => typeof category !== "string" || !category.trim())) {
    throw new Error('"categoryOrder" must be an array of category names.');
  }
  const categoryPositions = new Map(categoryOrder.map((category, index) => [category, index]));

  const byCategory = new Map();
  const numericItems = new Map();
  for (const { ingredient, isEveryWeek } of [
    ...meals.flatMap((meal) => {
      if (!meal || !Array.isArray(meal.ingredients)) {
        throw new Error(`Every meal in "${weekName}" must have an ingredients array.`);
      }
      return meal.ingredients.map((ingredient) => ({ ingredient, isEveryWeek: false }));
    }),
    ...config.everyWeek.map((ingredient) => ({ ingredient, isEveryWeek: true })),
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
        existing.isEveryWeek ||= isEveryWeek;
        continue;
      }
      const item = { name: ingredient.name, quantity: ingredient.quantity, isEveryWeek };
      const items = byCategory.get(ingredient.category) ?? [];
      numericItems.set(key, item);
      items.push(item);
      byCategory.set(ingredient.category, items);
      continue;
    }
    const items = byCategory.get(ingredient.category) ?? [];
    items.push({ name: ingredient.name, quantity: ingredient.quantity.trim(), isEveryWeek });
    byCategory.set(ingredient.category, items);
  }

  const sections = [...byCategory.entries()]
    .sort(([a], [b]) => {
      const aPosition = categoryPositions.get(a);
      const bPosition = categoryPositions.get(b);
      if (aPosition === undefined && bPosition !== undefined) return -1;
      if (aPosition !== undefined && bPosition === undefined) return 1;
      if (aPosition === undefined) return a.localeCompare(b, "sv");
      return aPosition - bPosition;
    })
    .map(([category, items]) => `- - ${category} - -\n${items.map(formatItem).join("\n")}`);

  if (!sections.length) {
    throw new Error(`Shopping plan "${weekName}" has no ingredients.`);
  }

  return [meals.map((meal) => meal.name.trim()).join("\n"), sections.join("\n\n")].join("\n\n");
}

function isValidQuantity(value) {
  return (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" && value.trim().length > 0);
}

function formatItem({ name, quantity, isEveryWeek }) {
  const formattedQuantity = typeof quantity === "number"
    ? String(Number(quantity.toPrecision(15)))
    : quantity;
  const quantityPrefix = formattedQuantity === "1" ? "" : `${formattedQuantity} `;
  return `${quantityPrefix}${isEveryWeek ? `*${name}` : name}`;
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
