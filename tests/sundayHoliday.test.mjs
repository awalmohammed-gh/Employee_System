import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSundayHoliday } from '../backend/utils/attendanceHoliday.js';
import { clockIn } from '../backend/controllers/employeeAttendance.js';

test('Sunday uses Ghana time, including week boundaries', () => {
  assert.equal(isSundayHoliday('2026-09-26T23:59:59Z'), false);
  assert.equal(isSundayHoliday('2026-09-27T00:00:00Z'), true);
  assert.equal(isSundayHoliday('2026-09-27T23:59:59Z'), true);
  assert.equal(isSundayHoliday('2026-09-28T00:00:00Z'), false);
  assert.equal(isSundayHoliday('invalid'), false);
});
test('Sunday clock-in is rejected before database access, even with a weekday timestamp', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-27T12:00:00Z') });
  const res = { status(code) { assert.equal(code, 403); return this; }, json(body) { assert.equal(body.code, 'SUNDAY_HOLIDAY'); assert.equal(body.success, false); return body; } };
  await clockIn({ body: { timestamp: '2026-09-28T08:00:00Z' } }, res);
});
test('Sunday timestamps cannot be submitted on a weekday', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-28T12:00:00Z') });
  const res = { status(code) { assert.equal(code, 403); return this; }, json(body) { assert.equal(body.code, 'SUNDAY_HOLIDAY'); return body; } };
  await clockIn({ body: { clockInTime: '2026-09-27T08:00:00Z' } }, res);
});
