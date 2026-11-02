import { describe, it, expect } from 'vitest';
import { batchErrorIds, countFailed } from '../batchResult';
import type { ApiResponse } from '../../types';

describe('countFailed', () => {
  it('counts only unsuccessful responses', () => {
    const results = [
      { success: true, data: 1 },
      { success: false, error: 'boom' },
      { success: false, error: 'bad' },
    ] as ApiResponse<unknown>[];
    expect(countFailed(results)).toBe(2);
  });

  it('returns 0 for empty input', () => {
    expect(countFailed([])).toBe(0);
  });
});

describe('batchErrorIds', () => {
  it('returns ids of entries carrying an error', () => {
    const data = {
      update: [{ id: 1 }, { id: 2, error: { code: 'x' } }, { id: 3, error: { code: 'y' } }],
    };
    expect(batchErrorIds(data, 'update')).toEqual([2, 3]);
  });

  it('only inspects the requested operation', () => {
    const data = { create: [{ id: 1, error: {} }], delete: [{ id: 9 }] };
    expect(batchErrorIds(data, 'delete')).toEqual([]);
    expect(batchErrorIds(data, 'create')).toEqual([1]);
  });

  it('handles undefined data, missing op and null entries', () => {
    expect(batchErrorIds(undefined, 'update')).toEqual([]);
    expect(batchErrorIds({}, 'update')).toEqual([]);
    expect(batchErrorIds({ update: [null, { id: 4, error: 'e' }] }, 'update')).toEqual([4]);
  });
});
