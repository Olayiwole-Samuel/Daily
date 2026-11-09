// Built-in meal ideas by cuisine, with everyday portions and rough calories/protein.
// The free planner scales the portions up or down to hit each person's target.
// Numbers are approximate home-cooking values, not lab measurements.

export type Section = 'Grains and swallows' | 'Beans and legumes' | 'Protein' | 'Vegetables' | 'Fruit' | 'Dairy' | 'Nuts and snacks';
export type Tag = 'beef' | 'pork' | 'chicken' | 'fish' | 'shellfish' | 'egg' | 'dairy' | 'nuts' | 'gluten' | 'sugary';
export type Slot = 'breakfast' | 'main' | 'snack';

export interface FoodItem {
  item: string;
  qty: number; // e.g. 2
  unit: [string, string]; // singular, plural: ['cooking spoon', 'cooking spoons']
  kcal: number; // for qty
  protein: number; // grams for qty
  section: Section;
  whole?: boolean; // count only in whole numbers (eggs, pieces)
}

export interface MealTemplate {
  name: string;
  slot: Slot;
  items: FoodItem[];
  tags: Tag[];
  budget: 1 | 2 | 3; // 1 = cheapest
}

// Shorthand to keep the lists readable.
const f = (item: string, qty: number, unit: [string, string], kcal: number, protein: number, section: Section, whole = false): FoodItem => ({
  item,
  qty,
  unit,
  kcal,
  protein,
  section,
  whole,
});
const m = (name: string, slot: Slot, budget: 1 | 2 | 3, tags: Tag[], ...items: FoodItem[]): MealTemplate => ({ name, slot, budget, tags, items });

// Common units
const SPOON: [string, string] = ['cooking spoon', 'cooking spoons'];
const WRAP: [string, string] = ['wrap (fist-sized)', 'wraps (fist-sized)'];
const LADLE: [string, string] = ['ladle', 'ladles'];
const PIECE: [string, string] = ['medium piece', 'medium pieces'];
const SMALL_PIECE: [string, string] = ['small piece', 'small pieces'];
const CUP: [string, string] = ['cup', 'cups'];
const EGG: [string, string] = ['egg', 'eggs'];
const SLICE: [string, string] = ['slice', 'slices'];
const HANDFUL: [string, string] = ['handful', 'handfuls'];
const MEDIUM: [string, string] = ['medium', 'medium'];
const BALL: [string, string] = ['ball', 'balls'];

// Shared foods
const boiledEgg = (n = 2) => f('Boiled eggs', n, EGG, 70 * n, 6 * n, 'Protein', true);
const fish = f('Fish (grilled or in stew)', 1, PIECE, 160, 24, 'Protein', true);
const chicken = f('Chicken (skin off)', 1, PIECE, 200, 26, 'Protein', true);
const salad = f('Salad or sliced cucumber', 1, HANDFUL, 30, 1, 'Vegetables');

