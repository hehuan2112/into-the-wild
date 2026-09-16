// All art is generated at runtime with Pixi Graphics. No external assets required.
import { Graphics, Texture, Container, type Renderer } from 'pixi.js'
import { mulberry32 } from './noise'
import { TILE, type PropKind, type Terrain, PROPS } from './types'
import { ITEM_IDS, type ItemId } from './items'

export type Facing = 'down' | 'up' | 'left' | 'right'

export interface TextureBank {
  terrain: Record<Terrain, Texture[]>
  props: Record<PropKind, Texture[]>
  items: Record<ItemId, Texture>
  robot: Record<Facing, Texture[]>  // [idle, step1, step2]
  shadow: Texture
  pixel: Texture
}

function gen(renderer: Renderer, g: Container): Texture {
  const tex = renderer.generateTexture({ target: g, resolution: 1, antialias: false })
  tex.source.scaleMode = 'nearest'
  g.destroy(true)
  return tex
}

// ---------- Terrain tiles ----------

const TERRAIN_STYLE: Record<Terrain, { base: number; specks: number[]; density: number; extra?: 'grass' | 'crack' | 'ripple' | 'pebble' }> = {
  sand:    { base: 0xd8b98c, specks: [0xcaa877, 0xe5c9a0, 0xd2b184], density: 40 },
  caliche: { base: 0xc3a074, specks: [0xb38f64, 0xcfae82, 0xa88358], density: 46, extra: 'crack' },
  wash:    { base: 0xbcb19d, specks: [0x9c9486, 0xd0c7b4, 0xa79f8f, 0x8c8478], density: 70, extra: 'pebble' },
  scrub:   { base: 0xc7b27f, specks: [0xb7a36f, 0xd3bf8d, 0x8f9c58, 0x7d8b49], density: 50, extra: 'grass' },
  rock:    { base: 0xa08a72, specks: [0x8f7a63, 0xb09a80, 0x7d6a55], density: 50, extra: 'crack' },
  cliff:   { base: 0x7b6653, specks: [0x6a5644, 0x8d7660, 0x5c4a3a], density: 60, extra: 'crack' },
  water:   { base: 0x4c8ba6, specks: [0x69aac4, 0x3f7a94, 0x7cb8d0], density: 20, extra: 'ripple' },
}

function terrainTile(renderer: Renderer, t: Terrain, seed: number): Texture {
  const s = TERRAIN_STYLE[t]
  const rng = mulberry32(seed)
  const g = new Graphics()
  g.rect(0, 0, TILE, TILE).fill(s.base)
  for (let i = 0; i < s.density; i++) {
    const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE)
    const c = s.specks[Math.floor(rng() * s.specks.length)]!
    const w = rng() < 0.3 ? 2 : 1
    g.rect(x, y, w, 1).fill(c)
  }
  if (s.extra === 'grass') {
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE)
      g.rect(x, y - 3, 1, 3).fill(0x8a9a55)
      g.rect(x + 1, y - 2, 1, 2).fill(0x9aa860)
    }
  } else if (s.extra === 'crack') {
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE)
      for (let k = 0; k < 6; k++) {
        g.rect(x, y, 1, 1).fill(s.specks[2]!)
        x += rng() < 0.5 ? 1 : 0; y += rng() < 0.7 ? 1 : -1
      }
    }
  } else if (s.extra === 'pebble') {
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE)
      g.rect(x, y, 2, 2).fill(0x8c8478); g.rect(x, y, 2, 1).fill(0xd8d0bd)
    }
  } else if (s.extra === 'ripple') {
    for (let i = 0; i < 4; i++) {
      const x = Math.floor(rng() * TILE), y = Math.floor(rng() * TILE)
      g.rect(x, y, 5, 1).fill(0x8dc4d8)
    }
  }
  return gen(renderer, g)
}

// ---------- Props ----------

function ribs(g: Graphics, x: number, y: number, w: number, h: number, dark: number) {
  for (let i = 1; i < w; i += 3) g.rect(x + i, y, 1, h).fill(dark)
}

