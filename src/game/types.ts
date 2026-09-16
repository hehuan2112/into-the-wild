export const TILE = 32
export const CHUNK = 16               // tiles per chunk side
export const CHUNK_PX = TILE * CHUNK  // 512

export type Terrain = 'sand' | 'caliche' | 'wash' | 'scrub' | 'rock' | 'cliff' | 'water'

export type PropKind =
  | 'saguaro' | 'saguaro2' | 'cholla' | 'prickly' | 'barrel' | 'ocotillo'
  | 'paloverde' | 'mesquite' | 'creosote' | 'boulder' | 'rocks' | 'deadtree' | 'skull' | 'brittle'

export interface PropDef {
  kind: PropKind
  /** Collision radius at the base; 0 = walk through. */
  radius: number
  /** Number of texture variants. */
  variants: number
}

export const PROPS: Record<PropKind, PropDef> = {
  saguaro:   { kind: 'saguaro',   radius: 7,  variants: 3 },
  saguaro2:  { kind: 'saguaro2',  radius: 7,  variants: 2 },
  cholla:    { kind: 'cholla',    radius: 7,  variants: 2 },
  prickly:   { kind: 'prickly',   radius: 9,  variants: 2 },
  barrel:    { kind: 'barrel',    radius: 7,  variants: 2 },
  ocotillo:  { kind: 'ocotillo',  radius: 4,  variants: 2 },
  paloverde: { kind: 'paloverde', radius: 6,  variants: 2 },
  mesquite:  { kind: 'mesquite',  radius: 6,  variants: 2 },
  creosote:  { kind: 'creosote',  radius: 0,  variants: 3 },
  boulder:   { kind: 'boulder',   radius: 13, variants: 3 },
  rocks:     { kind: 'rocks',     radius: 0,  variants: 3 },
  deadtree:  { kind: 'deadtree',  radius: 4,  variants: 2 },
  skull:     { kind: 'skull',     radius: 0,  variants: 1 },
  brittle:   { kind: 'brittle',   radius: 0,  variants: 2 },
}

export const SOLID_TERRAIN: Set<Terrain> = new Set(['cliff', 'water'])