// ---------- Nigerian ----------
const NIGERIAN: MealTemplate[] = [
  m('Moi moi and pap', 'breakfast', 1, [], f('Moi moi', 1, ['wrap (palm-sized)', 'wraps (palm-sized)'], 200, 11, 'Beans and legumes', true), f('Pap (akamu)', 1, CUP, 130, 3, 'Grains and swallows')),
  m('Boiled eggs and plantain', 'breakfast', 1, ['egg'], boiledEgg(), f('Boiled ripe plantain', 1, ['medium finger', 'medium fingers'], 220, 2, 'Fruit')),
  m('Akara (less oil) and pap', 'breakfast', 1, [], f('Akara', 4, ['small ball', 'small balls'], 240, 10, 'Beans and legumes', true), f('Pap (akamu)', 1, CUP, 130, 3, 'Grains and swallows')),
  m('Yam and egg sauce', 'breakfast', 2, ['egg'], f('Boiled yam', 2, ['medium slice', 'medium slices'], 260, 3, 'Grains and swallows', true), f('Egg and tomato sauce (2 eggs)', 1, LADLE, 200, 13, 'Protein')),
  m('Sweet potato and eggs', 'breakfast', 1, ['egg'], f('Boiled sweet potato', 1, MEDIUM, 180, 4, 'Grains and swallows', true), boiledEgg()),
  m('Wholemeal bread and eggs', 'breakfast', 2, ['egg', 'gluten'], f('Wholemeal bread', 2, SLICE, 160, 7, 'Grains and swallows', true), boiledEgg()),
  m('Oats with milk and banana', 'breakfast', 2, ['dairy'], f('Oats', 1, CUP, 160, 6, 'Grains and swallows'), f('Milk', 1, ['small cup', 'small cups'], 90, 5, 'Dairy'), f('Banana', 1, MEDIUM, 100, 1, 'Fruit', true)),

  m('Jollof rice with chicken', 'main', 2, ['chicken'], f('Jollof rice', 2, SPOON, 300, 6, 'Grains and swallows'), chicken, salad),
  m('Beans porridge and roasted plantain', 'main', 1, [], f('Beans porridge (less oil)', 2, SPOON, 300, 16, 'Beans and legumes'), f('Roasted plantain (boli)', 0.5, MEDIUM, 110, 1, 'Fruit')),
  m('Eba with efo riro and fish', 'main', 1, ['fish'], f('Eba', 1, WRAP, 330, 1, 'Grains and swallows', true), f('Efo riro', 1, LADLE, 150, 6, 'Vegetables'), fish),
  m('Amala with ewedu, gbegiri and beef', 'main', 2, ['beef'], f('Amala', 1, WRAP, 280, 3, 'Grains and swallows', true), f('Ewedu and gbegiri', 1, LADLE, 180, 9, 'Vegetables'), f('Lean beef', 2, SMALL_PIECE, 150, 18, 'Protein', true)),
  m('Ofada rice and stew with egg', 'main', 2, ['egg'], f('Ofada rice', 2, SPOON, 290, 6, 'Grains and swallows'), f('Ofada stew (less oil, pepper base)', 1, ['small ladle', 'small ladles'], 150, 5, 'Vegetables'), boiledEgg(1)),
  m('Fufu with okra soup and fish', 'main', 1, ['fish'], f('Fufu', 1, WRAP, 330, 1, 'Grains and swallows', true), f('Okra soup', 1, LADLE, 120, 6, 'Vegetables'), fish),
  m('Yam porridge (asaro) with fish', 'main', 1, ['fish'], f('Yam porridge (asaro)', 2, LADLE, 350, 6, 'Grains and swallows'), fish),
  m('Rice and beans with chicken', 'main', 2, ['chicken'], f('Rice and beans', 2, SPOON, 320, 12, 'Grains and swallows'), f('Tomato stew (less oil)', 1, ['small ladle', 'small ladles'], 100, 2, 'Vegetables'), chicken),
  m('Spaghetti jollof with eggs', 'main', 1, ['egg', 'gluten'], f('Spaghetti jollof', 2, SPOON, 300, 10, 'Grains and swallows'), boiledEgg(), salad),
  m('Catfish pepper soup and boiled yam', 'main', 2, ['fish'], f('Catfish pepper soup', 1, ['bowl', 'bowls'], 250, 30, 'Protein', true), f('Boiled yam', 1, ['medium slice', 'medium slices'], 130, 2, 'Grains and swallows', true)),
  m('Adalu (beans and corn)', 'main', 1, [], f('Adalu (beans and corn)', 2, SPOON, 320, 14, 'Beans and legumes'), salad),
  m('Semo with edikang ikong and fish', 'main', 3, ['fish', 'gluten'], f('Semo', 1, WRAP, 330, 10, 'Grains and swallows', true), f('Edikang ikong', 1, LADLE, 200, 12, 'Vegetables'), fish),
  m('Suya with salad and boiled yam', 'main', 2, ['beef'], f('Suya', 1, ['small portion', 'small portions'], 250, 30, 'Protein', true), f('Boiled yam', 1, ['medium slice', 'medium slices'], 130, 2, 'Grains and swallows', true), salad),
  m('Eba with efo riro and wara', 'main', 2, ['dairy'], f('Eba', 1, WRAP, 330, 1, 'Grains and swallows', true), f('Efo riro (vegetables only)', 1, LADLE, 150, 6, 'Vegetables'), f('Wara (local cheese)', 2, SMALL_PIECE, 150, 14, 'Dairy', true)),

  m('Fruit', 'snack', 1, [], f('Orange or banana', 1, MEDIUM, 90, 1, 'Fruit', true)),
  m('Groundnuts', 'snack', 1, ['nuts'], f('Roasted groundnuts', 1, ['small handful', 'small handfuls'], 170, 7, 'Nuts and snacks')),
  m('Garden eggs', 'snack', 1, [], f('Garden eggs', 3, ['piece', 'pieces'], 60, 2, 'Vegetables', true)),
  m('Boiled corn', 'snack', 1, [], f('Boiled corn', 1, ['cob', 'cobs'], 120, 4, 'Grains and swallows', true)),
  m('Tiger nuts', 'snack', 1, ['nuts'], f('Tiger nuts', 1, ['small handful', 'small handfuls'], 150, 2, 'Nuts and snacks')),
  m('Boiled egg', 'snack', 1, ['egg'], boiledEgg(1)),
  m('Plain yoghurt', 'snack', 2, ['dairy'], f('Plain yoghurt', 1, ['small cup', 'small cups'], 100, 6, 'Dairy', true)),
  m('Watermelon', 'snack', 1, [], f('Watermelon', 2, SLICE, 90, 2, 'Fruit', true)),
];

