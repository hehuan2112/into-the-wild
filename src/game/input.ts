export class Input {
  keys = new Set<string>()
  mouseX = 0
  mouseY = 0
  private clicks: { x: number; y: number; button: number }[] = []
  private wheel = 0
  private pressed = new Set<string>()

  private el: HTMLElement

  constructor(el: HTMLElement) {
    this.el = el
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('wheel', this.onWheel, { passive: true })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('blur', () => this.keys.clear())
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (!e.repeat) this.pressed.add(e.code)
    this.keys.add(e.code)
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
  }
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code) }
  private onMove = (e: PointerEvent) => { this.mouseX = e.clientX; this.mouseY = e.clientY }
  private onDown = (e: PointerEvent) => { this.mouseX = e.clientX; this.mouseY = e.clientY; this.clicks.push({ x: e.clientX, y: e.clientY, button: e.button }) }
  private onWheel = (e: WheelEvent) => { this.wheel += Math.sign(e.deltaY) }

  down(code: string): boolean { return this.keys.has(code) }
  /** True only on the frame the key was first pressed. */
  justPressed(code: string): boolean { return this.pressed.has(code) }
  takeClicks(): { x: number; y: number; button: number }[] { const c = this.clicks; this.clicks = []; return c }
  takeWheel(): number { const w = this.wheel; this.wheel = 0; return w }
  /** Call at the end of every frame. */
  endFrame(): void { this.pressed.clear() }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.el.removeEventListener('pointermove', this.onMove)
    this.el.removeEventListener('pointerdown', this.onDown)
    this.el.removeEventListener('wheel', this.onWheel)
  }
}
