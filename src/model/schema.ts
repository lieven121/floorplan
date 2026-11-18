/**
 * The project file format. Everything is stored in millimetres and degrees.
 *
 * `layers` and `attachments` are not used by the UI yet. They are part of the
 * format now so that files exported today still open once the backend
 * (electrical plan, water lines, photos, construction notes) exists.
 */

import type { Electrical } from './electrical';
import type { Utilities } from './utilities';

export const SCHEMA_VERSION = 1;

export type Id = string;
export type LengthUnit = 'm' | 'cm' | 'mm';

export interface Point {
  x: number;
  y: number;
}

/**
 * One wall of a room, measured on the inside face.
 * Wall k runs from corner k to corner k+1; `angle_deg` is the inside angle
 * at its END corner (90 for a normal corner, 270 for a corner that sticks into the room).
 */
export interface Wall {
  id: Id;
  length_mm: number;
  angle_deg: number;
  /** True once the angle was typed in. Untouched corners are a 90° guess that may give way. */
  angle_measured?: boolean;
  thickness_mm: number;
  /** Only when this wall differs from the room's height. */
  height_mm?: number;
  /**
   * Attic: the ceiling starts at this wall's height and rises into the room at
   * this angle from the horizontal (the roof pitch), up to the room's height.
   */
  slope_deg?: number;
  /** Default interior. */
  kind?: WallKind;
  loadBearing?: boolean;
  /** For renovation plans. Default existing. */
  status?: WallStatus;
}

export type WallKind = 'interior' | 'exterior';
export type WallStatus = 'existing' | 'new' | 'demolish';

/** True when a wall carries any type other than the defaults. */
export const hasWallType = (w: Pick<Wall, 'kind' | 'loadBearing' | 'status'>) =>
  w.kind === 'exterior' || !!w.loadBearing || (w.status !== undefined && w.status !== 'existing');

/** Floor covering, wall and ceiling finishes of a room. */
export interface RoomFinish {
  /** An id from FLOOR_COVERINGS (model/finishes.ts), or free text. */
  floor?: string;
  /** Free text: "paint white", "tiles to 1.2 m". */
  walls?: string;
  ceiling?: string;
  /** Default true; false for tiled or bare rooms. */
  skirting?: boolean;
}

/** Older files have no flag: there, any angle other than 90° was typed in. */
export const isAngleMeasured = (w: Pick<Wall, 'angle_deg' | 'angle_measured'>) =>
  w.angle_measured ?? w.angle_deg !== 90;

/** A measured distance between two corners (0-based corner indexes). */
export interface Diagonal {
  id: Id;
  from: number;
  to: number;
  length_mm: number;
}

export interface Room {
  id: Id;
  name: string;
  /** World position of corner 0. */
  origin: Point;
  /** Rotation around corner 0, clockwise on screen. */
  rotation_deg: number;
  walls: Wall[];
  diagonals: Diagonal[];
  /** Wall/ceiling height for the whole room; a wall can override it. */
  height_mm?: number;
  /** Floor of this room relative to the floor level (e.g. -200: 20 cm lower). */
  floorLevel_mm?: number;
  stairs?: Stair[];
  notes?: string;
  /** A locked room can't be dragged or rotated on the floor view. */
  locked?: boolean;
  furniture?: Furniture[];
  /** Notes placed at a spot in the room, drawn as numbered dots. */
  pins?: NotePin[];
  finish?: RoomFinish;
}

/** A note at a spot in the room (room coordinates). Photos link to it through Attachment.linkedTo. */
export interface NotePin {
  id: Id;
  x_mm: number;
  y_mm: number;
  title: string;
  text: string;
  createdAt: string;
}

export function newPin(x_mm: number, y_mm: number): NotePin {
  return { id: uid(), x_mm: Math.round(x_mm), y_mm: Math.round(y_mm), title: '', text: '', createdAt: new Date().toISOString() };
}

/**
 * Stairs or a slope (ramp), in room coordinates. It goes UP along its length,
 * in the direction of `rotation_deg` (0 = along W1).
 */
export interface Stair {
  id: Id;
  kind: 'stairs' | 'ramp';
  name: string;
  /** Centre. */
  x_mm: number;
  y_mm: number;
  width_mm: number;
  length_mm: number;
  rotation_deg: number;
  /** Total height it climbs. */
  rise_mm: number;
  /** Stairs only. */
  steps: number;
}

export function newStair(kind: Stair['kind'], x_mm: number, y_mm: number): Stair {
  return kind === 'stairs'
    ? { id: uid(), kind, name: 'Stairs', x_mm, y_mm, width_mm: 900, length_mm: 3000, rotation_deg: 0, rise_mm: 2700, steps: 15 }
    : { id: uid(), kind, name: 'Slope', x_mm, y_mm, width_mm: 1000, length_mm: 1500, rotation_deg: 0, rise_mm: 200, steps: 0 };
}

/** Effective height of wall k. */
export const wallHeight = (room: Room, k: number, fallback = 2600) =>
  room.walls[k]?.height_mm ?? room.height_mm ?? fallback;

export type FurnitureShape = 'rect' | 'round';

/** A piece of furniture, in room coordinates (C1 at 0,0, wall W1 along +x). */
export interface Furniture {
  id: Id;
  name: string;
  kind: string;
  shape: FurnitureShape;
  /** Centre. */
  x_mm: number;
  y_mm: number;
  width_mm: number;
  depth_mm: number;
  rotation_deg: number;
}

