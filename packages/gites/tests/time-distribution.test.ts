import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  genTimes,
  validateTimes,
  isValidHHMM,
  parseHHMM,
  buildDayWindows,
  genSchedule,
  validateSchedule,
  dayCapacity,
  type DayWindow,
} from '../src/time-distribution.js';

const WS = 10 * 60; // 10:00
const WE = 16 * 60 + 30; // 16:30

test('genTimes produces strictly increasing times with min gap', () => {
  const start = 11 * 60 + 30;
  const end = 16 * 60 + 30;
  for (let count = 1; count <= 10; count++) {
    const t = genTimes(count, start, end, 20);
    assert.equal(t.length, count);
    assert.ok(validateTimes(t));
    if (count > 1) {
      for (let i = 1; i < count; i++) {
        assert.ok(parseHHMM(t[i]!)! - parseHHMM(t[i - 1]!)! >= 20);
      }
    }
  }
});

test('genTimes overflows past window when count too high', () => {
  const start = 11 * 60 + 30;
  const end = 12 * 60;
  const t = genTimes(5, start, end, 20);
  assert.equal(t.length, 5);
  assert.ok(validateTimes(t));
  assert.ok(parseHHMM(t[4]!)! > end);
});

test('isValidHHMM accepts canonical format', () => {
  assert.ok(isValidHHMM('11:30'));
  assert.ok(isValidHHMM('9:05'));
  assert.ok(!isValidHHMM('11:3'));
  assert.ok(!isValidHHMM('abc'));
});

test('validateTimes rejects non-increasing sequences', () => {
  assert.ok(!validateTimes(['11:30', '11:30']));
  assert.ok(!validateTimes(['12:00', '11:00']));
  assert.ok(validateTimes(['11:30', '12:00', '12:30']));
});

const D1: DayWindow = { date: '2026-07-01', startMin: WS, endMin: WE };
const D2: DayWindow = { date: '2026-07-02', startMin: WS, endMin: WE };
const D3: DayWindow = { date: '2026-07-03', startMin: WS, endMin: WE };

test('genSchedule stays strictly increasing across days', () => {
  const s = genSchedule(9, [D1, D2, D3], 20);
  assert.equal(s.length, 9);
  assert.ok(validateSchedule(s));
});

test('genSchedule allocates roughly proportional to span', () => {
  const wide: DayWindow = { date: '2026-07-01', startMin: WS, endMin: WS + 300 };
  const narrow: DayWindow = { date: '2026-07-02', startMin: WS, endMin: WS + 60 };
  const s = genSchedule(12, [wide, narrow], 20);
  assert.equal(s.length, 12);
  const onWide = s.filter((x) => x.date === '2026-07-01').length;
  const onNarrow = s.filter((x) => x.date === '2026-07-02').length;
  assert.ok(onWide > onNarrow);
});

test('genSchedule caps non-final day, final day spills', () => {
  const tiny1: DayWindow = { date: '2026-07-01', startMin: WS, endMin: WS + 40 };
  const tiny2: DayWindow = { date: '2026-07-02', startMin: WS, endMin: WS + 40 };
  const s = genSchedule(10, [tiny1, tiny2], 20);
  assert.equal(s.length, 10);
  assert.ok(validateSchedule(s));
  const day1 = s.filter((x) => x.date === '2026-07-01');
  const cap1 = dayCapacity(tiny1, 20);
  assert.ok(day1.length <= cap1, 'non-final day within capacity');
  for (const t of day1) assert.ok(parseHHMM(t.time)! <= tiny1.endMin);
  const day2 = s.filter((x) => x.date === '2026-07-02');
  assert.ok(parseHHMM(day2[day2.length - 1]!.time)! > tiny2.endMin, 'final day spills');
});

test('genSchedule single day matches genTimes count and spill', () => {
  const tiny: DayWindow = { date: '2026-07-01', startMin: WS, endMin: WS + 40 };
  const s = genSchedule(5, [tiny], 20);
  assert.equal(s.length, 5);
  assert.ok(parseHHMM(s[4]!.time)! > tiny.endMin);
});

test('genSchedule zero-length window yields deterministic gap spill', () => {
  const zero: DayWindow = { date: '2026-07-01', startMin: WS, endMin: WS };
  const s = genSchedule(3, [zero], 20);
  assert.deepEqual(
    s.map((x) => x.time),
    ['10:00', '10:20', '10:40'],
  );
});

test('genSchedule returns empty for no days or zero count', () => {
  assert.deepEqual(genSchedule(3, [], 20), []);
  assert.deepEqual(genSchedule(0, [D1], 20), []);
});

test('buildDayWindows clamps start and end days', () => {
  const start = new Date(2026, 6, 1, 11, 30); // 11:30
  const end = new Date(2026, 6, 3, 14, 12); // 14:12
  const w = buildDayWindows(start, end, new Set(), WS, WE);
  assert.equal(w.length, 3);
  assert.equal(w[0]!.startMin, 11 * 60 + 30); // max(10:00, 11:30)
  assert.equal(w[0]!.endMin, WE);
  assert.equal(w[2]!.startMin, WS);
  assert.equal(w[2]!.endMin, 14 * 60 + 12); // min(14:12, 16:30)
});

test('buildDayWindows drops start day when last commit is after work end', () => {
  const start = new Date(2026, 6, 1, 17, 0); // 17:00, past 16:30
  const end = new Date(2026, 6, 2, 12, 0);
  const w = buildDayWindows(start, end, new Set(), WS, WE);
  assert.equal(w.length, 1);
  assert.equal(w[0]!.date, '2026-07-02');
});

test('buildDayWindows excludes off dates', () => {
  const start = new Date(2026, 6, 1, 10, 0);
  const end = new Date(2026, 6, 3, 16, 0);
  const w = buildDayWindows(start, end, new Set(['2026-07-02']), WS, WE);
  assert.deepEqual(
    w.map((x) => x.date),
    ['2026-07-01', '2026-07-03'],
  );
});

test('buildDayWindows collapses single day before work start', () => {
  const start = new Date(2026, 6, 1, 8, 0); // 08:00
  const end = new Date(2026, 6, 1, 9, 0); // 09:00, before 10:00
  const w = buildDayWindows(start, end, new Set(), WS, WE);
  assert.equal(w.length, 0);
});

test('validateSchedule enforces order and format', () => {
  assert.ok(
    validateSchedule([
      { date: '2026-07-01', time: '16:20' },
      { date: '2026-07-02', time: '10:00' },
    ]),
  );
  assert.ok(
    !validateSchedule([
      { date: '2026-07-01', time: '10:00' },
      { date: '2026-07-01', time: '10:00' },
    ]),
  );
  assert.ok(
    !validateSchedule([
      { date: '2026-07-02', time: '10:00' },
      { date: '2026-07-01', time: '10:00' },
    ]),
  );
  assert.ok(!validateSchedule([{ date: '2026-7-1', time: '10:00' }]));
  assert.ok(!validateSchedule([{ date: '2026-07-01', time: '10:5' }]));
});
