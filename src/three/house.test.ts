import { describe, expect, it } from 'vite-plus/test';
import type * as THREE from 'three';
import { newOpening, newRoom, newWall, type Floor } from '../model/schema';
import { buildHouse } from './house';

function floorWith(type: 'door' | 'window' | 'opening' | null): Floor {
  const room = newRoom('A', 200);
  room.walls = [4000, 3000, 4000, 3000].map((l) => newWall(l, 200));
  const openings = type ? [{ ...newOpening(room.id, type, 0), offset_mm: 1000, width_mm: 900 }] : [];
  return { id: 'f', name: 'Ground', level: 0, rooms: [room], openings };
}

/** Floor area in m², from the floor meshes' triangles. */
function floorArea(f: Floor): number {
  const house = buildHouse([f], new Map(), { ceilings: 'hidden', furniture: false, defaultHeight: 2600 });
  let area = 0;
  house.group.traverse((o) => {
    if (!o.name.startsWith('floor')) return;
    const p = (o as THREE.Mesh).geometry.getAttribute('position');
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i + 1) - p.getX(i);
      const az = p.getZ(i + 1) - p.getZ(i);
      const bx = p.getX(i + 2) - p.getX(i);
      const bz = p.getZ(i + 2) - p.getZ(i);
      area += Math.abs(ax * bz - az * bx) / 2;
    }
  });
  house.dispose();
  return area;
}

describe('the floor in 3D', () => {
  it('runs on through the wall under a door or passage, not under a window', () => {
    const bare = floorArea(floorWith(null));
    expect(bare).toBeCloseTo(12, 6);
    // 0.9 m wide, 0.2 m wall.
    expect(floorArea(floorWith('door')) - bare).toBeCloseTo(0.18, 6);
    expect(floorArea(floorWith('opening')) - bare).toBeCloseTo(0.18, 6);
    expect(floorArea(floorWith('window')) - bare).toBeCloseTo(0, 6);
  });
});
