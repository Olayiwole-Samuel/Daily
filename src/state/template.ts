import type { Goal, ISODate, Weekday } from '../types';
import { ALL_DAYS, addDaysISO, newId, weekStart, weekdayIndex } from '../lib/dates';

export const DEFAULT_EATING_RULES = [
  "Plan tomorrow's meals the night before",
  'Half the plate vegetables',
  'Smaller swallow, more soup vegetables',
  'Water before each meal, no sugary drinks',
  "Don't skip meals",
  'Finish dinner by 8pm',
];

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4];

// Builds the 7 goals from the week plan. Milestone dates land in the current week.
export function createTemplateGoals(today: ISODate): Goal[] {
  // On a Sunday the week is basically over, so plan the milestones for the
  // coming week instead of filling Today with six overdue items.
  const monday = weekdayIndex(today) === 6 ? addDaysISO(weekStart(today), 7) : weekStart(today);
  const base = { archived: false, createdAt: today };
  const jsTopics = [
    'Functions',
    'Function expressions + scope',
    'Arrow functions',
    'Booleans + ternary',
    'Arrays',
    'Array methods + mini project',
  ];

  return [
    { ...base, id: newId(), title: 'Bible study + prayer', type: 'daily', color: '#b026ff', scheduledDays: ALL_DAYS, note: '30 min, 5:30am' },
    { ...base, id: newId(), title: 'Workout', type: 'weeklyCount', color: '#ff3864', scheduledDays: ALL_DAYS, target: 5, unit: 'workouts', note: '6:00am' },
    { ...base, id: newId(), title: '2pm class', type: 'daily', color: '#00f0ff', scheduledDays: WEEKDAYS, note: '2:00pm' },
    {
      ...base,
      id: newId(),
      title: 'JS class',
      type: 'milestones',
      color: '#ffe600',
      scheduledDays: ALL_DAYS,
      // Mon..Sat, one topic per day.
      milestones: jsTopics.map((title, i) => ({ id: newId(), title, plannedDate: addDaysISO(monday, i) })),
    },
    { ...base, id: newId(), title: 'Read the book', type: 'numberTarget', color: '#39ff14', scheduledDays: ALL_DAYS, target: 150, unit: 'pages' },
    { ...base, id: newId(), title: 'Learn something new', type: 'journal', color: '#ff8a00', scheduledDays: ALL_DAYS },
    { ...base, id: newId(), title: 'Log my meals', type: 'daily', color: '#00ffc6', scheduledDays: ALL_DAYS, note: 'See the Food tab' },
  ];
}
