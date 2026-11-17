// Movement library for the animated exercise character.
// Each motion is a few key poses (see skeleton.ts); the character moves smoothly
// between them. Picture is 200 x 200, ground at y = 185, character faces right.
import { GROUND_Y as G, shoulderOf, type Point, type Pose } from './skeleton';

export type Prop = 'weight' | 'chair' | 'step' | 'table' | 'bench' | 'bar' | 'rope' | 'seat';

export interface Motion {
  key: string;
  frames: Pose[];
  periodMs: number; // one full repetition
  loop: 'pingpong' | 'cycle'; // A→B→A, or A→B→C→A
  props?: Prop[];
  elbowBend?: 1 | -1; // which way elbows fold (default -1: backwards)
  kneeBend?: 1 | -1; // which way knees fold (default +1: forwards)
}

// Builds a pose. Hands are given RELATIVE to the shoulder (easy to author),
// unless `handsAbsolute` is set (for hands fixed on the floor, a bar, a chair...).
function pose(hip: Point, torso: number, hands: [Point, Point], feet: [Point, Point], handsAbsolute = false): Pose {
  const s = shoulderOf(hip, torso);
  const abs = (h: Point): Point => (handsAbsolute ? h : [s[0] + h[0], s[1] + h[1]]);
  return { hip, torso, handNear: abs(hands[0]), handFar: abs(hands[1]), footNear: feet[0], footFar: feet[1] };
}

// ---------- Shared poses ----------
const ARMS_DOWN: [Point, Point] = [[3, 53], [-3, 53]];
const FEET: [Point, Point] = [[106, G], [99, G]];
const STAND = pose([102, 117], 0, ARMS_DOWN, FEET);
const STAND_ARMS_UP = pose([102, 117], 0, [[6, -52], [2, -52]], FEET);

// Push-up position: straight line from feet to shoulders, hands under shoulders.
const PUSHUP_FEET: [Point, Point] = [[40, G], [36, G]];
const PUSHUP_HANDS: [Point, Point] = [[145, G], [141, G]];
const PUSHUP_TOP = pose([100.6, 154.1], 63, PUSHUP_HANDS, PUSHUP_FEET, true);
const PUSHUP_BOTTOM = pose([107.3, 175.5], 82, PUSHUP_HANDS, PUSHUP_FEET, true);
const CROUCH = pose([98, 152], 50, [[132, G], [128, G]], [[106, G], [100, G]], true);

// Lying on the back (head to the left).
const LYING_FEET: [Point, Point] = [[146, G], [142, G]];

