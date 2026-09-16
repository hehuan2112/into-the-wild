import { state } from '../game/state'

/**
 * Procedural desert ambience: filtered wind noise + a slow drone chord.
 * Both sources sit near silent almost all the time and only swell in for a
 * few seconds every so often, like an occasional gust or distant hum — not a
 * continuous soundtrack. No audio files, so it stays tiny and loops forever.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let timers: number[] = []

function whiteNoiseBuffer(ctx: AudioContext, seconds = 4): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** Filtered noise source, routed through its own gain node the gust scheduler controls. */
function makeWindVoice(ctx: AudioContext, dest: AudioNode): GainNode {
  const noise = ctx.createBufferSource()
  noise.buffer = whiteNoiseBuffer(ctx)
  noise.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 500
  filter.Q.value = 0.6

  // LFO drifts the cutoff so an active gust swells and fades instead of sitting static.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.09
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 220
  lfo.connect(lfoGain).connect(filter.frequency)

  const gain = ctx.createGain()
  gain.gain.value = 0

  noise.connect(filter).connect(gain).connect(dest)
  noise.start()
  lfo.start()
  return gain
}

/** A soft three-note drone chord, routed through one shared gain node the scheduler controls. */
function makeDroneVoice(ctx: AudioContext, dest: AudioNode): GainNode {
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(dest)

  for (const [freq, wobbleRate, level] of [
    [110, 0.03, 1],
    [164.81, 0.022, 0.7],
    [220, 0.026, 0.55],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const lfo = ctx.createOscillator()
    lfo.frequency.value = wobbleRate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 3
    lfo.connect(lfoGain).connect(osc.detune)

    const voiceGain = ctx.createGain()
    voiceGain.gain.value = level * 0.3

    osc.connect(voiceGain).connect(gain)
    osc.start()
    lfo.start()
  }
  return gain
}

interface GustOptions {
  minGapS: number
  maxGapS: number
  minPeak: number
  maxPeak: number
  attackS: number
  holdS: number
  releaseS: number
}

/** Repeatedly, after a random silent gap, fades a gain node up then back down to ~silence. */
function scheduleGusts(gain: GainNode, opts: GustOptions): void {
  const fire = (): void => {
    if (!ctx) return
    const now = ctx.currentTime
    const peak = opts.minPeak + Math.random() * (opts.maxPeak - opts.minPeak)
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak, now + opts.attackS)
    gain.gain.setTargetAtTime(0, now + opts.attackS + opts.holdS, opts.releaseS / 3)
    scheduleNext()
  }
  const scheduleNext = (): void => {
    const gap = opts.minGapS + Math.random() * (opts.maxGapS - opts.minGapS)
    timers.push(window.setTimeout(fire, gap * 1000))
  }
  scheduleNext()
}

/** Builds and starts the ambience graph. Safe to call once; sound is silent until the AudioContext resumes on a user gesture. */
export function startAmbient(): void {
  if (ctx) return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = state.muted ? 0 : state.volume
  master.connect(ctx.destination)

  const windGain = makeWindVoice(ctx, master)
  scheduleGusts(windGain, { minGapS: 12, maxGapS: 35, minPeak: 0.5, maxPeak: 0.9, attackS: 2.5, holdS: 3, releaseS: 5 })

  const droneGain = makeDroneVoice(ctx, master)
  scheduleGusts(droneGain, { minGapS: 45, maxGapS: 100, minPeak: 0.4, maxPeak: 0.7, attackS: 6, holdS: 6, releaseS: 9 })
}

/** Most browsers create AudioContext suspended until a user gesture; call this from a click/keydown handler. */
export function resumeAmbient(): void {
  ctx?.resume()
}

export function setAmbientVolume(v: number): void {
  state.volume = v
  if (ctx && master && !state.muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.3)
}

export function toggleAmbientMute(): void {
  state.muted = !state.muted
  if (ctx && master) master.gain.setTargetAtTime(state.muted ? 0 : state.volume, ctx.currentTime, 0.3)
}

export function stopAmbient(): void {
  for (const id of timers) window.clearTimeout(id)
  timers = []
  ctx?.close()
  ctx = null
  master = null
}