// ---------- Ghanaian ----------
const GHANAIAN: MealTemplate[] = [
  m('Hausa koko and koose', 'breakfast', 1, [], f('Hausa koko', 1, CUP, 160, 4, 'Grains and swallows'), f('Koose', 4, ['small ball', 'small balls'], 220, 9, 'Beans and legumes', true)),
  m('Tom brown porridge', 'breakfast', 1, ['nuts'], f('Tom brown porridge', 1, CUP, 220, 8, 'Grains and swallows'), f('Banana', 1, MEDIUM, 100, 1, 'Fruit', true)),
  m('Boiled eggs and plantain', 'breakfast', 1, ['egg'], boiledEgg(), f('Boiled ripe plantain', 1, ['medium finger', 'medium fingers'], 220, 2, 'Fruit')),
  m('Waakye with egg and fish', 'main', 1, ['egg', 'fish'], f('Waakye', 2, SPOON, 330, 12, 'Grains and swallows'), boiledEgg(1), fish),
  m('Banku with okro stew and fish', 'main', 1, ['fish'], f('Banku', 1, BALL, 350, 5, 'Grains and swallows', true), f('Okro stew', 1, LADLE, 130, 6, 'Vegetables'), fish),
  m('Kenkey with grilled tilapia and pepper', 'main', 2, ['fish'], f('Kenkey', 1, BALL, 350, 6, 'Grains and swallows', true), f('Grilled tilapia', 1, MEDIUM, 200, 30, 'Protein', true), salad),
  m('Red red (beans and plantain)', 'main', 1, [], f('Red red beans stew (less oil)', 2, SPOON, 300, 14, 'Beans and legumes'), f('Boiled ripe plantain', 0.5, MEDIUM, 110, 1, 'Fruit')),
  m('Light soup with chicken and fufu', 'main', 2, ['chicken'], f('Fufu', 1, WRAP, 330, 1, 'Grains and swallows', true), f('Light soup', 1, LADLE, 80, 3, 'Vegetables'), chicken),
  m('Kontomire stew with yam and egg', 'main', 1, ['egg'], f('Boiled yam', 2, ['medium slice', 'medium slices'], 260, 3, 'Grains and swallows', true), f('Kontomire stew (no fish)', 1, LADLE, 150, 8, 'Vegetables'), boiledEgg(1)),
  m('Jollof rice with chicken', 'main', 2, ['chicken'], f('Jollof rice', 2, SPOON, 300, 6, 'Grains and swallows'), chicken, salad),
  m('Waakye with egg and avocado', 'main', 1, ['egg'], f('Waakye', 2, SPOON, 330, 12, 'Grains and swallows'), boiledEgg(1), f('Avocado', 0.5, MEDIUM, 120, 1, 'Fruit')),
  m('Yam with garden egg stew', 'main', 1, [], f('Boiled yam', 2, ['medium slice', 'medium slices'], 260, 3, 'Grains and swallows', true), f('Garden egg stew (no fish)', 1, LADLE, 140, 4, 'Vegetables'), f('Beans', 1, SPOON, 150, 8, 'Beans and legumes')),
  m('Roasted plantain and groundnuts', 'snack', 1, ['nuts'], f('Roasted plantain', 0.5, MEDIUM, 110, 1, 'Fruit'), f('Groundnuts', 1, ['small handful', 'small handfuls'], 170, 7, 'Nuts and snacks')),
  m('Pineapple', 'snack', 1, [], f('Pineapple', 2, SLICE, 80, 1, 'Fruit', true)),
  m('Boiled corn', 'snack', 1, [], f('Boiled corn', 1, ['cob', 'cobs'], 120, 4, 'Grains and swallows', true)),
];