function saguaro(g: Graphics, rng: () => number, arms: number) {
  const green = 0x5e8f4c, dark = 0x4a7539, light = 0x77a860
  const h = 46 + Math.floor(rng() * 20)
  const w = 11
  g.roundRect(-w / 2, -h, w, h, 5).fill(green)
  ribs(g, -w / 2, -h + 4, w, h - 6, dark)
  g.rect(-w / 2, -h, 2, h - 3).fill(light)
  for (let a = 0; a < arms; a++) {
    const side = a % 2 === 0 ? -1 : 1
    const ay = -h + 10 + Math.floor(rng() * (h * 0.45))
    const len = 8 + Math.floor(rng() * 8)
    const up = 12 + Math.floor(rng() * 14)
    // horizontal part
    g.roundRect(side < 0 ? -w / 2 - len : w / 2, ay, len + 2, 8, 3).fill(green)
    // vertical part
    const ax = side < 0 ? -w / 2 - len : w / 2 + len - 8
    g.roundRect(ax, ay - up, 8, up + 8, 4).fill(green)
    ribs(g, ax, ay - up + 3, 8, up + 2, dark)
  }
  if (rng() < 0.4) { g.circle(0, -h + 1, 3).fill(0xf0e8d0); g.circle(0, -h + 1, 1.5).fill(0xe0d0a0) }
}

