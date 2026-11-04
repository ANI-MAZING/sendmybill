import { describe, expect, it } from "vitest";
import { formatEstimate, isSameLocalDay, taskStatusLabel } from "./schedule";

describe("schedule", () => {
  it("labels planned work as upcoming", () => {
    expect(taskStatusLabel("todo")).toBe("Upcoming");
    expect(taskStatusLabel("in_progress")).toBe("In progress");
    expect(taskStatusLabel("done")).toBe("Done");
  });

  it("formats an estimate in hours when it reaches one hour", () => {
    expect(formatEstimate(45)).toBe("45m");
    expect(formatEstimate(60)).toBe("1h");
    expect(formatEstimate(90)).toBe("1.5h");
  });

  it("compares a timestamp to a local calendar day", () => {
    const day = new Date(2026, 10, 5, 15, 0, 0);
    expect(isSameLocalDay(new Date(2026, 10, 5, 9, 30).toISOString(), day)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 6, 9, 30).toISOString(), day)).toBe(false);
  });
});
