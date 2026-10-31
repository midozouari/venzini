import { describe, expect, it } from 'vitest';
import { buildState } from './fixtures';
import { distance, floydWarshall, roadMinutes, roadSpeedKmh, shortestPath } from './roads';

describe('ALG-09 distance matrix (Floyd–Warshall)', () => {
  it('replaces a direct road by a shorter path through another point (SDD example)', () => {
    const m = floydWarshall(
      ['i', 'j', 'k'],
      [
        { a: 'i', b: 'j', km: 14.0, minutes: roadMinutes(14.0) },
        { a: 'i', b: 'k', km: 5.2, minutes: roadMinutes(5.2) },
        { a: 'j', b: 'k', km: 6.1, minutes: roadMinutes(6.1) },
      ],
    );
    expect(distance(m, 'i', 'j').km).toBe(11.3);
    expect(shortestPath(m, 'i', 'j')).toEqual(['i', 'k', 'j']);
  });

  it('drives 50 km/h on roads up to 12 km and 70 km/h above (Equation 39)', () => {
    expect([roadSpeedKmh(12), roadSpeedKmh(12.01)]).toEqual([50, 70]);
    expect(roadMinutes(10)).toBe(12);
    expect(roadMinutes(14)).toBe(12);
  });

  it('gives a complete, symmetric matrix of 23 × 22 = 506 pairs on the sample network', () => {
    const { matrix } = buildState();
    let pairs = 0;
    for (const a of matrix.ids)
      for (const b of matrix.ids) {
        if (a === b) continue;
        pairs++;
        const ab = distance(matrix, a, b);
        expect(ab.km).toBeGreaterThan(0);
        expect(ab.minutes).toBeGreaterThan(0);
        expect(distance(matrix, b, a).km).toBe(ab.km);
      }
    expect(pairs).toBe(506);
  });
});
