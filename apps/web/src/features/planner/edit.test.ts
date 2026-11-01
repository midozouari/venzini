import { fixtures } from '@/mocks/fixtures';
import { describe, expect, it } from 'vitest';
import {
  dropToEdit,
  findStation,
  highlightOf,
  moveTargets,
  overloads,
  previewEdit,
  routeTarget,
  sortedRisks,
} from './edit';

const view = fixtures.optimal.view;
const stopOf = (station: string) => findStation(view, station)!.stop.stop_id;
const order = (v: typeof view, routeId: string) =>
  v.routes.find((r) => r.route_id === routeId)!.stops.map((s) => `${s.stop_order}:${s.station_id}`);

describe('previewEdit', () => {
  it('reorders a stop and renumbers its route', () => {
    const next = previewEdit(view, {
      kind: 'reorder',
      expected_version: 1,
      stop_id: stopOf('ST003'),
      position: 3,
    });
    expect(order(next, 'R-03')).toEqual(['1:ST001', '2:ST005', '3:ST003']);
    expect(order(view, 'R-03')).toEqual(['1:ST003', '2:ST001', '3:ST005']); // input untouched
  });

  it('moves a stop to another route at the given position', () => {
    const next = previewEdit(view, {
      kind: 'move',
      expected_version: 1,
      stop_id: stopOf('ST012'),
      to_route_id: 'R-02',
      position: 4,
    });
    expect(order(next, 'R-01')).toEqual(['1:ST014']);
    expect(order(next, 'R-02')).toEqual(['1:ST008', '2:ST013', '3:ST011', '4:ST012']);
  });

  it('leaves the view as it is for quantity edits and reset', () => {
    expect(previewEdit(view, { kind: 'reset', expected_version: 1 })).toBe(view);
  });
});

describe('dropToEdit', () => {
  it('drops onto a stop of the same route as a reorder', () => {
    expect(dropToEdit(view, stopOf('ST012'), stopOf('ST014'))).toEqual({
      kind: 'edit',
      edit: { kind: 'reorder', expected_version: 1, stop_id: stopOf('ST012'), position: 2 },
    });
  });

  it('drops onto another route card of the same warehouse as a move to its end', () => {
    expect(dropToEdit(view, stopOf('ST012'), routeTarget('R-02'))).toEqual({
      kind: 'edit',
      edit: {
        kind: 'move',
        expected_version: 1,
        stop_id: stopOf('ST012'),
        to_route_id: 'R-02',
        position: 4,
      },
    });
  });

  it('refuses a route of another warehouse (WARN-EDIT-01)', () => {
    expect(dropToEdit(view, stopOf('ST012'), routeTarget('R-03'))).toEqual({
      kind: 'refused',
      warehouse: 'WH-RIV',
    });
  });

  it('does nothing when dropped where it was', () => {
    expect(dropToEdit(view, stopOf('ST012'), stopOf('ST012'))).toEqual({ kind: 'none' });
    expect(dropToEdit(view, stopOf('ST014'), routeTarget('R-01'))).toEqual({ kind: 'none' });
    expect(dropToEdit(view, stopOf('ST014'), null)).toEqual({ kind: 'none' });
  });
});

describe('moveTargets, risks and highlights', () => {
  it('offers only the tankers of the same warehouse', () => {
    expect(moveTargets(view, 'R-01').map((r) => r.tanker_id)).toEqual(['T-02']);
    expect(moveTargets(view, 'R-05').map((r) => r.route_id)).toEqual(['R-06']);
  });

  it('finds the overload of the scripted move and sorts it first', () => {
    const moved = fixtures.scriptedEdits.moves[0]!.outcome.view;
    expect(overloads(moved).map((r) => r.type)).toEqual(['RISK-01']);
    expect(overloads(moved, 'R-01')).toEqual([]);
    expect(sortedRisks(moved.risks)[0]!.type).toBe('RISK-01');
    const hl = highlightOf(overloads(moved)[0]!)!;
    expect([...hl.routes]).toEqual(['R-02']);
    expect(highlightOf(null)).toBeNull();
  });
});
