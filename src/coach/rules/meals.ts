// Free meal planner: picks meals from the cuisine lists, respects diet,
// dislikes and budget, and scales portions to the calorie target.
import type { CoachProfile, DayMeals, Meal } from '../schema.js';
import { GENERAL_TEMPLATES, SECTION_ORDER, cuisineFor, templatesFor, type MealTemplate, type Slot, type Tag } from './foods.js';
import { shuffle, type Rng } from './random.js';

// Which tags each dietary choice rules out.
const DIET_BLOCKS: Record<string, Tag[]> = {
  vegetarian: ['beef', 'pork', 'chicken', 'fish', 'shellfish'],
  vegan: ['beef', 'pork', 'chicken', 'fish', 'shellfish', 'egg', 'dairy'],
  halal: ['pork'],
  'no pork': ['pork'],
  'no beef': ['beef'],
  'lactose-free': ['dairy'],
  'gluten-free': ['gluten'],
  'nut allergy': ['nuts'],
  'shellfish allergy': ['shellfish'],
  'diabetic-friendly': ['sugary'],
};

function blockedTags(profile: CoachProfile): Set<Tag> {
  const blocked = new Set<Tag>();
  for (const need of profile.dietary) {
    for (const tag of DIET_BLOCKS[need.toLowerCase()] ?? []) blocked.add(tag);
  }
  return blocked;
}

function mentionsDislike(t: MealTemplate, dislikes: string[]): boolean {
  const text = [t.name, ...t.items.map((i) => i.item)].join(' ').toLowerCase();
  return dislikes.some((d) => d.trim().length > 1 && text.includes(d.trim().toLowerCase()));
}

const BUDGET_LEVEL: Record<CoachProfile['budget'], number> = { low: 1, medium: 2, high: 3 };

// Candidate meals for a slot. Diet rules are never relaxed; if too few meals
// are left, we widen budget first, then add general meals, then (last) ignore dislikes.
export function mealOptions(profile: CoachProfile, slot: Slot): MealTemplate[] {
  const blocked = blockedTags(profile);
  const dietOk = (t: MealTemplate) => t.slot === slot && !t.tags.some((tag) => blocked.has(tag));
  const own = templatesFor(cuisineFor(profile.nationality)).filter(dietOk);
  const general = GENERAL_TEMPLATES.filter(dietOk);
  const enough = slot === 'main' ? 3 : 2;

  const attempts: MealTemplate[][] = [
    own.filter((t) => t.budget <= BUDGET_LEVEL[profile.budget] && !mentionsDislike(t, profile.dislikes)),
    own.filter((t) => !mentionsDislike(t, profile.dislikes)),
    [...own, ...general].filter((t) => !mentionsDislike(t, profile.dislikes)),
    [...own, ...general],
  ];
  return attempts.find((list) => list.length >= enough) ?? attempts[attempts.length - 1];
}

// Rounds a scaled amount to something you can actually serve: halves, or whole pieces.
function niceQty(qty: number, whole: boolean): number {
  return whole ? Math.max(1, Math.round(qty)) : Math.max(0.5, Math.round(qty * 2) / 2);
}

function formatQty(qty: number): string {
  const whole = Math.floor(qty);
  const half = qty - whole >= 0.5;
  if (whole === 0) return '½';
  return half ? `${whole}½` : String(whole);
}

// Scales a meal so its calories land close to the target.
export function scaleMeal(t: MealTemplate, targetKcal: number): Meal {
  const baseKcal = t.items.reduce((sum, i) => sum + i.kcal, 0);
  const factor = Math.min(1.8, Math.max(0.6, targetKcal / baseKcal));
  let kcal = 0;
  let protein = 0;
  const foods = t.items.map((i) => {
    const qty = niceQty(i.qty * factor, !!i.whole);
    const ratio = qty / i.qty;
    kcal += i.kcal * ratio;
    protein += i.protein * ratio;
    return { item: i.item, portion: `${formatQty(qty)} ${qty > 1 ? i.unit[1] : i.unit[0]}` };
  });
  return { name: t.name, foods, kcal: Math.round(kcal), proteinG: Math.round(protein) };
}

// Picks a meal for each day, avoiding the same one two days running.
function pickWeek(options: MealTemplate[], rng: Rng, avoid?: MealTemplate[]): MealTemplate[] {
  const week: MealTemplate[] = [];
  let pool = shuffle(options, rng);
  for (let day = 0; day < 7; day++) {
    if (pool.length === 0) pool = shuffle(options, rng);
    const index = pool.findIndex((t) => t !== week[day - 1] && t !== avoid?.[day]);
    const [pick] = pool.splice(index === -1 ? 0 : index, 1);
    week.push(pick);
  }
  return week;
}

export interface MealPart {
  mealPlan: DayMeals[];
  groceryList: { section: string; items: string[] }[];
}

