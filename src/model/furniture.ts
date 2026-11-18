import { type Furniture, type FurnitureShape, uid } from './schema';
import type { Vec } from '../geometry/vec';

export interface FurniturePreset {
  kind: string;
  name: string;
  width_mm: number;
  depth_mm: number;
  shape: FurnitureShape;
}

/** Common sizes; change them per item after adding. */
export const FURNITURE_PRESETS: FurniturePreset[] = [
  { kind: 'bed-double', name: 'Double bed', width_mm: 1600, depth_mm: 2000, shape: 'rect' },
  { kind: 'bed-single', name: 'Single bed', width_mm: 900, depth_mm: 2000, shape: 'rect' },
  { kind: 'sofa', name: 'Sofa', width_mm: 2000, depth_mm: 900, shape: 'rect' },
  { kind: 'armchair', name: 'Armchair', width_mm: 850, depth_mm: 850, shape: 'rect' },
  { kind: 'table', name: 'Dining table', width_mm: 1600, depth_mm: 900, shape: 'rect' },
  { kind: 'table-round', name: 'Round table', width_mm: 1000, depth_mm: 1000, shape: 'round' },
  { kind: 'chair', name: 'Chair', width_mm: 450, depth_mm: 500, shape: 'rect' },
  { kind: 'desk', name: 'Desk', width_mm: 1400, depth_mm: 700, shape: 'rect' },
  { kind: 'wardrobe', name: 'Wardrobe', width_mm: 1500, depth_mm: 600, shape: 'rect' },
  { kind: 'cabinet', name: 'Cabinet', width_mm: 800, depth_mm: 400, shape: 'rect' },
  { kind: 'counter', name: 'Kitchen counter', width_mm: 2400, depth_mm: 600, shape: 'rect' },
  { kind: 'fridge', name: 'Fridge', width_mm: 600, depth_mm: 650, shape: 'rect' },
  { kind: 'washer', name: 'Washing machine', width_mm: 600, depth_mm: 600, shape: 'rect' },
  { kind: 'bathtub', name: 'Bathtub', width_mm: 1700, depth_mm: 750, shape: 'rect' },
  { kind: 'shower', name: 'Shower', width_mm: 900, depth_mm: 900, shape: 'rect' },
  { kind: 'toilet', name: 'Toilet', width_mm: 400, depth_mm: 650, shape: 'rect' },
  { kind: 'sink', name: 'Sink', width_mm: 600, depth_mm: 450, shape: 'rect' },
  { kind: 'custom', name: 'Item', width_mm: 1000, depth_mm: 600, shape: 'rect' },
];

export function newFurniture(preset: FurniturePreset, at: Vec): Furniture {
  return {
    id: uid(),
    name: preset.name,
    kind: preset.kind,
    shape: preset.shape,
    x_mm: Math.round(at.x),
    y_mm: Math.round(at.y),
    width_mm: preset.width_mm,
    depth_mm: preset.depth_mm,
    rotation_deg: 0,
  };
}
