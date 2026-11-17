import { describe, expect, it } from 'vitest';
import { buildSkeleton, LIMB, solveLimb, type Point } from './skeleton';
import { MOTIONS, motionFor, usesWeight } from './motions';
import { LIBRARY } from '../rules/workouts';

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('exercise character', () => {
  it('two-bone IK keeps limb lengths and reaches reachable targets', () => {
    const { joint, end } = solveLimb([100, 100], [130, 140], 28, 26, -1);
    expect(dist([100, 100], joint)).toBeCloseTo(28, 3);
    expect(dist(joint, end)).toBeCloseTo(26, 3);
    expect(dist(end, [130, 140])).toBeLessThan(0.1);
  });

  it('stretches straight toward targets that are too far away', () => {
    const { end } = solveLimb([0, 0], [0, 200], 34, 34, 1);
    expect(dist([0, 0], end)).toBeCloseTo(68, 0);
  });

  it('every pose in every motion keeps the body in proportion and on screen', () => {
    for (const motion of Object.values(MOTIONS)) {
      for (const pose of motion.frames) {
        const s = buildSkeleton(pose, motion.elbowBend ?? -1, motion.kneeBend ?? 1);
        expect(dist(s.hip, s.shoulder)).toBeCloseTo(LIMB.torso, 3);
        expect(dist(s.shoulder, s.elbowNear)).toBeCloseTo(LIMB.upperArm, 3);
        expect(dist(s.hip, s.kneeFar)).toBeCloseTo(LIMB.thigh, 3);
        for (const p of [s.head, s.handNear, s.handFar, s.footNear, s.footFar, s.kneeNear, s.elbowNear]) {
          expect(p[0]).toBeGreaterThan(-5);
          expect(p[0]).toBeLessThan(205);
          expect(p[1]).toBeGreaterThan(-5);
          expect(p[1]).toBeLessThan(200); // nothing sinks far below the floor
        }
      }
    }
  });

  it('gives every exercise in the free planner its own movement', () => {
    const unmatched = LIBRARY.filter((e) => motionFor(e.name).key === 'stand').map((e) => e.name);
    expect(unmatched).toEqual([]);
  });

  it('matches common names the AI might use', () => {
    expect(motionFor('Superman hold').key).toBe('superman');
    expect(motionFor('Side plank').key).toBe('plank');
    expect(motionFor('Barbell back squat').key).toBe('gobletSquat');
    expect(motionFor('Bodyweight squat').key).toBe('squat');
    expect(motionFor('Walking lunges').key).toBe('lunge');
    expect(motionFor('Dumbbell bicep curl').key).toBe('curl');
    expect(motionFor('Something unusual').key).toBe('stand');
  });

  it('draws a weight only when the exercise uses one', () => {
    expect(usesWeight('Goblet squat')).toBe(true);
    expect(usesWeight('Dumbbell Romanian deadlift')).toBe(true);
    expect(usesWeight('Push-up')).toBe(false);
    expect(usesWeight('Banded chest press')).toBe(false);
  });
});
