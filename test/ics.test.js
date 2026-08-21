import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcs } from '../src/core/ics.js';

test('ICS parser handles timed, all-day, and folded events', () => {
  const result = parseIcs([
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:one',
    'DTSTART:20260821T100000Z',
    'DTEND:20260821T110000Z',
    'SUMMARY:Design review',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:two',
    'DTSTART;VALUE=DATE:20260822',
    'SUMMARY:Long event',
    ' name',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n'));
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Design review');
  assert.equal(result[0].start, '2026-08-21T10:00:00.000Z');
  assert.equal(result[1].allDay, true);
  assert.equal(result[1].title, 'Long eventname');
});