function propTexture(renderer: Renderer, kind: PropKind, variant: number): Texture {
  const rng = mulberry32(kind.length * 977 + variant * 131 + 7)
  const g = new Graphics()
  // Draw with the base at (0,0); items grow upward (negative y).
  switch (kind) {
    case 'saguaro': saguaro(g, rng, variant === 0 ? 0 : variant === 1 ? 1 : 2); break
    case 'saguaro2': saguaro(g, rng, 2 + variant); break
    case 'cholla': {
      const c = 0xbdb07a, d = 0x8f8358
      g.rect(-2, -14, 4, 14).fill(0x7a6b47)
      for (let i = 0; i < 7 + variant * 3; i++) {
        const x = (rng() - 0.5) * 22, y = -10 - rng() * 22
        g.roundRect(x - 3, y - 4, 6, 9, 3).fill(c)
        g.rect(x - 4, y, 8, 1).fill(0xf4efd6)
        g.rect(x - 1, y - 5, 2, 1).fill(d)
      }
      break
    }
    case 'prickly': {
      const pad = 0x6c9752, dark = 0x557a40
      const pads = 4 + variant * 2
      for (let i = 0; i < pads; i++) {
        const x = (rng() - 0.5) * 24, y = -4 - rng() * 16
        g.ellipse(x, y, 7, 9).fill(pad)
        g.ellipse(x - 2, y - 2, 3, 5).fill(0x7fae62)
        for (let k = 0; k < 4; k++) g.rect(x - 5 + Math.floor(rng() * 10), y - 6 + Math.floor(rng() * 12), 1, 1).fill(dark)
        if (rng() < 0.5) g.ellipse(x, y - 10, 2.5, 3.5).fill(0xc23a6b)
      }
      break
    }
    case 'barrel': {
      const r = 8 + variant * 2
      g.ellipse(0, -r + 2, r, r * 0.9).fill(0x678d48)
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        g.moveTo(0, -r + 2).lineTo(Math.cos(ang) * r, -r + 2 + Math.sin(ang) * r * 0.9).stroke({ width: 1, color: 0x4d6e36 })
      }
      g.ellipse(0, -r + 2, r * 0.55, r * 0.5).stroke({ width: 2, color: 0xd1893b })
      break
    }
    case 'ocotillo': {
      const n = 7 + variant * 3
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (rng() - 0.5) * 1.5
        const len = 30 + rng() * 26
        const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len
        g.moveTo(0, 0).lineTo(ex, ey).stroke({ width: 2, color: 0x7d6a4a })
        g.rect(ex - 1, ey - 4, 2, 4).fill(0xd0472f)
        for (let k = 0; k < 5; k++) { const t = 0.2 + k * 0.15; g.rect(ex * t, ey * t, 1, 1).fill(0x8fa060) }
      }
      break
    }
    case 'paloverde': {
      g.rect(-2, -18, 4, 18).fill(0x86ad5f)
      g.rect(-2, -18, 1, 18).fill(0xa4c47c)
      const r = 16 + variant * 4
      g.ellipse(0, -24, r, r * 0.7).fill(0x9fbf6a)
      g.ellipse(-4, -27, r * 0.6, r * 0.4).fill(0xb3cf7d)
      for (let i = 0; i < 12; i++) g.rect(Math.floor((rng() - 0.5) * r * 1.8), -24 + Math.floor((rng() - 0.5) * r * 1.2), 1, 1).fill(0xf3d24b)
      break
    }
    case 'mesquite': {
      g.rect(-3, -16, 5, 16).fill(0x5f4632)
      g.moveTo(-1, -12).lineTo(-9, -22).stroke({ width: 2, color: 0x5f4632 })
      g.moveTo(1, -12).lineTo(8, -20).stroke({ width: 2, color: 0x5f4632 })
      const r = 17 + variant * 4
      g.ellipse(0, -26, r, r * 0.6).fill(0x6a8946)
      g.ellipse(3, -29, r * 0.6, r * 0.35).fill(0x7c9b53)
      for (let i = 0; i < 6; i++) g.rect(Math.floor((rng() - 0.5) * r * 1.6), -26 + Math.floor((rng() - 0.5) * r), 1, 3).fill(0xb89a5a)
      break
    }
    case 'creosote': {
      for (let i = 0; i < 10 + variant * 4; i++) {
        const ang = -Math.PI / 2 + (rng() - 0.5) * 2.2
        const len = 10 + rng() * 12
        const ex = Math.cos(ang) * len, ey = Math.sin(ang) * len
        g.moveTo(0, 0).lineTo(ex, ey).stroke({ width: 1, color: 0x6d5a3d })
        g.rect(ex - 1, ey - 1, 2, 2).fill(0x7e9a4a)
        if (rng() < 0.3) g.rect(ex, ey - 2, 1, 1).fill(0xe8d24a)
      }
      break
    }
    case 'boulder': {
      const w = 22 + variant * 6, h = 14 + variant * 4
      g.ellipse(0, -h / 2 + 2, w / 2, h / 2).fill(0x8c7862)
      g.ellipse(-w * 0.15, -h * 0.65, w * 0.3, h * 0.25).fill(0xa89380)
      g.ellipse(w * 0.1, -h * 0.25, w * 0.4, h * 0.2).fill(0x74624f)
      for (let i = 0; i < 6; i++) g.rect(Math.floor((rng() - 0.5) * w * 0.8), Math.floor(-h / 2 + (rng() - 0.5) * h * 0.7), 1, 1).fill(0x5f4f40)
      break
    }
    case 'rocks': {
      for (let i = 0; i < 3 + variant; i++) {
        const x = (rng() - 0.5) * 18, y = -rng() * 6
        g.ellipse(x, y, 3 + rng() * 2, 2 + rng() * 2).fill(0x94806a)
        g.rect(x - 2, y - 2, 2, 1).fill(0xb9a68f)
      }
      break
    }
    case 'deadtree': {
      g.rect(-2, -26, 4, 26).fill(0x8a7660)
      g.moveTo(0, -18).lineTo(-12, -32).stroke({ width: 2, color: 0x8a7660 })
      g.moveTo(0, -22).lineTo(10, -36 - variant * 6).stroke({ width: 2, color: 0x8a7660 })
      g.moveTo(-6, -25).lineTo(-10, -38).stroke({ width: 1, color: 0x8a7660 })
      break
    }
    case 'skull': {
      g.ellipse(0, -5, 7, 5).fill(0xf0e9d8)
      g.rect(-6, -3, 12, 4).fill(0xe2d9c4)
      g.rect(-4, -6, 2, 2).fill(0x3a3028); g.rect(2, -6, 2, 2).fill(0x3a3028)
      g.moveTo(-6, -8).lineTo(-14, -16).stroke({ width: 2, color: 0xf0e9d8 })
      g.moveTo(6, -8).lineTo(14, -16).stroke({ width: 2, color: 0xf0e9d8 })
      break
    }
    case 'brittle': {
      for (let i = 0; i < 8 + variant * 4; i++) {
        const x = (rng() - 0.5) * 14, y = -2 - rng() * 8
        g.rect(x, y, 1, 4).fill(0x9aa070)
        g.rect(x - 1, y - 1, 3, 2).fill(0xf2d448)
      }
      break
    }
  }
  return gen(renderer, g)
}

// ---------- Items ----------

