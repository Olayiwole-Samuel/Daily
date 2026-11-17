// The maths behind the animated exercise character.
//
// The character is a side-view figure facing right. A pose only says where the
// hips are, how far the torso leans, and where the hands and feet should be.
// The elbows and knees are worked out with "two-bone inverse kinematics": given
// a shoulder, a hand target and two arm lengths, there is (at most) one elbow
// position on each side, and we pick the natural side.
//
// Angles are in degrees, measured from straight DOWN, turning toward the front
// (+x): 0 = down, 90 = forward, 180 = up, -90 = backward. y grows downward (SVG).

export type Point = [number, number];

export const LIMB = {
  torso: 50,
  neck: 19, // shoulder to head centre
  head: 10, // head radius
  upperArm: 28,
  forearm: 26,
  thigh: 34,
  shin: 34,
} as const;

export const GROUND_Y = 185;

export interface Pose {
  hip: Point;
  torso: number; // lean of the torso: 0 = upright, 90 = flat facing forward, -90 = lying on the back
  handNear: Point; // absolute positions in the 200 x 200 picture
  handFar: Point;
  footNear: Point;
  footFar: Point;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

// A point `length` away from `from`, in direction `angle` (0 = down).
export function along(from: Point, angle: number, length: number): Point {
  return [from[0] + length * Math.sin(rad(angle)), from[1] + length * Math.cos(rad(angle))];
}

// The torso points UP from the hips and leans forward with the torso angle:
// direction (sin t, -cos t), which in the 0 = down convention is angle 180 - t.
export function shoulderOf(hip: Point, torso: number): Point {
  return along(hip, 180 - torso, LIMB.torso);
}

export function headOf(hip: Point, torso: number): Point {
  return along(hip, 180 - torso, LIMB.torso + LIMB.neck);
}

// Two-bone IK. Returns the middle joint (elbow/knee) and the end point
// (the target, or as close as the limb can reach). bend = +1 or -1 picks the side.
export function solveLimb(start: Point, target: Point, upper: number, lower: number, bend: 1 | -1): { joint: Point; end: Point } {
  const dx = target[0] - start[0];
  const dy = target[1] - start[1];
  const reach = upper + lower;
  const distance = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(upper - lower) + 0.01), reach - 0.01);
  const base = (Math.atan2(dx, dy) * 180) / Math.PI; // same "0 = down" convention
  // Law of cosines: the angle at the start joint between the target line and the upper bone.
  const cos = (upper * upper + distance * distance - lower * lower) / (2 * upper * distance);
  const offset = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  const joint = along(start, base + bend * offset, upper);
  const end = along(start, base, distance);
  return { joint, end };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPoint = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpPoint(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    handNear: lerpPoint(a.handNear, b.handNear, t),
    handFar: lerpPoint(a.handFar, b.handFar, t),
    footNear: lerpPoint(a.footNear, b.footNear, t),
    footFar: lerpPoint(a.footFar, b.footFar, t),
  };
}

// Smooth start and stop, like a real movement.
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export interface Skeleton {
  hip: Point;
  shoulder: Point;
  head: Point;
  torso: number;
  elbowNear: Point;
  handNear: Point;
  elbowFar: Point;
  handFar: Point;
  kneeNear: Point;
  footNear: Point;
  kneeFar: Point;
  footFar: Point;
}

// Turns a pose into every joint position, ready to draw.
export function buildSkeleton(pose: Pose, elbowBend: 1 | -1 = -1, kneeBend: 1 | -1 = 1): Skeleton {
  const shoulder = shoulderOf(pose.hip, pose.torso);
  const armN = solveLimb(shoulder, pose.handNear, LIMB.upperArm, LIMB.forearm, elbowBend);
  const armF = solveLimb(shoulder, pose.handFar, LIMB.upperArm, LIMB.forearm, elbowBend);
  const legN = solveLimb(pose.hip, pose.footNear, LIMB.thigh, LIMB.shin, kneeBend);
  const legF = solveLimb(pose.hip, pose.footFar, LIMB.thigh, LIMB.shin, kneeBend);
  return {
    hip: pose.hip,
    shoulder,
    head: headOf(pose.hip, pose.torso),
    torso: pose.torso,
    elbowNear: armN.joint,
    handNear: armN.end,
    elbowFar: armF.joint,
    handFar: armF.end,
    kneeNear: legN.joint,
    footNear: legN.end,
    kneeFar: legF.joint,
    footFar: legF.end,
  };
}