// ---------- East African ----------
const EAST_AFRICAN: MealTemplate[] = [
  m('Uji and boiled egg', 'breakfast', 1, ['egg'], f('Uji (millet porridge, little sugar)', 1, CUP, 180, 5, 'Grains and swallows'), boiledEgg(1)),
  m('Sweet potato and eggs', 'breakfast', 1, ['egg'], f('Boiled sweet potato', 1, MEDIUM, 180, 4, 'Grains and swallows', true), boiledEgg()),
  m('Arrowroot and tea', 'breakfast', 1, [], f('Boiled arrowroot (nduma)', 1, MEDIUM, 200, 3, 'Grains and swallows', true), f('Tea with milk, little sugar', 1, CUP, 60, 2, 'Dairy')),
  m('Ugali with sukuma wiki and fish', 'main', 1, ['fish'], f('Ugali', 1, ['palm-sized piece', 'palm-sized pieces'], 300, 6, 'Grains and swallows', true), f('Sukuma wiki', 1, CUP, 80, 3, 'Vegetables'), f('Tilapia', 1, MEDIUM, 200, 30, 'Protein', true)),
  m('Ugali with sukuma wiki and beef stew', 'main', 2, ['beef'], f('Ugali', 1, ['palm-sized piece', 'palm-sized pieces'], 300, 6, 'Grains and swallows', true), f('Sukuma wiki', 1, CUP, 80, 3, 'Vegetables'), f('Beef stew', 1, LADLE, 220, 22, 'Protein')),
  m('Githeri', 'main', 1, [], f('Githeri (maize and beans)', 2, CUP, 350, 15, 'Beans and legumes'), salad),
  m('Rice with ndengu', 'main', 1, [], f('Rice', 2, SPOON, 260, 5, 'Grains and swallows'), f('Ndengu (green grams) stew', 1, LADLE, 200, 12, 'Beans and legumes')),
  m('Chapati (less oil) with beans', 'main', 1, ['gluten'], f('Chapati', 1, ['piece', 'pieces'], 250, 6, 'Grains and swallows', true), f('Beans stew (maharagwe)', 1, LADLE, 220, 12, 'Beans and legumes')),
  m('Matoke with chicken', 'main', 2, ['chicken'], f('Matoke stew', 2, LADLE, 260, 3, 'Grains and swallows'), chicken),
  m('Roasted maize', 'snack', 1, [], f('Roasted maize', 1, ['cob', 'cobs'], 120, 4, 'Grains and swallows', true)),
  m('Mango', 'snack', 1, [], f('Mango', 0.5, MEDIUM, 100, 1, 'Fruit')),
  m('Mala', 'snack', 2, ['dairy'], f('Mala (fermented milk)', 1, ['small cup', 'small cups'], 120, 6, 'Dairy', true)),
];

// ---------- General (any cuisine) ----------
const GENERAL: MealTemplate[] = [
  m('Oats with banana', 'breakfast', 1, [], f('Oats cooked with water', 1, CUP, 160, 6, 'Grains and swallows'), f('Banana', 1, MEDIUM, 100, 1, 'Fruit', true)),
  m('Eggs on wholegrain toast', 'breakfast', 2, ['egg', 'gluten'], boiledEgg(), f('Wholegrain toast', 2, SLICE, 160, 7, 'Grains and swallows', true)),
  m('Yoghurt with fruit and nuts', 'breakfast', 2, ['dairy', 'nuts'], f('Plain yoghurt', 1, CUP, 150, 10, 'Dairy'), f('Fruit', 1, HANDFUL, 60, 1, 'Fruit'), f('Nuts', 1, ['small handful', 'small handfuls'], 170, 6, 'Nuts and snacks')),
  m('Rice with chicken and vegetables', 'main', 2, ['chicken'], f('Rice', 1, CUP, 240, 5, 'Grains and swallows'), chicken, f('Cooked vegetables', 1, CUP, 60, 3, 'Vegetables')),
  m('Potatoes with fish and salad', 'main', 2, ['fish'], f('Boiled potatoes', 2, MEDIUM, 240, 5, 'Grains and swallows', true), fish, salad),
  m('Lentil stew with rice', 'main', 1, [], f('Lentil stew', 1, CUP, 230, 16, 'Beans and legumes'), f('Rice', 1, CUP, 240, 5, 'Grains and swallows')),
  m('Bean and vegetable chilli with rice', 'main', 1, [], f('Bean and vegetable chilli', 1, CUP, 250, 14, 'Beans and legumes'), f('Rice', 1, CUP, 240, 5, 'Grains and swallows')),
  m('Omelette with salad and bread', 'main', 1, ['egg', 'gluten'], f('Vegetable omelette (2 eggs)', 1, ['omelette', 'omelettes'], 220, 14, 'Protein', true), f('Wholegrain bread', 2, SLICE, 160, 7, 'Grains and swallows', true), salad),
  m('Pasta with lean mince and vegetables', 'main', 2, ['beef', 'gluten'], f('Pasta', 1, CUP, 220, 8, 'Grains and swallows'), f('Lean mince sauce', 1, LADLE, 250, 22, 'Protein'), f('Cooked vegetables', 1, CUP, 60, 3, 'Vegetables')),
  m('Fruit', 'snack', 1, [], f('Apple, orange or banana', 1, MEDIUM, 90, 1, 'Fruit', true)),
  m('Vegetable sticks', 'snack', 1, [], f('Carrot and cucumber sticks', 1, HANDFUL, 40, 1, 'Vegetables')),
  m('Nuts', 'snack', 2, ['nuts'], f('Mixed nuts', 1, ['small handful', 'small handfuls'], 170, 6, 'Nuts and snacks')),
  m('Plain yoghurt', 'snack', 2, ['dairy'], f('Plain yoghurt', 1, ['small cup', 'small cups'], 100, 6, 'Dairy', true)),
];

