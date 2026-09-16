export type ItemId =
  | 'rock' | 'quartz' | 'scrap' | 'bottle' | 'can' | 'bone'
  | 'feather' | 'fruit' | 'seed' | 'battery' | 'pad' | 'shell'

export interface ItemDef {
  id: ItemId
  name: string
  desc: string
  /** Mass affects throw distance a little. */
  mass: number
  maxStack: number
}

export const ITEMS: Record<ItemId, ItemDef> = {
  rock:    { id: 'rock',    name: 'Rock',           desc: 'A sun-baked desert rock. Throws well.',           mass: 1.0, maxStack: 99 },
  quartz:  { id: 'quartz',  name: 'Quartz',         desc: 'A milky crystal glinting in the sand.',           mass: 0.8, maxStack: 99 },
  scrap:   { id: 'scrap',   name: 'Scrap Metal',    desc: 'Rusted plate from something long forgotten.',     mass: 1.4, maxStack: 99 },
  bottle:  { id: 'bottle',  name: 'Glass Bottle',   desc: 'Bleached blue by decades of sun.',                mass: 0.7, maxStack: 99 },
  can:     { id: 'can',     name: 'Tin Can',        desc: 'Dented, label long gone.',                        mass: 0.3, maxStack: 99 },
  bone:    { id: 'bone',    name: 'Bone',           desc: 'Something did not make it across the flats.',     mass: 0.6, maxStack: 99 },
  feather: { id: 'feather', name: 'Hawk Feather',   desc: "A red-tailed hawk's feather.",                    mass: 0.05, maxStack: 99 },
  fruit:   { id: 'fruit',   name: 'Saguaro Fruit',  desc: 'Sweet, red, and full of tiny seeds.',             mass: 0.4, maxStack: 99 },
  seed:    { id: 'seed',    name: 'Mesquite Pod',   desc: 'A dry seed pod. Rattles when thrown.',            mass: 0.1, maxStack: 99 },
  battery: { id: 'battery', name: 'Old Battery',    desc: 'Still has a little charge, maybe.',               mass: 1.2, maxStack: 99 },
  pad:     { id: 'pad',     name: 'Cactus Pad',     desc: 'A prickly pear pad. Mind the spines.',            mass: 0.5, maxStack: 99 },
  shell:   { id: 'shell',   name: 'Tortoise Shell', desc: 'An empty desert tortoise shell.',                 mass: 0.9, maxStack: 99 },
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[]
