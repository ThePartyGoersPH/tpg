import { describe, it, expect } from 'vitest';
import { sortNotifications } from './notificationSort';

const at = (iso) => new Date(iso).toISOString();

describe('sortNotifications', () => {
  it('orders newest first by created_at', () => {
    const input = [
      { id: 1, created_at: at('2026-03-26T06:36:48Z') },
      { id: 2, created_at: at('2026-09-26T01:56:50Z') },
      { id: 3, created_at: at('2026-09-04T11:15:43Z') },
    ];
    expect(sortNotifications(input).map(n => n.id)).toEqual([2, 3, 1]);
  });

  it('breaks created_at ties with id descending (stable, newest insert first)', () => {
    const same = '2026-08-15T05:32:30.000Z';
    const input = [
      { id: 59, created_at: same, is_read: 1 },
      { id: 60, created_at: same, is_read: 0 },
    ];
    expect(sortNotifications(input).map(n => n.id)).toEqual([60, 59]);
    // reordering the input must not change the output
    expect(sortNotifications([...input].reverse()).map(n => n.id)).toEqual([60, 59]);
  });

  it('does not mutate the source array', () => {
    const input = [
      { id: 1, created_at: at('2026-01-01T00:00:00Z') },
      { id: 2, created_at: at('2026-09-01T00:00:00Z') },
    ];
    const copy = [...input];
    sortNotifications(input);
    expect(input).toEqual(copy);
  });

  it('handles bare MySQL datetimes, missing timestamps and non-arrays', () => {
    const input = [
      { id: 7, created_at: '2026-08-15 05:32:30' },
      { id: 8, created_at: '2026-09-04 11:15:43' },
      { id: 9 },
      null,
    ];
    const out = sortNotifications(input);
    expect(out.map(n => n && n.id)).toEqual([8, 7, 9, null]);
    expect(sortNotifications(undefined)).toEqual([]);
    expect(sortNotifications('nope')).toEqual([]);
  });
});
