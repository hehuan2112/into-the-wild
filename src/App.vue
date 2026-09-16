<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Game } from './game/game'
import { state } from './game/state'
import { startAmbient, resumeAmbient, stopAmbient } from './audio/ambient'
import Hud from './components/Hud.vue'

const host = ref<HTMLDivElement | null>(null)
let game: Game | null = null

onMounted(async () => {
  game = new Game()
  const seed = new URLSearchParams(location.search).get('seed') ?? 'phoenix'
  await game.init(host.value!, seed)
  game.minimap = document.getElementById('minimap') as HTMLCanvasElement | null

  startAmbient()
  const resumeOnce = () => {
    resumeAmbient()
    window.removeEventListener('pointerdown', resumeOnce)
    window.removeEventListener('keydown', resumeOnce)
  }
  window.addEventListener('pointerdown', resumeOnce)
  window.addEventListener('keydown', resumeOnce)
})

onBeforeUnmount(() => { game?.destroy(); stopAmbient() })
</script>

<template>
  <div class="root">
    <div ref="host" class="canvas-host"></div>
    <Hud v-if="state.ready" />
    <div v-else class="loading">Generating the desert…</div>
  </div>
</template>

<style scoped>
.root { position: fixed; inset: 0; overflow: hidden; background: #d8b98c; }
.canvas-host { position: absolute; inset: 0; }
.loading { position: absolute; inset: 0; display: grid; place-items: center; font-family: ui-monospace, monospace; color: #5a4a30; }
</style>
