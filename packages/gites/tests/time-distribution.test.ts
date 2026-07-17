import { test } from "vitest";
import assert from "node:assert/strict";
import {
  isValidHHMM,
  parseHHMM,
  canvasLength,
  posToStamp,
  stampToPos,
  distribute,
  validateSchedule,
  type DayWindow,
} from "../src/time-distribution.js";

const day = (date: string, startMin: number, endMin: number): DayWindow => ({
  date,
  startMin,
  endMin,
});

test("isValidHHMM accepts canonical format", () => {
  assert.ok(isValidHHMM("11:30"));
  assert.ok(isValidHHMM("9:05"));
  assert.ok(!isValidHHMM("11:3"));
  assert.ok(!isValidHHMM("abc"));
});

test("canvasLength sums working minutes across days", () => {
  const days = [day("2026-07-01", 600, 660), day("2026-07-02", 480, 540)];
  assert.equal(canvasLength(days), 120);
});

test("posToStamp walks days and skips the overnight gap", () => {
  const days = [day("2026-07-01", 600, 660), day("2026-07-02", 480, 540)];
  assert.deepEqual(posToStamp(0, days), { date: "2026-07-01", time: "10:00" });
  assert.deepEqual(posToStamp(60, days), { date: "2026-07-01", time: "11:00" });
  assert.deepEqual(posToStamp(61, days), { date: "2026-07-02", time: "08:01" });
  assert.deepEqual(posToStamp(120, days), { date: "2026-07-02", time: "09:00" });
});

test("posToStamp clamps out-of-range positions to the canvas", () => {
  const days = [day("2026-07-01", 600, 660)];
  assert.deepEqual(posToStamp(-5, days), { date: "2026-07-01", time: "10:00" });
  assert.deepEqual(posToStamp(999, days), { date: "2026-07-01", time: "11:00" });
});

test("stampToPos is the inverse of posToStamp across days", () => {
  const days = [day("2026-07-01", 600, 660), day("2026-07-02", 480, 540)];
  assert.equal(stampToPos({ date: "2026-07-01", time: "10:30" }, days), 30);
  assert.equal(stampToPos({ date: "2026-07-02", time: "08:30" }, days), 90);
});

test("distribute anchors first at canvas start and last at now, strictly increasing", () => {
  const days = [day("2026-07-16", 991, 1080), day("2026-07-17", 480, 648)];
  const s = distribute([50, 50, 50, 50, 50, 50], days, () => 0.5);
  assert.equal(s.length, 6);
  assert.ok(validateSchedule(s));
  assert.deepEqual(s[0], { date: "2026-07-16", time: "16:31" }); // first commit's real time
  assert.deepEqual(s[5], { date: "2026-07-17", time: "10:48" }); // now
});

test("distribute never places a stamp outside the canvas", () => {
  const days = [day("2026-07-16", 991, 1080), day("2026-07-17", 480, 648)];
  for (let i = 0; i < 20; i++) {
    const s = distribute([10, 200, 5, 80, 1, 300], days);
    assert.ok(validateSchedule(s));
    for (const st of s) {
      const inDay1 =
        st.date === "2026-07-16" && parseHHMM(st.time)! >= 991 && parseHHMM(st.time)! <= 1080;
      const inDay2 =
        st.date === "2026-07-17" && parseHHMM(st.time)! >= 480 && parseHHMM(st.time)! <= 648;
      assert.ok(inDay1 || inDay2, `${st.date} ${st.time} outside canvas`);
    }
  }
});

test("distribute weights the gap before a commit by its size", () => {
  // Single day 0..1000 min. Middle commit is huge -> a large gap precedes it.
  const days = [day("2026-07-01", 0, 1000)];
  const s = distribute([1, 1000, 1], days, () => 0.5);
  const gapBeforeBig = parseHHMM(s[1]!.time)! - parseHHMM(s[0]!.time)!;
  const gapAfterBig = parseHHMM(s[2]!.time)! - parseHHMM(s[1]!.time)!;
  assert.ok(gapBeforeBig > gapAfterBig, "big commit gets the larger preceding gap");
});

test("distribute squeezes when the canvas is tight, staying inside it", () => {
  const days = [day("2026-07-01", 600, 604)]; // 4-minute window
  const s = distribute([1, 1, 1, 1, 1], days, () => 0.5);
  assert.equal(s.length, 5);
  assert.ok(validateSchedule(s));
  assert.equal(s[0]!.time, "10:00");
  assert.equal(s[4]!.time, "10:04");
});

test("distribute handles single commit and empty inputs", () => {
  const days = [day("2026-07-01", 600, 660)];
  assert.deepEqual(distribute([42], days), [{ date: "2026-07-01", time: "11:00" }]);
  assert.deepEqual(distribute([], days), []);
  assert.deepEqual(distribute([1, 2], []), []);
});

test("validateSchedule enforces order and format", () => {
  assert.ok(
    validateSchedule([
      { date: "2026-07-01", time: "16:20" },
      { date: "2026-07-02", time: "10:00" },
    ]),
  );
  assert.ok(
    !validateSchedule([
      { date: "2026-07-01", time: "10:00" },
      { date: "2026-07-01", time: "10:00" },
    ]),
  );
  assert.ok(
    !validateSchedule([
      { date: "2026-07-02", time: "10:00" },
      { date: "2026-07-01", time: "10:00" },
    ]),
  );
  assert.ok(!validateSchedule([{ date: "2026-7-1", time: "10:00" }]));
  assert.ok(!validateSchedule([{ date: "2026-07-01", time: "10:5" }]));
});
