// Infinite chunked world. Terrain, props and natural items are all derived from noise + coordinate hashes,
// so any chunk can be regenerated identically. Player-caused changes are kept in a per-chunk delta.
import { Container, Sprite, Texture, type Renderer } from 'pixi.js'
import { Noise2D, hash2 } from './noise'
import { TILE, CHUNK, CHUNK_PX, PROPS, SOLID_TERRAIN, type Terrain, type PropKind } from './types'
import { ITEM_IDS, type ItemId } from './items'
import type { TextureBank } from './textures'

export interface Prop {
  kind: PropKind
  x: number
  y: number
  radius: number
  sprite: Sprite
}

export interface GroundItem {
  id: number
  item: ItemId
  x: number
  y: number
  sprite: Sprite
  shadow: Sprite
  /** Hover animation phase. */
  phase: number
  /** Chunk whose item list owns this entry (items can drift across borders when pulled). */
  chunk: Chunk
}

interface ChunkDelta {
  /** Natural items (by tile key) that were picked up. */
  removed: Set<string>
  /** Items dropped/thrown into this chunk. */
  added: { item: ItemId; x: number; y: number }[]
}

export interface Chunk {
  cx: number
  cy: number
  ground: Sprite
  props: Prop[]
  items: GroundItem[]
  terrain: Terrain[]
}

let nextItemId = 1

export class World {
  private noise: Noise2D
  private chunks = new Map<string, Chunk>()
  private deltas = new Map<string, ChunkDelta>()
  readonly groundLayer = new Container()
  readonly objectLayer = new Container()

  readonly seed: number
  private renderer: Renderer
  private tex: TextureBank

  constructor(seed: number, renderer: Renderer, tex: TextureBank) {
    this.seed = seed
    this.renderer = renderer
    this.tex = tex
    this.noise = new Noise2D(seed)
    this.objectLayer.sortableChildren = true
  }

  // ---------- Terrain sampling ----------

  terrainAt(tx: number, ty: number): Terrain {
    const n = this.noise
    const e = n.fbm(tx * 0.012 + 100, ty * 0.012 + 100, 5)         // elevation
    const m = n.fbm(tx * 0.02 - 300, ty * 0.02 + 50, 3)             // moisture
    const w = n.ridge(tx * 0.03 + 900, ty * 0.03 - 900)             // washes
    const d = n.fbm(tx * 0.045 + 40, ty * 0.045 - 70, 2)              // detail
    if (e > 0.78) return 'cliff'
    if (e > 0.64) return 'rock'
    if (e < 0.3 && m > 0.72) return 'water'
    if (e < 0.36 && m > 0.62) return 'scrub'
    if (w > 0.93 && e < 0.6) return 'wash'
    if (m > 0.52 && d > 0.5) return 'scrub'
    return d > 0.55 ? 'caliche' : 'sand'
  }