function itemTexture(renderer: Renderer, id: ItemId): Texture {
  const g = new Graphics()
  // 16x16 canvas centered at (8,8)
  switch (id) {
    case 'rock': g.ellipse(8, 9, 6, 5).fill(0x8c7862); g.ellipse(6, 7, 3, 2).fill(0xa89380); break
    case 'quartz': g.poly([8, 1, 13, 6, 11, 14, 5, 14, 3, 6]).fill(0xf2eef5); g.poly([8, 1, 10, 6, 8, 13, 6, 6]).fill(0xd8c8e8); g.rect(7, 3, 1, 5).fill(0xffffff); break
    case 'scrap': g.poly([2, 4, 14, 2, 13, 12, 3, 14]).fill(0x8a8f93); g.poly([2, 4, 14, 2, 13, 5, 3, 7]).fill(0xb0b5b8); g.rect(5, 8, 2, 2).fill(0x5a4030); g.rect(10, 6, 2, 2).fill(0x5a4030); break
    case 'bottle': g.rect(6, 1, 4, 4).fill(0x6fa4b8); g.roundRect(4, 5, 8, 10, 2).fill(0x7fb8cc); g.rect(5, 6, 1, 7).fill(0xc8e8f0); g.rect(6, 1, 4, 1).fill(0x4a7a8a); break
    case 'can': g.roundRect(4, 2, 8, 12, 1).fill(0xc9c3b8); g.rect(4, 5, 8, 6).fill(0xc94a3a); g.rect(4, 2, 8, 1).fill(0x8f8a80); g.rect(5, 3, 1, 10).fill(0xe8e2d6); break
    case 'bone': g.moveTo(3, 12).lineTo(13, 4).stroke({ width: 3, color: 0xf0e9d8 }); g.circle(3, 12, 2).fill(0xf0e9d8); g.circle(4, 14, 2).fill(0xf0e9d8); g.circle(13, 4, 2).fill(0xf0e9d8); g.circle(12, 2, 2).fill(0xf0e9d8); break
    case 'feather': g.moveTo(3, 14).lineTo(12, 2).stroke({ width: 1, color: 0x5a4a3a }); g.poly([12, 2, 14, 6, 9, 12, 6, 12]).fill(0x8b6b4a); g.poly([12, 2, 8, 3, 5, 9, 6, 12]).fill(0xd8c8b0); g.rect(11, 3, 1, 3).fill(0xc94a3a); break
    case 'fruit': g.ellipse(8, 8, 5, 6).fill(0xc9384f); g.poly([8, 2, 12, 5, 8, 8, 4, 5]).fill(0xe25a6f); g.rect(6, 8, 1, 1).fill(0x2a1a1a); g.rect(9, 10, 1, 1).fill(0x2a1a1a); g.rect(7, 1, 2, 2).fill(0x7a8f4a); break
    case 'seed': g.roundRect(2, 6, 12, 4, 2).fill(0xb8945a); g.rect(4, 7, 1, 2).fill(0x8a6a3a); g.rect(7, 7, 1, 2).fill(0x8a6a3a); g.rect(10, 7, 1, 2).fill(0x8a6a3a); break
    case 'battery': g.roundRect(3, 4, 11, 8, 1).fill(0x3a3a3a); g.rect(14, 6, 1, 4).fill(0xaaaaaa); g.rect(4, 5, 5, 6).fill(0x4caf50); g.rect(9, 5, 4, 6).fill(0xf0c030); g.rect(5, 6, 1, 1).fill(0xffffff); break
    case 'pad': g.ellipse(8, 8, 5, 7).fill(0x6c9752); g.ellipse(6, 6, 2, 3).fill(0x7fae62); g.rect(4, 5, 1, 1).fill(0x557a40); g.rect(10, 9, 1, 1).fill(0x557a40); g.rect(8, 12, 1, 1).fill(0x557a40); break
    case 'shell': g.ellipse(8, 9, 7, 5).fill(0x7a6a48); g.ellipse(8, 8, 4, 3).fill(0x9a8a60); g.rect(3, 9, 10, 1).fill(0x5a4a30); g.rect(7, 5, 1, 8).fill(0x5a4a30); break
  }
  return gen(renderer, g)
}

// ---------- Robot ----------

