import { Application, Container, Graphics, Sprite, Text } from 'pixi.js'
import { buildTextures, type Facing, type TextureBank } from './textures'
import { World, type GroundItem } from './world'
import { Input } from './input'
import { state, addItem, takeSelected, say, HOTBAR_SIZE } from './state'
import { ITEMS, ITEM_IDS, type ItemId } from './items'
import { hashString } from './noise'
import { TILE } from './types'

interface Projectile {
  item: ItemId
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  spin: number
  bounces: number
  sprite: Sprite
  shadow: Sprite
}

interface Puff { sprite: Graphics; life: number }

const SPEED = 160          // px/s
const RUN_MULT = 1.7
const PLAYER_RADIUS = 9
const PICKUP_RADIUS = 22
const MAGNET_RADIUS = 48
const GRAVITY = 1000
const DAY_LENGTH = 360     // seconds per full day
const ZOOM = 2

export class Game {
  app = new Application()
  tex!: TextureBank
  world!: World
  input!: Input
  camera = new Container()
  overlay = new Graphics()
  player!: Sprite
  playerShadow!: Sprite
  px = 0
  py = 0
  facing: Facing = 'down'
  animT = 0
  moving = false
  projectiles: Projectile[] = []
  puffs: Puff[] = []
  frameCounter = 0
  labels = new Map<GroundItem, Text>()
  minimap: HTMLCanvasElement | null = null
  minimapT = 0
  private destroyed = false

  async init(host: HTMLElement, seedText: string): Promise<void> {
    await this.app.init({ resizeTo: host, background: 0xd8b98c, antialias: false, roundPixels: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true })
    if (this.destroyed) return
    host.appendChild(this.app.canvas)
    this.tex = buildTextures(this.app.renderer)
    this.world = new World(hashString(seedText), this.app.renderer, this.tex)
    this.input = new Input(host)

    this.camera.addChild(this.world.groundLayer, this.world.objectLayer)
    this.app.stage.addChild(this.camera, this.overlay)

    this.playerShadow = new Sprite(this.tex.shadow)
    this.playerShadow.anchor.set(0.5, 0.5)
    this.playerShadow.scale.set(1.4, 1)
    this.player = new Sprite(this.tex.robot.down[0])
    this.player.anchor.set(0.5, 1)
    this.world.objectLayer.addChild(this.playerShadow, this.player)

    // Find a walkable spawn near the origin.
    for (let r = 0; r < 60; r++) {
      const x = r * TILE, y = 0
      if (!this.world.isSolidTile(x, y)) { this.px = x + TILE / 2; this.py = y + TILE / 2; break }
    }
    this.world.update(this.px, this.py, 2)

    await this.exportIcons()
    if (this.destroyed) return
    addItem('rock', 5)
    state.ready = true
    say('You wake up in the Sonoran wild. Explore.')
    this.app.ticker.add((t) => this.tick(Math.min(t.deltaMS, 50) / 1000))
  }

  private async exportIcons(): Promise<void> {
    for (const id of ITEM_IDS) {
      const s = new Sprite(this.tex.items[id])
      s.scale.set(3)
      if (this.destroyed) return
      state.icons[id] = await this.app.renderer.extract.base64({ target: s, resolution: 1 })
      s.destroy()
    }
  }

  // ---------- Main loop ----------

  private tick(dt: number): void {
    if (this.destroyed) return
    const inp = this.input
    this.handleUI(inp)
    this.movePlayer(dt, inp)
    this.updateItems(dt)
    this.updateProjectiles(dt)
    this.updatePuffs(dt)
    this.handleThrow(inp)

    // Keep chunks streaming in around the player.
    if ((this.frameCounter++ & 7) === 0) this.world.update(this.px, this.py, 2)

    // Day/night
    state.time = (state.time + dt / DAY_LENGTH) % 1
    this.drawOverlay()

    // Camera follows player
    const w = this.app.screen.width, h = this.app.screen.height
    this.camera.scale.set(ZOOM)
    this.camera.position.set(Math.round(w / 2 - this.px * ZOOM), Math.round(h / 2 - this.py * ZOOM))

    if ((this.frameCounter & 3) === 0) {
      state.px = Math.round(this.px / TILE)
      state.py = Math.round(this.py / TILE)
      state.fps = Math.round(this.app.ticker.FPS)
    }
    if (state.message && performance.now() > state.messageUntil) state.message = ''
    this.minimapT += dt
    if (this.minimap && this.minimapT > 0.5) { this.minimapT = 0; this.drawMinimap() }
    inp.endFrame()
  }

