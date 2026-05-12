import { describe, expect, it } from 'vitest';
import {
  needsRebalance,
  positionBetween,
  positionForAppend,
  positionForPrepend,
  rebalance,
  sortByPosition,
} from './ordering';

describe('positionBetween', () => {
  it('returns 0 when both neighbors are null', () => {
    expect(positionBetween(null, null)).toBe(0);
    expect(positionBetween()).toBe(0);
  });

  it('returns after - 1 when only after is provided', () => {
    expect(positionBetween(null, 5)).toBe(4);
  });

  it('returns before + 1 when only before is provided', () => {
    expect(positionBetween(5, null)).toBe(6);
  });

  it('returns midpoint when both provided', () => {
    expect(positionBetween(0, 10)).toBe(5);
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  it('produces strictly ordered positions when inserting many times between the same neighbors', () => {
    const before = 0;
    let after = 1;
    const positions: number[] = [];
    for (let i = 0; i < 20; i++) {
      const p = positionBetween(before, after);
      positions.push(p);
      after = p;
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeLessThan(positions[i - 1]!);
    }
  });
});

describe('positionForAppend / positionForPrepend', () => {
  it('returns 0 for an empty list', () => {
    expect(positionForAppend([])).toBe(0);
    expect(positionForPrepend([])).toBe(0);
  });

  it('appends after the last position', () => {
    expect(positionForAppend([{ position: 3 }, { position: 7 }])).toBe(8);
  });

  it('prepends before the first position', () => {
    expect(positionForPrepend([{ position: 3 }, { position: 7 }])).toBe(2);
  });
});

describe('needsRebalance', () => {
  it('returns false when gaps are healthy', () => {
    expect(needsRebalance([{ position: 0 }, { position: 1 }, { position: 2 }])).toBe(false);
  });

  it('returns true when two adjacent positions collapse', () => {
    const a = 0;
    const b = 1e-10;
    expect(needsRebalance([{ position: a }, { position: b }])).toBe(true);
  });

  it('returns false for a single item or empty', () => {
    expect(needsRebalance([])).toBe(false);
    expect(needsRebalance([{ position: 5 }])).toBe(false);
  });
});

describe('rebalance', () => {
  it('reassigns sequential integer positions in sort order', () => {
    const items = [{ position: 5 }, { position: 1 }, { position: 3.14 }];
    expect(rebalance(items)).toEqual([{ position: 0 }, { position: 1 }, { position: 2 }]);
  });
});

describe('sortByPosition', () => {
  it('sorts ascending by position without mutating input', () => {
    const items = [{ position: 5 }, { position: 1 }, { position: 3 }];
    const sorted = sortByPosition(items);
    expect(sorted.map((i) => i.position)).toEqual([1, 3, 5]);
    expect(items.map((i) => i.position)).toEqual([5, 1, 3]);
  });
});
