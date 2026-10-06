import { describe, expect, it } from 'vitest';
import { formatDuration, formatGroupedCount } from '../../src/domain/format';

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss values', () => {
    expect(formatDuration(213)).toBe('3:33');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('rounds fractional seconds and never goes negative', () => {
    expect(formatDuration(213.061)).toBe('3:33');
    expect(formatDuration(-5)).toBe('0:00');
  });
});

describe('formatGroupedCount', () => {
  it('groups exact counts for display', () => {
    expect(formatGroupedCount(1823562145)).toBe('1,823,562,145');
    expect(formatGroupedCount(0)).toBe('0');
  });
});