export type OpeningType = 'door' | 'window' | 'opening';

export interface Opening {
  id: Id;
  roomId: Id;
  wallIndex: number;
  /** Distance from the wall's start corner to the near edge of the opening. */
  offset_mm: number;
  width_mm: number;
  height_mm: number;
  sill_mm: number;
  type: OpeningType;
  /** Doors only. */
  swing?: { hinge: 'start' | 'end'; side: 'in' | 'out' };
}

export interface Floor {
  id: Id;
  name: string;
  level: number;
  rooms: Room[];
  openings: Opening[];
}

/** Reserved: an item on an installation layer (socket, pipe, valve, …). */
export interface LayerItem {
  id: Id;
  kind: string;
  floorId: Id;
  anchor: {
    roomId?: Id;
    wallIndex?: number;
    offset_mm?: number;
    x_mm?: number;
    y_mm?: number;
    height_mm?: number;
  };
  props: Record<string, unknown>;
  attachmentIds: Id[];
}

/** Reserved: electrical, water, heating, network, construction, … */
export interface Layer {
  id: Id;
  kind: string;
  name: string;
  items: LayerItem[];
}

/**
 * A photo, document or note linked to any item by id (today: rooms).
 * The file itself is stored separately; `uri` is "file:<id>" for files kept by the app.
 */
export interface Attachment {
  id: Id;
  kind: 'photo' | 'document' | 'note';
  name: string;
  mime?: string;
  size?: number;
  uri?: string;
  /** Caption, or the text of a note. */
  text?: string;
  tags: string[];
  linkedTo: Id[];
  createdAt: string;
}

/** What the plan shows (floor view, room editor and exports). */
export interface ViewSettings {
  grid: boolean;
  dimensions: boolean;
  names: boolean;
  angles: boolean;
  notes: boolean;
  furniture: boolean;
  /** The electrical plan (sockets, lights, fuse boxes). */
  installations: boolean;
  /** Water, drainage, heating, ventilation and gas. */
  utilities: boolean;
  /** The floor below / above drawn through this one as an outline. */
  below: boolean;
  above: boolean;
  /** Rooms tinted by floor covering, with the covering under the name. */
  finishes: boolean;
}

export const DEFAULT_VIEW: ViewSettings = {
  grid: true,
  dimensions: true,
  names: true,
  angles: false,
  notes: true,
  furniture: true,
  installations: true,
  utilities: true,
  below: false,
  above: false,
  finishes: false,
};

export const GHOST_COLOR = { below: '#0891b2', above: '#c026d3' };

/** The next floor down (−1) or up (+1) by level. */
export function neighbourFloor(floors: Floor[], floor: Floor, step: -1 | 1): Floor | undefined {
  const sorted = [...floors].sort((a, b) => a.level - b.level);
  return sorted[sorted.findIndex((f) => f.id === floor.id) + step];
}

export interface ProjectSettings {
  unit: LengthUnit;
  defaultThickness_mm: number;
  /** Height given to new rooms. */
  defaultHeight_mm?: number;
  /** Free height under which floor area doesn't count as usable (sloped ceilings). Default 1800. */
  headroom_mm?: number;
  view?: ViewSettings;
}

export interface Project {
  schemaVersion: number;
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  floors: Floor[];
  layers: Layer[];
  attachments: Attachment[];
  /** Fuse boxes, circuits and points (sockets, lights, …). */
  electrical?: Electrical;
  /** Water, drainage, heating, ventilation and gas: points and pipes. */
  utilities?: Utilities;
  meta: Record<string, unknown>;
}

/** Random id. Uses getRandomValues, which (unlike randomUUID) also works over plain http on the LAN. */
export function uid(): Id {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const fileUri = (fileId: Id) => `file:${fileId}`;
export const fileIdOf = (uri?: string): Id | null => (uri?.startsWith('file:') ? uri.slice(5) : null);

export function newWall(length_mm = 0, thickness_mm = 100, angle_deg = 90): Wall {
  return { id: uid(), length_mm, angle_deg, thickness_mm };
}

export function newRoom(name: string, thickness_mm = 100, origin: Point = { x: 0, y: 0 }): Room {
  return {
    id: uid(),
    name,
    origin,
    rotation_deg: 0,
    walls: [0, 0, 0, 0].map(() => newWall(0, thickness_mm)),
    diagonals: [],
  };
}

export function newFloor(name: string, level = 0): Floor {
  return { id: uid(), name, level, rooms: [], openings: [] };
}

export function newOpening(roomId: Id, type: OpeningType, wallIndex = 0): Opening {
  const door = type === 'door';
  return {
    id: uid(),
    roomId,
    wallIndex,
    offset_mm: 200,
    width_mm: door ? 880 : 1000,
    height_mm: door ? 2010 : 1200,
    sill_mm: type === 'window' ? 900 : 0,
    type,
    swing: door ? { hinge: 'start', side: 'in' } : undefined,
  };
}

export function newProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    settings: { unit: 'm', defaultThickness_mm: 100, defaultHeight_mm: 2600, view: { ...DEFAULT_VIEW } },
    floors: [newFloor('Ground floor', 0)],
    layers: [],
    attachments: [],
    meta: {},
  };
}