export type Cuisine = 'nigerian' | 'ghanaian' | 'eastAfrican' | 'westAfrican' | 'general';

export function cuisineFor(nationality: string): Cuisine {
  const n = nationality.toLowerCase();
  if (n.includes('niger')) return n.includes('nigerien') ? 'westAfrican' : 'nigerian';
  if (n.includes('ghan')) return 'ghanaian';
  if (['keny', 'ugand', 'tanzan', 'rwand', 'east afric'].some((w) => n.includes(w))) return 'eastAfrican';
  if (['cameroon', 'senegal', 'sierra', 'liberia', 'togo', 'benin', 'gambi', 'ivor', 'west afric'].some((w) => n.includes(w))) return 'westAfrican';
  return 'general';
}

export function templatesFor(cuisine: Cuisine): MealTemplate[] {
  switch (cuisine) {
    case 'nigerian':
      return NIGERIAN;
    case 'ghanaian':
      return GHANAIAN;
    case 'eastAfrican':
      return EAST_AFRICAN;
    case 'westAfrican':
      return [...NIGERIAN, ...GHANAIAN];
    case 'general':
      return GENERAL;
  }
}

export const GENERAL_TEMPLATES = GENERAL;

export const SWAPS: Record<Cuisine, { instead: string; have: string }[]> = {
  nigerian: [
    { instead: 'Fried dodo', have: 'Boiled or roasted plantain (boli)' },
    { instead: 'Lots of palm oil in stew', have: 'Measure the oil: 1-2 tablespoons per pot' },
    { instead: 'Big wrap of swallow', have: 'Fist-sized wrap with more soup vegetables' },
    { instead: 'Soft drinks and malt', have: 'Water, or zobo with little or no sugar' },
    { instead: 'Puff-puff or meat pie snacks', have: 'Boiled corn, groundnuts or fruit' },
  ],
  ghanaian: [
    { instead: 'Fried kelewele', have: 'Roasted plantain with the same spices' },
    { instead: 'Oily stews', have: 'Measure the oil: 1-2 tablespoons per pot' },
    { instead: 'Sugary drinks', have: 'Water or sobolo with little sugar' },
    { instead: 'Big balls of banku or fufu', have: 'A fist-sized ball with more soup and fish' },
  ],
  eastAfrican: [
    { instead: 'Mandazi', have: 'Boiled arrowroot or sweet potato' },
    { instead: 'Chapati fried in lots of oil', have: 'Chapati with a light brush of oil' },
    { instead: 'Tea with 3 sugars', have: 'Tea with 1 sugar or none' },
    { instead: 'Chips (fries)', have: 'Boiled or roasted potatoes' },
  ],
  westAfrican: [
    { instead: 'Fried plantain', have: 'Boiled or roasted plantain' },
    { instead: 'Lots of oil in stews', have: 'Measure the oil: 1-2 tablespoons per pot' },
    { instead: 'Sugary drinks', have: 'Water or homemade drinks with little sugar' },
  ],
  general: [
    { instead: 'Fried foods', have: 'Grilled, boiled or baked versions' },
    { instead: 'Sugary drinks', have: 'Water or sugar-free drinks' },
    { instead: 'White bread', have: 'Wholegrain bread' },
    { instead: 'Biscuits and crisps', have: 'Fruit, nuts or yoghurt' },
  ],
};

export const SECTION_ORDER: Section[] = ['Grains and swallows', 'Beans and legumes', 'Protein', 'Vegetables', 'Fruit', 'Dairy', 'Nuts and snacks'];