  private handleUI(inp: Input): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) if (inp.justPressed(`Digit${i + 1}`)) state.selected = i
    const wheel = inp.takeWheel()
    if (wheel) state.selected = (state.selected + wheel + HOTBAR_SIZE) % HOTBAR_SIZE
    if (inp.justPressed('Tab') || inp.justPressed('KeyB')) state.showBag = !state.showBag
    if (inp.justPressed('KeyH') || inp.justPressed('F1')) state.showHelp = !state.showHelp
    if (inp.justPressed('Escape')) { state.showBag = false; state.showHelp = false }
  }

  private movePlayer(dt: number, inp: Input): void {
    let dx = 0, dy = 0
    if (inp.down('KeyW') || inp.down('ArrowUp')) dy -= 1
    if (inp.down('KeyS') || inp.down('ArrowDown')) dy += 1
    if (inp.down('KeyA') || inp.down('ArrowLeft')) dx -= 1
    if (inp.down('KeyD') || inp.down('ArrowRight')) dx += 1
    this.moving = dx !== 0 || dy !== 0
    if (this.moving) {
      const len = Math.hypot(dx, dy)
      dx /= len; dy /= len
      const speed = SPEED * (inp.down('ShiftLeft') || inp.down('ShiftRight') ? RUN_MULT : 1)
      // Sub-step so we never tunnel through a prop.
      const steps = 3
      for (let s = 0; s < steps; s++) {
        this.tryMove((dx * speed * dt) / steps, 0)
        this.tryMove(0, (dy * speed * dt) / steps)
      }
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left'
      else this.facing = dy > 0 ? 'down' : 'up'
      this.animT += dt * (inp.down('ShiftLeft') ? 14 : 9)
      if (Math.random() < dt * 6) this.puff(this.px + (Math.random() - 0.5) * 10, this.py)
    } else {
      this.animT = 0
    }
    const frame = this.moving ? 1 + (Math.floor(this.animT) % 2) : 0
    this.player.texture = this.tex.robot[this.facing][frame]!
    this.player.scale.x = this.facing === 'left' ? -1 : 1
    this.player.position.set(Math.round(this.px), Math.round(this.py))
    this.player.zIndex = this.py
    this.playerShadow.position.set(Math.round(this.px), Math.round(this.py) - 1)
    this.playerShadow.zIndex = this.py - 0.5
  }

  private tryMove(dx: number, dy: number): void {
    const nx = this.px + dx, ny = this.py + dy
    if (this.blocked(nx, ny)) return
    this.px = nx; this.py = ny
  }

  private blocked(x: number, y: number): boolean {
    // terrain: check a few points around the feet
    for (const [ox, oy] of [[-PLAYER_RADIUS, -4], [PLAYER_RADIUS, -4], [-PLAYER_RADIUS, 4], [PLAYER_RADIUS, 4]] as const) {
      if (this.world.isSolidTile(x + ox, y + oy)) return true
    }
    for (const p of this.world.nearbyProps(x, y)) {
      const r = p.radius + PLAYER_RADIUS
      const ddx = x - p.x, ddy = (y - p.y) * 1.6 // squash y for a pseudo-3D footprint
      if (ddx * ddx + ddy * ddy < r * r) return true
    }
    return false
  }

  // ---------- Items ----------

  private updateItems(dt: number): void {
    const t = performance.now() / 1000
    let nearest: GroundItem | null = null
    let nearestD = Infinity
    for (const gi of this.world.nearbyItems(this.px, this.py)) {
      const d = Math.hypot(gi.x - this.px, gi.y - this.py)
      // bob
      gi.sprite.y = gi.y - 2 - Math.sin(t * 3 + gi.phase) * 2
      gi.sprite.zIndex = gi.y
      if (d < MAGNET_RADIUS && d > 1) {
        const pull = (1 - d / MAGNET_RADIUS) * 260 * dt
        gi.x += ((this.px - gi.x) / d) * pull
        gi.y += ((this.py - gi.y) / d) * pull
        gi.sprite.x = gi.x; gi.shadow.position.set(gi.x, gi.y)
      }
      if (d < PICKUP_RADIUS) {
        const left = addItem(gi.item, 1)
        if (left === 0) {
          say(`Picked up ${ITEMS[gi.item].name}`)
          this.puff(gi.x, gi.y)
          this.world.removeItem(gi)
          continue
        } else if (Math.random() < 0.02) {
          say('Bag is full!')
        }
      }
      if (d < nearestD) { nearestD = d; nearest = gi }
    }
    // Label for the nearest item (within a short distance)
    for (const [gi, label] of this.labels) {
      if (gi !== nearest || nearestD > 90) { label.destroy(); this.labels.delete(gi) }
    }
    if (nearest && nearestD <= 90 && !this.labels.has(nearest)) {
      const label = new Text({ text: ITEMS[nearest.item].name, style: { fontFamily: 'monospace', fontSize: 11, fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } })
      label.anchor.set(0.5, 1)
      label.zIndex = 1e9
      this.world.objectLayer.addChild(label)
      this.labels.set(nearest, label)
    }
    for (const [gi, label] of this.labels) label.position.set(Math.round(gi.x), Math.round(gi.sprite.y) - 18)
  }

  // ---------- Throwing ----------

  private handleThrow(inp: Input): void {
    const clicks = inp.takeClicks()
    let target: { x: number; y: number } | null = null
    if (clicks.length) {
      const c = clicks[0]!
      target = { x: (c.x - this.camera.x) / ZOOM, y: (c.y - this.camera.y) / ZOOM }
    } else if (inp.justPressed('Space')) {
      const dir = this.facing === 'left' ? [-1, 0] : this.facing === 'right' ? [1, 0] : this.facing === 'up' ? [0, -1] : [0, 1]
      target = { x: this.px + dir[0]! * 160, y: this.py + dir[1]! * 160 }
    }
    if (!target) return
    const item = takeSelected()
    if (!item) { say('Nothing in that slot to throw.'); return }
    const dx = target.x - this.px, dy = target.y - (this.py - 12)
    const dist = Math.min(Math.hypot(dx, dy), 420 / Math.max(0.6, ITEMS[item].mass))
    const ang = Math.atan2(dy, dx)
    const flight = Math.max(0.35, Math.min(1.0, dist / 320))
    const sprite = new Sprite(this.tex.items[item])
    sprite.anchor.set(0.5, 0.5)
    sprite.zIndex = 1e8
    const shadow = new Sprite(this.tex.shadow)
    shadow.anchor.set(0.5, 0.5)
    shadow.scale.set(0.8)
    this.world.objectLayer.addChild(shadow, sprite)
    this.projectiles.push({
      item, x: this.px, y: this.py, z: 22,
      vx: (Math.cos(ang) * dist) / flight, vy: (Math.sin(ang) * dist) / flight,
      vz: (GRAVITY * flight) / 2 - 22 / flight,
      spin: (Math.random() - 0.5) * 20, bounces: 0, sprite, shadow,
    })
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left'
    else this.facing = dy > 0 ? 'down' : 'up'
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt
      // Bounce off solid props when flying low.
      let hit = false
      if (p.z < 40) {
        for (const pr of this.world.nearbyProps(nx, ny)) {
          const ddx = nx - pr.x, ddy = (ny - pr.y) * 1.6
          if (ddx * ddx + ddy * ddy < (pr.radius + 4) ** 2) { hit = true; this.onHitProp(p, pr.kind, pr.x, pr.y); break }
        }
      }
      if (hit) {
        p.vx *= -0.3; p.vy *= -0.3; p.vz = Math.min(p.vz, 60)
      } else if (this.world.isSolidTile(nx, ny) && this.world.terrainAt(Math.floor(nx / TILE), Math.floor(ny / TILE)) === 'cliff' && p.z < 30) {
        p.vx *= -0.3; p.vy *= -0.3
      } else {
        p.x = nx; p.y = ny
      }
      p.vz -= GRAVITY * dt
      p.z += p.vz * dt
      p.sprite.rotation += p.spin * dt
      if (p.z <= 0) {
        p.z = 0
        if (p.vz < -140 && p.bounces < 2 && ITEMS[p.item].mass > 0.2) {
          p.vz = -p.vz * 0.4; p.vx *= 0.6; p.vy *= 0.6; p.bounces++
          this.puff(p.x, p.y)
        } else {
          this.land(p, i)
          continue
        }
      }
      p.sprite.position.set(p.x, p.y - p.z)
      p.shadow.position.set(p.x, p.y)
      p.shadow.alpha = Math.max(0.15, 1 - p.z / 120)
      p.shadow.zIndex = p.y - 0.5
    }
  }

  private onHitProp(p: Projectile, kind: string, x: number, y: number): void {
    this.puff(p.x, p.y - p.z)
    if ((kind === 'saguaro' || kind === 'saguaro2') && Math.random() < 0.5) {
      this.world.dropItem('fruit', x + (Math.random() - 0.5) * 30, y + 8 + Math.random() * 10)
      say('A saguaro fruit fell!')
    } else if (kind === 'prickly' && Math.random() < 0.5) {
      this.world.dropItem('pad', x + (Math.random() - 0.5) * 30, y + 8 + Math.random() * 10)
      say('A cactus pad broke off.')
    } else if (kind === 'mesquite' && Math.random() < 0.6) {
      this.world.dropItem('seed', x + (Math.random() - 0.5) * 36, y + 10 + Math.random() * 10)
    } else if (kind === 'boulder' && p.item === 'rock' && Math.random() < 0.15) {
      this.world.dropItem('quartz', x + (Math.random() - 0.5) * 30, y + 6)
      say('A chip of quartz!')
    }
  }

  private land(p: Projectile, idx: number): void {
    this.projectiles.splice(idx, 1)
    p.sprite.destroy(); p.shadow.destroy()
    if (this.world.isSolidTile(p.x, p.y) && this.world.terrainAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) === 'water') {
      say(`The ${ITEMS[p.item].name} sank.`)
      this.splash(p.x, p.y)
      return
    }
    if (p.item === 'bottle' && p.bounces === 0 && Math.random() < 0.4) {
      say('The bottle shattered.')
      this.puff(p.x, p.y); this.puff(p.x + 4, p.y); this.puff(p.x - 4, p.y)
      return
    }
    this.world.dropItem(p.item, p.x, p.y)
    this.puff(p.x, p.y)
  }

  // ---------- Effects ----------

  private puff(x: number, y: number): void {
    const g = new Graphics().circle(0, 0, 3).fill({ color: 0xe8d8b8, alpha: 0.7 })
    g.position.set(x, y); g.zIndex = y + 1
    this.world.objectLayer.addChild(g)
    this.puffs.push({ sprite: g, life: 0.4 })
  }
  private splash(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const g = new Graphics().circle(0, 0, 2).fill({ color: 0xbfe6f0, alpha: 0.9 })
      g.position.set(x + (Math.random() - 0.5) * 16, y - Math.random() * 10); g.zIndex = y + 1
      this.world.objectLayer.addChild(g)
      this.puffs.push({ sprite: g, life: 0.5 })
    }
  }
  private updatePuffs(dt: number): void {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!
      p.life -= dt
      p.sprite.alpha = Math.max(0, p.life * 2)
      p.sprite.scale.set(1 + (0.4 - p.life) * 3)
      p.sprite.y -= dt * 20
      if (p.life <= 0) { p.sprite.destroy(); this.puffs.splice(i, 1) }
    }
  }

  private drawOverlay(): void {
    const t = state.time
    // Daylight curve: 0 at midnight, 1 at noon.
    const light = Math.max(0, Math.min(1, (Math.cos((t - 0.5) * Math.PI * 2) + 0.3) / 1.3))
    const dusk = Math.exp(-((t - 0.78) ** 2) / 0.004) + Math.exp(-((t - 0.24) ** 2) / 0.004)
    const w = this.app.screen.width, h = this.app.screen.height
    this.overlay.clear()
    this.overlay.rect(0, 0, w, h).fill({ color: 0x0b1030, alpha: (1 - light) * 0.62 })
    if (dusk > 0.05) this.overlay.rect(0, 0, w, h).fill({ color: 0xff6a2a, alpha: dusk * 0.18 })
    if (light > 0.9) this.overlay.rect(0, 0, w, h).fill({ color: 0xfff2c8, alpha: (light - 0.9) * 0.6 })
  }

  private drawMinimap(): void {
    const c = this.minimap!
    const ctx = c.getContext('2d')!
    const size = c.width
    const scale = 2 // tiles per pixel
    const img = ctx.createImageData(size, size)
    const cx = Math.floor(this.px / TILE), cy = Math.floor(this.py / TILE)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const col = this.world.minimapColor(cx + (x - size / 2) * scale, cy + (y - size / 2) * scale)
        const i = (y * size + x) * 4
        img.data[i] = (col >> 16) & 255; img.data[i + 1] = (col >> 8) & 255; img.data[i + 2] = col & 255; img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.fillStyle = '#ff3b3b'
    ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4)
  }

  destroy(): void {
    this.destroyed = true
    this.input?.destroy()
    this.app.destroy(true, { children: true, texture: true })
  }
}