  isSolidTile(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE)
    return SOLID_TERRAIN.has(this.terrainAt(tx, ty))
  }

  /** Elevation-based color for the minimap. */
  minimapColor(tx: number, ty: number): number {
    switch (this.terrainAt(tx, ty)) {
      case 'sand': return 0xd8b98c
      case 'caliche': return 0xc3a074
      case 'wash': return 0xbcb19d
      case 'scrub': return 0xa8a86a
      case 'rock': return 0xa08a72
      case 'cliff': return 0x6b5646
      case 'water': return 0x4c8ba6
    }
  }

  // ---------- Prop / item placement ----------

  private propFor(tx: number, ty: number, t: Terrain): PropKind | null {
    if (t === 'water' || t === 'cliff') return null
    const r = hash2(tx, ty, this.seed, 1)
    const pick = hash2(tx, ty, this.seed, 2)
    // Bajada density: saguaros love mid-elevation slopes.
    const e = this.noise.fbm(tx * 0.012 + 100, ty * 0.012 + 100, 5)
    const cluster = this.noise.fbm(tx * 0.05 + 500, ty * 0.05 + 500, 2)
    switch (t) {
      case 'rock':
        if (r < 0.06) return pick < 0.5 ? 'boulder' : 'rocks'
        if (r < 0.085) return pick < 0.5 ? 'barrel' : 'ocotillo'
        if (r < 0.1) return 'saguaro'
        return null
      case 'wash':
        if (r < 0.03) return 'rocks'
        if (r < 0.05) return pick < 0.5 ? 'mesquite' : 'paloverde'
        return null
      case 'scrub':
        if (r < 0.05) return pick < 0.4 ? 'mesquite' : pick < 0.7 ? 'paloverde' : 'creosote'
        if (r < 0.08) return pick < 0.5 ? 'brittle' : 'prickly'
        return null
      default: {
        const dens = 0.02 + cluster * 0.05 + (e > 0.42 && e < 0.64 ? 0.03 : 0)
        if (r < dens * 0.35) return pick < 0.6 ? 'saguaro' : 'saguaro2'
        if (r < dens * 0.55) return pick < 0.5 ? 'cholla' : 'prickly'
        if (r < dens * 0.7) return pick < 0.5 ? 'creosote' : 'brittle'
        if (r < dens * 0.8) return pick < 0.5 ? 'barrel' : 'ocotillo'
        if (r < dens * 0.9) return pick < 0.5 ? 'paloverde' : 'rocks'
        if (r < dens * 0.95) return 'boulder'
        if (r < dens * 0.97) return 'deadtree'
        if (r < dens * 0.975) return 'skull'
        return null
      }
    }
  }

  private itemFor(tx: number, ty: number, t: Terrain): ItemId | null {
    if (t === 'water' || t === 'cliff') return null
    const r = hash2(tx, ty, this.seed, 3)
    if (r > 0.012) return null
    const pick = hash2(tx, ty, this.seed, 4)
    const weights: Partial<Record<ItemId, number>> = t === 'wash'
      ? { rock: 4, quartz: 2, bottle: 1, can: 1, bone: 1, shell: 0.3 }
      : t === 'rock'
        ? { rock: 5, quartz: 3, bone: 1, feather: 0.5 }
        : t === 'scrub'
          ? { seed: 4, pad: 2, feather: 1, fruit: 1, bone: 0.5 }
          : { rock: 3, fruit: 1.5, scrap: 1, can: 1, bottle: 1, battery: 0.4, bone: 0.7, feather: 0.6, seed: 1, quartz: 0.5 }
    let total = 0
    for (const id of ITEM_IDS) total += weights[id] ?? 0
    let acc = 0
    for (const id of ITEM_IDS) {
      acc += weights[id] ?? 0
      if (pick * total < acc) return id
    }
    return 'rock'
  }

  // ---------- Chunk lifecycle ----------

  private key(cx: number, cy: number): string { return `${cx},${cy}` }

  private delta(cx: number, cy: number): ChunkDelta {
    const k = this.key(cx, cy)
    let d = this.deltas.get(k)
    if (!d) { d = { removed: new Set(), added: [] }; this.deltas.set(k, d) }
    return d
  }

  /** Ensure chunks within `radius` chunks of (px,py) exist; unload those far away. */
  update(px: number, py: number, radius = 2): void {
    const ccx = Math.floor(px / CHUNK_PX), ccy = Math.floor(py / CHUNK_PX)
    for (let cy = ccy - radius; cy <= ccy + radius; cy++)
      for (let cx = ccx - radius; cx <= ccx + radius; cx++)
        if (!this.chunks.has(this.key(cx, cy))) this.load(cx, cy)
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - ccx) > radius + 2 || Math.abs(c.cy - ccy) > radius + 2) {
        this.unload(k, c)
      }
    }
  }

  private load(cx: number, cy: number): Chunk {
    const ox = cx * CHUNK_PX, oy = cy * CHUNK_PX
    const terrain: Terrain[] = new Array(CHUNK * CHUNK)
    const tilesC = new Container()
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty
        const t = this.terrainAt(wx, wy)
        terrain[ty * CHUNK + tx] = t
        const v = Math.floor(hash2(wx, wy, this.seed, 9) * 4)
        const s = new Sprite(this.tex.terrain[t][v]!)
        s.position.set(tx * TILE, ty * TILE)
        tilesC.addChild(s)
        // shoreline / cliff edge shading
        if (t === 'water' || t === 'cliff') {
          const up = this.terrainAt(wx, wy - 1)
          if (up !== t) {
            const edge = new Sprite(this.tex.pixel)
            edge.tint = t === 'water' ? 0x8dc4d8 : 0x9c8570
            edge.position.set(tx * TILE, ty * TILE); edge.width = TILE; edge.height = 3
            tilesC.addChild(edge)
          }
        }
      }
    }
    const groundTex: Texture = this.renderer.generateTexture({ target: tilesC, resolution: 1, antialias: false })
    groundTex.source.scaleMode = 'nearest'
    tilesC.destroy({ children: true })
    const ground = new Sprite(groundTex)
    ground.position.set(ox, oy)
    this.groundLayer.addChild(ground)

    const chunk: Chunk = { cx, cy, ground, props: [], items: [], terrain }
    const delta = this.delta(cx, cy)

    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty
        const t = terrain[ty * CHUNK + tx]!
        const jx = hash2(wx, wy, this.seed, 5) * TILE, jy = hash2(wx, wy, this.seed, 6) * TILE
        const kind = this.propFor(wx, wy, t)
        if (kind) {
          const def = PROPS[kind]
          const variant = Math.floor(hash2(wx, wy, this.seed, 7) * def.variants)
          const sprite = new Sprite(this.tex.props[kind][variant]!)
          sprite.anchor.set(0.5, 1)
          sprite.position.set(ox + tx * TILE + jx, oy + ty * TILE + jy)
          sprite.zIndex = sprite.y
          this.objectLayer.addChild(sprite)
          chunk.props.push({ kind, x: sprite.x, y: sprite.y, radius: def.radius, sprite })
          continue
        }
        const item = this.itemFor(wx, wy, t)
        if (item && !delta.removed.has(`${wx},${wy}`)) {
          this.spawnItem(chunk, item, ox + tx * TILE + jx, oy + ty * TILE + jy, true)
        }
      }
    }
    for (const a of delta.added) this.spawnItem(chunk, a.item, a.x, a.y, false)
    this.chunks.set(this.key(cx, cy), chunk)
    return chunk
  }

  private spawnItem(chunk: Chunk, item: ItemId, x: number, y: number, natural: boolean): GroundItem {
    const sprite = new Sprite(this.tex.items[item])
    sprite.anchor.set(0.5, 1)
    sprite.position.set(x, y)
    sprite.zIndex = y
    const shadow = new Sprite(this.tex.shadow)
    shadow.anchor.set(0.5, 0.5)
    shadow.position.set(x, y)
    shadow.zIndex = y - 0.5
    shadow.scale.set(0.8)
    this.objectLayer.addChild(shadow, sprite)
    const gi: GroundItem = { id: nextItemId++, item, x, y, sprite, shadow, phase: Math.random() * Math.PI * 2, chunk }
    if (natural) this.natural.add(gi)
    chunk.items.push(gi)
    return gi
  }

  private unload(k: string, c: Chunk): void {
    // Persist dynamic items so they are still here when the chunk reloads.
    const d = this.delta(c.cx, c.cy)
    d.added = c.items.filter((i) => !this.isNaturalItem(i)).map((i) => ({ item: i.item, x: i.x, y: i.y }))
    for (const p of c.props) p.sprite.destroy()
    for (const i of c.items) { i.sprite.destroy(); i.shadow.destroy() }
    c.ground.destroy({ texture: true })
    this.chunks.delete(k)
  }

  private natural = new WeakSet<GroundItem>()
  private isNaturalItem(i: GroundItem): boolean { return this.natural.has(i) }

  // ---------- Queries used by the game ----------

  chunkAt(x: number, y: number): Chunk {
    const cx = Math.floor(x / CHUNK_PX), cy = Math.floor(y / CHUNK_PX)
    return this.chunks.get(this.key(cx, cy)) ?? this.load(cx, cy)
  }

  /** Drop an item onto the ground at a world position. */
  dropItem(item: ItemId, x: number, y: number): GroundItem {
    return this.spawnItem(this.chunkAt(x, y), item, x, y, false)
  }

  /** Remove a ground item from the world (picked up). */
  removeItem(gi: GroundItem): void {
    const c = gi.chunk
    const idx = c.items.indexOf(gi)
    if (idx < 0) return // already removed
    c.items.splice(idx, 1)
    if (this.natural.has(gi)) {
      this.delta(c.cx, c.cy).removed.add(`${Math.floor(gi.x / TILE)},${Math.floor(gi.y / TILE)}`)
    }
    gi.sprite.destroy(); gi.shadow.destroy()
  }

  *nearbyChunks(x: number, y: number, r = 1): Iterable<Chunk> {
    const cx = Math.floor(x / CHUNK_PX), cy = Math.floor(y / CHUNK_PX)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const c = this.chunks.get(this.key(cx + dx, cy + dy))
        if (c) yield c
      }
  }

  *nearbyProps(x: number, y: number): Iterable<Prop> {
    for (const c of this.nearbyChunks(x, y)) for (const p of c.props) if (p.radius > 0) yield p
  }

  *nearbyItems(x: number, y: number): Iterable<GroundItem> {
    for (const c of this.nearbyChunks(x, y)) for (const i of c.items) yield i
  }

  get loadedChunkCount(): number { return this.chunks.size }
}