function robot(renderer: Renderer, facing: Facing, frame: number): Texture {
  const g = new Graphics()
  const body = 0xd3d9de, bodyDark = 0xa9b2b9, accent = 0x2fa39c, visor = 0x1e2630, tread = 0x33363a
  const bob = frame === 0 ? 0 : -1
  const legL = frame === 1 ? 2 : frame === 2 ? -2 : 0
  // treads
  g.roundRect(-11, -6 + legL * 0.5, 9, 6, 2).fill(tread)
  g.roundRect(2, -6 - legL * 0.5, 9, 6, 2).fill(tread)
  g.rect(-10, -4 + legL * 0.5, 7, 1).fill(0x5a5e63)
  g.rect(3, -4 - legL * 0.5, 7, 1).fill(0x5a5e63)
  // body
  g.roundRect(-10, -22 + bob, 20, 16, 3).fill(body)
  g.rect(-10, -22 + bob, 20, 2).fill(0xe9edf0)
  g.rect(-10, -8 + bob, 20, 2).fill(bodyDark)
  // head
  g.roundRect(-8, -32 + bob, 16, 10, 3).fill(body)
  g.rect(-8, -32 + bob, 16, 1).fill(0xe9edf0)
  // antenna
  g.rect(-1, -37 + bob, 2, 5).fill(bodyDark)
  g.circle(0, -38 + bob, 2).fill(0xe8433a)
  if (facing === 'down') {
    g.roundRect(-6, -30 + bob, 12, 5, 2).fill(visor)
    g.rect(-4, -29 + bob, 2, 2).fill(accent); g.rect(2, -29 + bob, 2, 2).fill(accent)
    g.rect(-6, -19 + bob, 12, 6).fill(bodyDark)
    g.rect(-4, -18 + bob, 3, 2).fill(accent); g.rect(1, -18 + bob, 3, 2).fill(0xe8433a)
    g.rect(-13, -20 + bob, 3, 9).fill(bodyDark); g.rect(10, -20 + bob, 3, 9).fill(bodyDark)
  } else if (facing === 'up') {
    g.rect(-6, -20 + bob, 12, 8).fill(bodyDark)
    g.rect(-5, -19 + bob, 10, 1).fill(0x8a949b)
    g.rect(-13, -20 + bob, 3, 9).fill(bodyDark); g.rect(10, -20 + bob, 3, 9).fill(bodyDark)
    g.rect(-2, -27 + bob, 4, 3).fill(bodyDark)
  } else {
    // side view: draw facing right; left is mirrored via sprite scale
    g.roundRect(0, -30 + bob, 8, 5, 2).fill(visor)
    g.rect(4, -29 + bob, 2, 2).fill(accent)
    g.rect(-2, -19 + bob, 4, 6).fill(bodyDark)
    g.rect(-1, -18 + bob, 2, 2).fill(accent)
    g.rect(5, -20 + bob, 4, 9).fill(bodyDark)
  }
  // Pad the texture so all frames share the same size.
  g.rect(-14, -40, 1, 1).fill({ color: 0, alpha: 0 })
  g.rect(13, 0, 1, 1).fill({ color: 0, alpha: 0 })
  return gen(renderer, g)
}

export function buildTextures(renderer: Renderer): TextureBank {
  const terrain = {} as Record<Terrain, Texture[]>
  for (const t of Object.keys(TERRAIN_STYLE) as Terrain[]) {
    terrain[t] = [0, 1, 2, 3].map((v) => terrainTile(renderer, t, t.length * 100 + v))
  }
  const props = {} as Record<PropKind, Texture[]>
  for (const k of Object.keys(PROPS) as PropKind[]) {
    props[k] = Array.from({ length: PROPS[k].variants }, (_, v) => propTexture(renderer, k, v))
  }
  const items = {} as Record<ItemId, Texture>
  for (const id of ITEM_IDS) items[id] = itemTexture(renderer, id)
  const robotTex = {} as Record<Facing, Texture[]>
  for (const f of ['down', 'up', 'left', 'right'] as Facing[]) {
    const src: Facing = f === 'left' ? 'right' : f
    robotTex[f] = [0, 1, 2].map((fr) => robot(renderer, src, fr))
  }
  const sg = new Graphics().ellipse(8, 4, 8, 4).fill({ color: 0x000000, alpha: 0.28 })
  const pg = new Graphics().rect(0, 0, 1, 1).fill(0xffffff)
  return { terrain, props, items, robot: robotTex, shadow: gen(renderer, sg), pixel: gen(renderer, pg) }
}
