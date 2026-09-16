import { reactive } from 'vue'
import { ITEMS, type ItemId } from './items'

export interface Slot {
  item: ItemId
  count: number
}

export const BAG_CAPACITY = 24
export const HOTBAR_SIZE = 9

/** Reactive game state shared between the PixiJS world and the Vue HUD. */
export const state = reactive({
  ready: false,
  bag: [] as (Slot | null)[],
  selected: 0,
  icons: {} as Record<string, string>,
  px: 0,
  py: 0,
  /** 0..1, 0 = midnight, 0.5 = noon */
  time: 0.3,
  showBag: false,
  showHelp: true,
  message: '',
  messageUntil: 0,
  fps: 0,
})

for (let i = 0; i < BAG_CAPACITY; i++) state.bag.push(null)

export function say(msg: string, ms = 2200): void {
  state.message = msg
  state.messageUntil = performance.now() + ms
}

/** Add items to the bag. Returns the number that did not fit. */
export function addItem(item: ItemId, count = 1): number {
  const max = ITEMS[item].maxStack
  for (let i = 0; i < state.bag.length && count > 0; i++) {
    const s = state.bag[i]
    if (s && s.item === item && s.count < max) {
      const take = Math.min(max - s.count, count)
      s.count += take
      count -= take
    }
  }
  for (let i = 0; i < state.bag.length && count > 0; i++) {
    if (!state.bag[i]) {
      const take = Math.min(max, count)
      state.bag[i] = { item, count: take }
      count -= take
    }
  }
  return count
}

/** Remove one unit from the selected slot. Returns its item id or null. */
export function takeSelected(): ItemId | null {
  const s = state.bag[state.selected]
  if (!s) return null
  s.count -= 1
  const id = s.item
  if (s.count <= 0) state.bag[state.selected] = null
  return id
}

export function bagCount(): number {
  return state.bag.reduce((n, s) => n + (s ? s.count : 0), 0)
}
