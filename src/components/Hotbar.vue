<script setup lang="ts">
import { state, HOTBAR_SIZE } from '../game/state'
import { ITEMS } from '../game/items'
</script>

<template>
  <div class="hotbar">
    <div
      v-for="i in HOTBAR_SIZE"
      :key="i"
      class="slot"
      :class="{ active: state.selected === i - 1 }"
      @click="state.selected = i - 1"
    >
      <span class="num">{{ i }}</span>
      <template v-if="state.bag[i - 1]">
        <img :src="state.icons[state.bag[i - 1]!.item]" :title="ITEMS[state.bag[i - 1]!.item].name" />
        <span class="count">{{ state.bag[i - 1]!.count }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hotbar { display: flex; gap: 6px; padding: 6px; background: rgba(20, 16, 10, 0.55); border: 2px solid #5a4a30; border-radius: 8px; pointer-events: auto; }
.slot { position: relative; width: 48px; height: 48px; background: rgba(60, 48, 30, 0.7); border: 2px solid #7a6a48; border-radius: 6px; display: grid; place-items: center; cursor: pointer; }
.slot.active { border-color: #f2d448; box-shadow: 0 0 0 2px rgba(242, 212, 72, 0.4); }
.slot img { width: 36px; height: 36px; image-rendering: pixelated; }
.num { position: absolute; top: 1px; left: 4px; font-size: 10px; color: #c9b98a; }
.count { position: absolute; bottom: 1px; right: 4px; font-size: 12px; color: #fff; text-shadow: 0 0 3px #000; }
</style>
