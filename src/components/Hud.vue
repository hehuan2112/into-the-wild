<script setup lang="ts">
import { computed } from 'vue'
import { state } from '../game/state'
import Hotbar from './Hotbar.vue'
import BagPanel from './BagPanel.vue'

const clock = computed(() => {
  const h = Math.floor(state.time * 24)
  const m = Math.floor((state.time * 24 - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})
</script>

<template>
  <div class="hud">
    <div class="topleft">
      <div class="panel">
        <div>📍 {{ state.px }}, {{ state.py }}</div>
        <div>🕒 {{ clock }}</div>
        <div class="dim">{{ state.fps }} fps</div>
      </div>
    </div>
    <div class="topright">
      <canvas id="minimap" width="96" height="96"></canvas>
    </div>
    <transition name="fade">
      <div v-if="state.message" class="message">{{ state.message }}</div>
    </transition>
    <div v-if="state.showBag" class="center"><BagPanel /></div>
    <div v-if="state.showHelp" class="help">
      <strong>Into the Wild</strong>
      <div>WASD / arrows — move · Shift — run</div>
      <div>Walk over items to pick them up</div>
      <div>Click — throw selected item at cursor · Space — throw forward</div>
      <div>1–9 / wheel — select item · Tab / B — open bag</div>
      <div>H — toggle this help</div>
    </div>
    <div class="bottom"><Hotbar /></div>
  </div>
</template>

<style scoped>
.hud { position: absolute; inset: 0; pointer-events: none; font-family: ui-monospace, Menlo, monospace; color: #f4ead2; }
.panel { margin: 12px; padding: 8px 12px; background: rgba(20, 16, 10, 0.55); border: 2px solid #5a4a30; border-radius: 8px; font-size: 13px; line-height: 1.5; }
.dim { color: #b8a880; font-size: 11px; }
.topleft { position: absolute; top: 0; left: 0; }
.topright { position: absolute; top: 12px; right: 12px; }
#minimap { width: 144px; height: 144px; image-rendering: pixelated; border: 2px solid #5a4a30; border-radius: 8px; background: #000; }
.bottom { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); }
.center { position: absolute; inset: 0; display: grid; place-items: center; }
.message { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); padding: 6px 14px; background: rgba(20, 16, 10, 0.7); border-radius: 6px; font-size: 14px; }
.help { position: absolute; bottom: 90px; left: 12px; padding: 10px 14px; background: rgba(20, 16, 10, 0.6); border: 2px solid #5a4a30; border-radius: 8px; font-size: 12px; line-height: 1.6; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
