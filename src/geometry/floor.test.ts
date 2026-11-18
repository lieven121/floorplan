import { describe, expect, it } from 'vite-plus/test';
import { newOpening, newRoom, newWall, type Room } from '../model/schema';
import { alignDelta, grabOffset, nearestWall, openingGeometry, placeOpeningAt, roomGeometry, snapRoom, snapRotation } from './floor';
import { dist } from './vec';

function rect(name: string, w: number, h: number, t: number, x = 0, y = 0): Room {
  const r = newRoom(name, t, { x, y });
  r.walls = [w, h, w, h].map((l) => newWall(l, t));
  return r;
}

describe('roomGeometry', () => {
  it('offsets the walls outward by their thickness', () => {
    const g = roomGeometry(rect('A', 4000, 3000, 100));
    expect(g.outer[0].x).toBeCloseTo(-100, 6);
    expect(g.outer[0].y).toBeCloseTo(-100, 6);
    expect(g.outer[2].x).toBeCloseTo(4100, 6);
    expect(g.outer[2].y).toBeCloseTo(3100, 6);
  });
});

describe('snapRoom', () => {
  it('puts a neighbouring room one wall thickness away and lines up the corners', () => {
    const a = rect('A', 4000, 3000, 100);
    // Dropped roughly to the right of A, a bit off.
    const b = rect('B', 3000, 3000, 100, 4250, 60);
    const s = snapRoom([a, b], b.id, b.origin, 0);
    expect(s.guide).not.toBeNull();
    expect(s.origin.x).toBeCloseTo(4100, 6);
    expect(s.origin.y).toBeCloseTo(0, 6);
    expect(s.rotation_deg).toBeCloseTo(0, 6);
  });

  it('straightens a room that is a few degrees off', () => {
    const a = rect('A', 4000, 3000, 100);
    const b = rect('B', 3000, 3000, 100, 4150, 0);
    const s = snapRoom([a, b], b.id, b.origin, 3);
    expect(Math.min(s.rotation_deg, 360 - s.rotation_deg)).toBeLessThan(1e-6);
  });

  it('does not snap a room that is far away', () => {
    const a = rect('A', 4000, 3000, 100);
    const b = rect('B', 3000, 3000, 100, 6000, 0);
    expect(snapRoom([a, b], b.id, b.origin, 0).guide).toBeNull();
  });
});

describe('openingGeometry', () => {
  it('places a door by its distance from the start corner', () => {
    const a = rect('A', 4000, 3000, 100);
    const door = { ...newOpening(a.id, 'door', 0), offset_mm: 500, width_mm: 900 };
    const g = roomGeometry(a);
    const o = openingGeometry(g, door, [g])!;
    expect(o.a).toEqual({ x: 500, y: 0 });
    expect(o.b).toEqual({ x: 1400, y: 0 });
    expect(o.depth).toBe(100);
    expect(o.fits).toBe(true);
  });

  it('cuts a door in a shared wall through to the next room', () => {
    const a = rect('A', 4000, 3000, 100);
    const b = rect('B', 3000, 3000, 100, 4220, 0); // 220 mm wall between them
    const door = { ...newOpening(a.id, 'door', 1), offset_mm: 1000 };
    const all = [roomGeometry(a), roomGeometry(b)];
    const o = openingGeometry(all[0], door, all)!;
    expect(o.depth).toBeCloseTo(220, 6);
    expect(dist(o.ao, { x: 4220, y: 1000 })).toBeLessThan(1e-6);
  });

  it('flags an opening that runs past the end of its wall', () => {
    const a = rect('A', 4000, 3000, 100);
    const g = roomGeometry(a);
    const o = openingGeometry(g, { ...newOpening(a.id, 'window', 1), offset_mm: 2500, width_mm: 1000 }, [g])!;
    expect(o.fits).toBe(false);
  });
});

describe('turning rooms', () => {
  it('snaps a hand-turned room to line up with a neighbour', () => {
    const a = rect('A', 4000, 3000, 100);
    a.rotation_deg = 30;
    const b = rect('B', 3000, 3000, 100, 6000, 0);
    expect(snapRotation([a, b], b.id, 31.7).rotation_deg).toBeCloseTo(30, 6);
    expect(snapRotation([a, b], b.id, 121.2).rotation_deg).toBeCloseTo(120, 6);
    // Far from any match: whole degrees.
    const free = snapRotation([a, b], b.id, 44.4);
    expect(free).toEqual({ rotation_deg: 44, aligned: false });
  });

  it('works out the smallest turn to align with a chosen wall', () => {
    const a = rect('A', 4000, 3000, 100);
    a.rotation_deg = 12;
    const b = rect('B', 3000, 3000, 100, 6000, 0);
    b.rotation_deg = 50;
    // b must turn by -38° (to 12°) — or +52°, but -38 is smaller.
    expect(alignDelta([a, b], b.id, a.id, 0)).toBeCloseTo(-38, 6);
  });

  it('finds the wall nearest to a tap', () => {
    const a = rect('A', 4000, 3000, 100);
    expect(nearestWall([a], { x: 2000, y: -40 }, 200)).toMatchObject({ roomId: a.id, wallIndex: 0 });
    expect(nearestWall([a], { x: 2000, y: 1500 }, 200)).toBeNull();
  });
});

describe('dragging openings', () => {
  it('slides along a wall, stays inside it and can move to another wall', () => {
    const a = rect('A', 4000, 3000, 100);
    const g = roomGeometry(a);
    // Along W1 (top wall), grabbed in the middle of a 900 mm door.
    expect(placeOpeningAt(g, 900, { x: 2003, y: 30 }, 450)).toEqual({ wallIndex: 0, offset_mm: 1550 });
    // Past the end: clamped so the door still fits.
    expect(placeOpeningAt(g, 900, { x: 3800, y: 10 }, 450)).toEqual({ wallIndex: 0, offset_mm: 3100 });
    // Near the right wall (W2), which runs downwards from C2.
    expect(placeOpeningAt(g, 900, { x: 3980, y: 1500 }, 450)).toEqual({ wallIndex: 1, offset_mm: 1050 });
  });

  it('keeps the point you grabbed under the pointer', () => {
    const a = rect('A', 4000, 3000, 100);
    const g = roomGeometry(a);
    const door = { ...newOpening(a.id, 'door', 0), offset_mm: 1000, width_mm: 900 };
    expect(grabOffset(g, door, { x: 1300, y: 10 })).toBeCloseTo(300, 6);
  });
});
