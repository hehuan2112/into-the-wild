<script setup lang="ts">
import { state, bagCount, BAG_CAPACITY } from '../game/state'
import { ITEMS } from '../game/items'
import { computed, ref } from 'vue'

const hover = ref<number | null>(null)
const hovered = computed(() => (hover.value !== null ? state.bag[hover.value] : null))

function swap(i: number) {
  // Click a slot to swap it with the selected hotbar slot.
  const a = state.bag[i], b = state.bag[state.selected]
  state.bag[i] = b ?? null
  state.bag[state.selected] = a ?? null
}
</script>

<template>
  <div class="bag">
    <div class="head">
      <strong>Bag</strong>
      <span>{{ bagCount() }} items · {{ state.bag.filter(Boolean).length }}/{{ BAG_CAPACITY }} slots</span>
      <button @click="state.showBag = false">✕</button>
    </div>
    <div class="grid">
      <div
        v-for="(s, i) in state.bag"
        :key="i"
        class="slot"
        :class="{ hot: i < 9, active: i === state.selected }"
        @mouseenter="hover = i"
        @mouseleave="hover = null"
        @click="swap(i)"
      >
        <template v-if="s">
          <img :src="state.icons[s.item]" />
          <span class="count">{{ s.count }}</span>
        </template>
      </div>
    </div>
    <div class="desc">
      <template v-if="hovered">
        <strong>{{ ITEMS[hovered.item].name }}</strong> — {{ ITEMS[hovered.item].desc }}
      </template>
      <template v-else>Click a slot to move it into the selected hotbar slot. Slots 1–9 are your hotbar.</template>
    </div>
  </div>
</template>

<style scoped>
.bag { pointer-events: auto; width: 360px; background: rgba(20, 16, 10, 0.88); border: 2px solid #7a6a48; border-radius: 10px; padding: 10px; color: #e8dcc0; font-family: ui-monospace, monospace; }
.head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; }
.head span { flex: 1; color: #b8a880; }
.head button { background: none; border: 1px solid #7a6a48; color: #e8dcc0; border-radius: 4px; cursor: pointer; }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.slot { position: relative; aspect-ratio: 1; background: rgba(60, 48, 30, 0.7); border: 2px solid #5a4a30; border-radius: 6px; display: grid; place-items: center; cursor: pointer; }
.slot.hot { border-color: #7a6a48; }
.slot.active { border-color: #f2d448; }
.slot img { width: 36px; height: 36px; image-rendering: pixelated; }
.count { position: absolute; bottom: 1px; right: 4px; font-size: 12px; color: #fff; text-shadow: 0 0 3px #000; }
.desc { margin-top: 8px; font-size: 12px; min-height: 2.6em; color: #cfc2a0; }
</style>