export const MOTIONS: Record<string, Motion> = {
  stand: {
    key: 'stand',
    frames: [STAND, pose([102, 118], 0, [[8, 52], [-8, 52]], FEET)],
    periodMs: 3000,
    loop: 'pingpong',
  },

  // ---------- Squats & lunges ----------
  squat: {
    key: 'squat',
    frames: [STAND, pose([84, 149], 38, [[46, 6], [42, 9]], FEET)],
    periodMs: 2400,
    loop: 'pingpong',
  },
  gobletSquat: {
    key: 'gobletSquat',
    frames: [pose([102, 117], 0, [[14, 14], [11, 16]], FEET), pose([86, 148], 30, [[16, 16], [13, 18]], FEET)],
    periodMs: 2400,
    loop: 'pingpong',
    props: ['weight'],
  },
  chairSquat: {
    key: 'chairSquat',
    frames: [STAND, pose([80, 150], 36, [[46, 8], [42, 10]], FEET)],
    periodMs: 2800,
    loop: 'pingpong',
    props: ['chair'],
  },
  jumpSquat: {
    key: 'jumpSquat',
    frames: [pose([84, 149], 38, [[30, 30], [26, 32]], FEET), pose([102, 98], 0, [[6, -52], [2, -52]], [[106, 166], [99, 166]])],
    periodMs: 1300,
    loop: 'pingpong',
  },
  lunge: {
    key: 'lunge',
    frames: [STAND, pose([92, 146], 4, ARMS_DOWN, [[127, G], [50, G - 1]])],
    periodMs: 2400,
    loop: 'pingpong',
  },
  splitSquat: {
    key: 'splitSquat',
    frames: [pose([92, 125], 4, ARMS_DOWN, [[127, G], [58, G - 1]]), pose([90, 148], 4, ARMS_DOWN, [[127, G], [58, G - 1]])],
    periodMs: 2400,
    loop: 'pingpong',
  },
  stepUp: {
    key: 'stepUp',
    frames: [pose([102, 117], 0, ARMS_DOWN, [[130, 158], [99, G]]), pose([126, 92], 4, ARMS_DOWN, [[134, 158], [128, 150]])],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['step'],
  },
  calfRaise: {
    key: 'calfRaise',
    frames: [STAND, pose([102, 108], 0, ARMS_DOWN, [[106, G - 8], [99, G - 8]])],
    periodMs: 1600,
    loop: 'pingpong',
  },

  // ---------- Hinges & bridges ----------
  hinge: {
    key: 'hinge',
    frames: [STAND, pose([80, 123], 78, [[0, 54], [-3, 54]], FEET)],
    periodMs: 2600,
    loop: 'pingpong',
  },
  deadlift: {
    key: 'deadlift',
    frames: [pose([82, 138], 62, [[0, 52], [-3, 52]], FEET), STAND],
    periodMs: 2600,
    loop: 'pingpong',
    props: ['weight'],
  },
  swing: {
    key: 'swing',
    frames: [pose([84, 128], 65, [[-18, 46], [-20, 46]], FEET), pose([102, 117], -4, [[50, -2], [46, 0]], FEET)],
    periodMs: 1400,
    loop: 'pingpong',
    props: ['weight'],
  },
  bridge: {
    key: 'bridge',
    frames: [pose([110, 177], -92, [[112, G], [108, G]], LYING_FEET, true), pose([112, 150], -121, [[114, G], [110, G]], LYING_FEET, true)],
    periodMs: 2200,
    loop: 'pingpong',
    elbowBend: 1, // arms lie on the floor; elbows fold up, not into the ground
  },
  singleLegBridge: {
    key: 'singleLegBridge',
    frames: [
      pose([110, 177], -92, [[112, G], [108, G]], [[146, G], [160, 168]], true),
      pose([112, 150], -121, [[114, G], [110, G]], [[146, G], [168, 132]], true),
    ],
    periodMs: 2200,
    loop: 'pingpong',
    elbowBend: 1,
  },
  hipThrust: {
    key: 'hipThrust',
    frames: [pose([100, 180], -55, [[70, 150], [66, 150]], [[142, G], [138, G]], true), pose([108, 152], -88, [[70, 150], [66, 150]], [[142, G], [138, G]], true)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['bench'],
  },

  // ---------- Pushing ----------
  pushUp: {
    key: 'pushUp',
    frames: [PUSHUP_TOP, PUSHUP_BOTTOM],
    periodMs: 2200,
    loop: 'pingpong',
  },
  inclinePushUp: {
    key: 'inclinePushUp',
    frames: [pose([108, 137], 45, [[150, 150], [147, 150]], [[60, G], [56, G]], true), pose([119, 151], 60, [[150, 150], [147, 150]], [[60, G], [56, G]], true)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['table'],
  },
  dip: {
    key: 'dip',
    frames: [pose([98, 124], 4, [[80, 128], [76, 128]], [[138, G], [134, G]], true), pose([98, 142], 4, [[80, 128], [76, 128]], [[138, G], [134, G]], true)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['chair'],
  },
  floorPress: {
    key: 'floorPress',
    frames: [pose([120, 178], -90, [[0, -52], [-3, -52]], LYING_FEET), pose([120, 178], -90, [[10, -22], [7, -22]], LYING_FEET)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['weight'],
  },
  benchPress: {
    key: 'benchPress',
    frames: [pose([120, 152], -90, [[0, -52], [-3, -52]], LYING_FEET), pose([120, 152], -90, [[10, -22], [7, -22]], LYING_FEET)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['weight', 'bench'],
  },
  shoulderPress: {
    key: 'shoulderPress',
    frames: [pose([102, 117], 0, [[8, 2], [5, 4]], FEET), pose([102, 117], 0, [[4, -52], [1, -52]], FEET)],
    periodMs: 2000,
    loop: 'pingpong',
    props: ['weight'],
  },
  chestPress: {
    key: 'chestPress',
    frames: [pose([102, 117], 0, [[12, 6], [9, 8]], FEET), pose([102, 117], 0, [[52, 4], [49, 6]], FEET)],
    periodMs: 2000,
    loop: 'pingpong',
  },

  // ---------- Pulling ----------
  bentRow: {
    key: 'bentRow',
    frames: [pose([84, 121], 70, [[2, 52], [-2, 52]], FEET), pose([84, 121], 70, [[-14, 26], [-17, 26]], FEET)],
    periodMs: 2000,
    loop: 'pingpong',
    props: ['weight'],
  },
  standingRow: {
    key: 'standingRow',
    frames: [pose([102, 117], 0, [[50, 4], [46, 6]], FEET), pose([102, 117], 0, [[-6, 24], [-9, 26]], FEET)],
    periodMs: 2000,
    loop: 'pingpong',
  },
  pullUp: {
    key: 'pullUp',
    frames: [
      pose([100, 108], 0, [[106, 4], [100, 4]], [[103, 175], [98, 175]], true),
      pose([100, 78], 0, [[106, 4], [100, 4]], [[102, 146], [97, 146]], true),
    ],
    periodMs: 2400,
    loop: 'pingpong',
    props: ['bar'],
  },
  pulldown: {
    key: 'pulldown',
    frames: [pose([100, 140], 0, [[106, 34], [102, 34]], [[150, G], [146, G]], true), pose([100, 140], 0, [[112, 96], [108, 96]], [[150, G], [146, G]], true)],
    periodMs: 2200,
    loop: 'pingpong',
    props: ['seat'],
  },
  superman: {
    key: 'superman',
    frames: [pose([80, 178], 90, [[52, 2], [50, 4]], [[14, 182], [12, G - 2]]), pose([80, 176], 78, [[50, -12], [48, -10]], [[16, 168], [14, 170]])],
    periodMs: 2200,
    loop: 'pingpong',
  },
  curl: {
    key: 'curl',
    frames: [pose([102, 117], 0, ARMS_DOWN, FEET), pose([102, 117], 0, [[14, 12], [11, 14]], FEET)],
    periodMs: 1800,
    loop: 'pingpong',
    props: ['weight'],
  },
  frontRaise: {
    key: 'frontRaise',
    frames: [pose([102, 117], 0, ARMS_DOWN, FEET), pose([102, 117], 0, [[52, -2], [49, 0]], FEET)],
    periodMs: 2000,
    loop: 'pingpong',
    props: ['weight'],
  },

  // ---------- Core ----------
  plank: {
    key: 'plank',
    frames: [pose([106.1, 168.9], 76.3, [[181, G], [177, G]], PUSHUP_FEET, true), pose([106.1, 166.5], 75, [[181, G], [177, G]], PUSHUP_FEET, true)],
    periodMs: 3000,
    loop: 'pingpong',
  },
  deadBug: {
    key: 'deadBug',
    frames: [
      pose([100, 178], -90, [[0, -52], [-3, -52]], [[134, 144], [130, 144]]),
      pose([100, 178], -90, [[-52, -6], [-3, -52]], [[134, 144], [166, 170]]),
    ],
    periodMs: 2400,
    loop: 'pingpong',
  },
  birdDog: {
    key: 'birdDog',
    frames: [
      pose([80, 152], 72, [[130, G], [126, G]], [[44, G], [40, G]], true),
      pose([80, 150], 74, [[186, 128], [126, G]], [[44, G], [10, 146]], true),
    ],
    periodMs: 2600,
    loop: 'pingpong',
  },
  hollow: {
    key: 'hollow',
    frames: [pose([100, 178], -80, [[-50, -14], [-48, -12]], [[163, 166], [161, 168]]), pose([100, 178], -84, [[-50, -10], [-48, -8]], [[164, 172], [162, 174]])],
    periodMs: 2400,
    loop: 'pingpong',
  },
  crunch: {
    key: 'crunch',
    frames: [pose([100, 178], -92, [[-6, -8], [-8, -6]], [[132, G], [128, G]]), pose([100, 178], -60, [[-6, -8], [-8, -6]], [[132, G], [128, G]])],
    periodMs: 2000,
    loop: 'pingpong',
  },
  mountainClimber: {
    key: 'mountainClimber',
    frames: [
      pose([100.6, 154.1], 63, PUSHUP_HANDS, [[40, G], [112, 168]], true),
      pose([100.6, 152], 63, PUSHUP_HANDS, [[112, 168], [40, G]], true),
    ],
    periodMs: 700,
    loop: 'pingpong',
  },

  // ---------- Cardio ----------
  jacks: {
    key: 'jacks',
    frames: [STAND, pose([102, 109], 0, [[6, -52], [2, -52]], [[114, G - 8], [92, G - 8]])],
    periodMs: 900,
    loop: 'pingpong',
  },
  stepJack: {
    key: 'stepJack',
    frames: [STAND, pose([102, 118], 0, [[6, -52], [2, -52]], [[116, G], [96, G]])],
    periodMs: 1400,
    loop: 'pingpong',
  },
  march: {
    key: 'march',
    frames: [
      pose([102, 117], 2, [[-14, 50], [16, 48]], [[120, 152], [99, G]]),
      pose([102, 117], 2, [[16, 48], [-14, 50]], [[104, G], [118, 152]]),
    ],
    periodMs: 1200,
    loop: 'pingpong',
  },
  highKnees: {
    key: 'highKnees',
    frames: [
      pose([102, 111], 4, [[-14, 48], [18, 30]], [[124, 140], [100, G - 4]]),
      pose([102, 111], 4, [[18, 30], [-14, 48]], [[104, G - 4], [122, 140]]),
    ],
    periodMs: 600,
    loop: 'pingpong',
  },
  skip: {
    key: 'skip',
    frames: [pose([102, 117], 0, [[14, 40], [10, 42]], FEET), pose([102, 108], 0, [[14, 40], [10, 42]], [[106, G - 9], [99, G - 9]])],
    periodMs: 700,
    loop: 'pingpong',
    props: ['rope'],
  },
  burpee: {
    key: 'burpee',
    frames: [STAND_ARMS_UP, CROUCH, PUSHUP_TOP, CROUCH],
    periodMs: 3000,
    loop: 'cycle',
  },
};

// Matches an exercise name (from the free planner or the AI) to a motion.
// Order matters: more specific phrases come first.
const RULES: [RegExp, string][] = [
  [/burpee/, 'burpee'],
  [/mountain/, 'mountainClimber'],
  [/step jack/, 'stepJack'],
  [/jumping jack|star jump|\bjacks\b/, 'jacks'],
  [/high knee|butt kick|run(ning)? (on|in) (the )?(spot|place)|sprint/, 'highKnees'],
  [/skip|rope/, 'skip'],
  [/step-? ?up|stair/, 'stepUp'],
  [/calf/, 'calfRaise'],
  [/jump squat|squat jump/, 'jumpSquat'],
  [/chair squat|sit to stand|box squat/, 'chairSquat'],
  [/bulgarian|split squat/, 'splitSquat'],
  [/lunge/, 'lunge'],
  [/march|walk|jog|shadow ?box/, 'march'], // after lunge, so "walking lunges" is a lunge
  [/goblet|front squat|back squat|barbell squat|dumbbell squat|kettlebell squat|leg press|thruster/, 'gobletSquat'],
  [/squat|wall sit/, 'squat'],
  [/hip thrust/, 'hipThrust'],
  [/single[- ]leg (glute )?bridge/, 'singleLegBridge'],
  [/bridge/, 'bridge'],
  [/swing/, 'swing'],
  [/deadlift|rdl|romanian/, 'deadlift'],
  [/good morning|hinge|hip hinge/, 'hinge'],
  [/dead bug/, 'deadBug'],
  [/bird[- ]dog/, 'birdDog'],
  [/hollow/, 'hollow'],
  [/crunch|sit-? ?up|leg raise|toe touch|russian twist/, 'crunch'],
  [/superman|y-?t raise|\by raise|prone|back extension|reverse fly/, 'superman'], // before "hold"
  [/plank|hold/, 'plank'],
  [/pull-? ?up|chin-? ?up|negative/, 'pullUp'],
  [/pulldown|pull-down/, 'pulldown'],
  [/bent[- ]over|one-arm|single-arm|dumbbell row|renegade|inverted row|table row|t-bar/, 'bentRow'],
  [/row|pull-apart|face pull/, 'standingRow'],
  [/dip/, 'dip'],
  [/incline push|wall push|counter push/, 'inclinePushUp'],
  [/push-? ?up|press-? ?up/, 'pushUp'],
  [/bench press/, 'benchPress'],
  [/floor press/, 'floorPress'],
  [/shoulder press|overhead press|military press|arnold press|pike/, 'shoulderPress'],
  [/chest press|banded press|machine press|chest fly/, 'chestPress'],
  [/curl/, 'curl'],
  [/raise/, 'frontRaise'],
];

export function motionFor(exerciseName: string): Motion {
  const name = exerciseName.toLowerCase();
  const match = RULES.find(([pattern]) => pattern.test(name));
  return MOTIONS[match ? match[1] : 'stand'];
}

// Show a weight in the hands when the exercise uses one.
export function usesWeight(exerciseName: string): boolean {
  return /dumbbell|kettlebell|barbell|weight|goblet|press|curl|deadlift|swing/i.test(exerciseName) && !/push-? ?up|band|machine|bodyweight/i.test(exerciseName);
}