// Simple protein add-ons, in order of preference, used when a day's meals fall
// short of the protein target. The first one the person's diet allows is used.
const PROTEIN_BOOSTS: { tag: Tag | null; item: string; portion: string; kcal: number; protein: number; section: string }[] = [
  { tag: 'fish', item: 'Extra fish', portion: '1 small piece', kcal: 90, protein: 14, section: 'Protein' },
  { tag: 'egg', item: 'Extra boiled eggs', portion: '2 eggs', kcal: 140, protein: 12, section: 'Protein' },
  { tag: 'dairy', item: 'Plain yoghurt', portion: '1 small cup', kcal: 100, protein: 6, section: 'Dairy' },
  { tag: null, item: 'Extra beans', portion: '1 cooking spoon', kcal: 150, protein: 8, section: 'Beans and legumes' },
];

function proteinBoost(profile: CoachProfile) {
  const blocked = blockedTags(profile);
  return PROTEIN_BOOSTS.find((b) => (b.tag === null || !blocked.has(b.tag)) && !profile.dislikes.some((d) => d.trim().length > 1 && b.item.toLowerCase().includes(d.trim().toLowerCase())));
}

function addToMeal(meal: Meal, boost: NonNullable<ReturnType<typeof proteinBoost>>): Meal {
  return {
    ...meal,
    foods: [...meal.foods, { item: boost.item, portion: boost.portion }],
    kcal: meal.kcal + boost.kcal,
    proteinG: meal.proteinG + boost.protein,
  };
}

export function buildMeals(profile: CoachProfile, dailyKcal: number, proteinTarget: number, rng: Rng): MealPart {
  const snackCount = Math.max(0, profile.mealsPerDay - 3);
  // Share of the day's calories for each meal. With 2 meals a day, "lunch" is a light snack.
  const snackShare = 0.1;
  const twoMeals = profile.mealsPerDay === 2;
  const mainsShare = 1 - snackShare * snackCount;
  const shares = twoMeals ? { breakfast: 0.45, lunch: 0.1, dinner: 0.45 } : { breakfast: mainsShare * 0.3, lunch: mainsShare * 0.35, dinner: mainsShare * 0.35 };

  const breakfasts = pickWeek(mealOptions(profile, 'breakfast'), rng);
  const lunches = pickWeek(mealOptions(profile, twoMeals ? 'snack' : 'main'), rng);
  const dinners = pickWeek(mealOptions(profile, 'main'), rng, twoMeals ? undefined : lunches);
  const snackWeeks = Array.from({ length: snackCount }, () => pickWeek(mealOptions(profile, 'snack'), rng));

  const boost = proteinBoost(profile);
  const boostsUsed = new Set<string>();
  // Builds one day, leaving room for 'boostKcal' of protein add-ons.
  const buildDay = (day: number, boostKcal: number): DayMeals => {
    const kcal = dailyKcal - boostKcal;
    return {
      day,
      breakfast: scaleMeal(breakfasts[day], kcal * shares.breakfast),
      lunch: scaleMeal(lunches[day], kcal * shares.lunch),
      dinner: scaleMeal(dinners[day], kcal * shares.dinner),
      snacks: snackWeeks.map((week) => scaleMeal(week[day], kcal * snackShare)),
    };
  };
  const proteinOf = (d: DayMeals) => [d.breakfast, d.lunch, d.dinner, ...d.snacks].reduce((sum, m) => sum + m.proteinG, 0);

  const mealPlan: DayMeals[] = Array.from({ length: 7 }, (_, day) => {
    let plan = buildDay(day, 0);
    if (!boost || proteinOf(plan) >= proteinTarget * 0.85) return plan;
    // Short on protein: shrink the meals a little to make room, then add a
    // protein side to dinner, then breakfast, then lunch if still short.
    const needed = Math.min(3, Math.ceil((proteinTarget * 0.85 - proteinOf(plan)) / boost.protein));
    plan = buildDay(day, needed * boost.kcal);
    for (const slot of (['dinner', 'breakfast', 'lunch'] as const).slice(0, needed)) {
      plan = { ...plan, [slot]: addToMeal(plan[slot], boost) };
    }
    boostsUsed.add(boost.item);
    return plan;
  });

  // Grocery list: every food used this week, grouped by market section.
  const all = [...breakfasts, ...lunches, ...dinners, ...snackWeeks.flat()];
  const bySection = new Map<string, Set<string>>();
  const addItem = (section: string, item: string) => {
    if (!bySection.has(section)) bySection.set(section, new Set());
    bySection.get(section)!.add(item);
  };
  for (const t of all) for (const item of t.items) addItem(item.section, item.item);
  if (boost && boostsUsed.size > 0) addItem(boost.section, boost.item.replace(/^Extra /, '').replace(/^./, (c) => c.toUpperCase()));
  const groceryList = SECTION_ORDER.filter((sec) => bySection.has(sec)).map((section) => ({
    section,
    items: [...bySection.get(section)!].sort(),
  }));

  return { mealPlan, groceryList };
}
