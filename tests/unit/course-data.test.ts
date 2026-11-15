import { describe, expect, it } from "vitest";
import { applyRule, courseGrade, planDiff, planSchema, ratingFor, type Activity, type Plan } from "../../src/lib/course-data";

const work: Activity = { id: "269928fa-463c-4b3d-9773-1653c8c718f2", title: "Контрольная", kind: "CONTROL",
  startsAt: "2026-11-22T00:00:00.000Z", place: "А-310", format: "Очно", description: "Подготовьте задачу.", topics: "Транзакции",
  requirements: "Объясните решение.", max: 20, weight: 2, optional: false, registration: false, materials: "" };
const extra: Activity = { ...work, id: "1ab374da-81a9-4b20-b739-9165a4e2d50e", optional: true, title: "Разбор задач" };
const rule = { cap: 42, bonus: 5, pass: 20, good: 30, excellent: 40, rounding: "NEAREST" } as const;
const plan: Plan = { title: "Базы данных", period: "Осень", rule, activities: [work, extra] };

describe("course rating and versions", () => {
  it("applies individual weights, bonus limits and the total cap", () => {
    const result = ratingFor(plan, [{ activityId: work.id, points: 19, status: "GRADED" }]);
    expect(result).toMatchObject({ earned: 38, score: 38, potential: 5, maximum: 42 });
    expect(ratingFor(plan, [{ activityId: extra.id, points: 10, status: "GRADED" }])).toMatchObject({ earned: 5, bonusEarned: 20 });
    expect(courseGrade(rule, result.maximum!)).toBe(5);
  });

  it("keeps missed work out of potential points and does not invent rules", () => {
    const result = ratingFor({ ...plan, rule: null }, [{ activityId: work.id, points: null, status: "MISSED" }]);
    expect(result).toMatchObject({ earned: 0, score: null, potential: 40, maximum: null });
    expect(result.remaining.map(activity => activity.id)).toEqual([extra.id]);
  });

  it("validates thresholds and rounds according to the chosen rule", () => {
    expect(planSchema.safeParse({ ...plan, rule: { ...rule, excellent: 100 } }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, activities: [work, work] }).success).toBe(false);
    expect(applyRule({ ...rule, rounding: "FLOOR" }, 20.98)).toBe(20);
    expect(applyRule({ ...rule, rounding: "NONE" }, 20.987)).toBe(20.99);
    expect(applyRule(rule, 20.98)).toBe(21);
  });

  it("records a move and a removal while leaving the previous plan intact", () => {
    const changes = planDiff(plan, { ...plan, activities: [{ ...work, startsAt: "2026-11-23T04:00:00.000Z" }] });
    expect(changes).toEqual([expect.stringMatching(/Дата и время.*10:00.*14:00/), "Удалено: Разбор задач"]);
    expect(plan.activities[0].startsAt).toBe("2026-11-22T00:00:00.000Z");
    expect(planDiff(plan, structuredClone(plan))).toEqual([]);
  });
});
