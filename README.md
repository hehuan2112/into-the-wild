# Into the Wild

A 2D top-down exploration game set in a borderless Sonoran Desert, inspired by the wild land around Phoenix, Arizona.
You are a small robot with a big bag. Walk anywhere, pick up whatever you find, and throw it.

Pure frontend: TypeScript, Vue 3 + Vite for the UI layer, PixiJS 8 for the game scene.
All art is generated procedurally at runtime with Pixi Graphics, so there are no external assets.

## Play

```bash
bun install
bun dev
```

Open the printed URL. Add `?seed=anything` to the URL to generate a different world.

| Key | Action |
| --- | --- |
| WASD / arrows | Move in any direction |
| Shift | Run |
| Walk over an item | Pick it up (nearby items are pulled toward you) |
| Left click | Throw the selected item toward the cursor |
| Space | Throw the selected item in the facing direction |
| 1–9 / mouse wheel | Select a hotbar slot |
| Tab / B | Open the bag |
| H | Toggle help |

## World

- Infinite chunked world (16×16 tiles of 32px per chunk). Chunks stream in around the player and are regenerated deterministically from the seed, so the world has no borders.
- Terrain from layered simplex noise: sand flats, caliche, gravel washes, scrubland, rocky bajadas, cliffs, and rare ponds.
- Sonoran flora and props: saguaros (with and without arms), cholla, prickly pear, barrel cactus, ocotillo, palo verde, mesquite, creosote, brittlebush, boulders, dead trees, and the odd skull.
- A day/night cycle with dawn and dusk tints.
- Items scattered by biome: rocks, quartz, scrap metal, bottles, cans, bones, hawk feathers, saguaro fruit, mesquite pods, batteries, cactus pads, tortoise shells.
- Throwing has an arc, bounces, and interacts with the world: hit a saguaro to knock fruit loose, a prickly pear to break off a pad, a mesquite for pods, or chip quartz from a boulder. Bottles may shatter, and anything thrown into water sinks.
- Player changes (picked-up or dropped items) persist per chunk while the page is open.

## Project layout

```
src/
  App.vue              mounts the Pixi canvas and the HUD
  components/          Vue HUD: Hotbar, BagPanel, Hud (coords, clock, minimap, help)
  game/
    game.ts            main loop: input, movement, collisions, pickup, throwing, effects, day/night
    world.ts           chunk streaming, terrain sampling, prop/item placement, persistence deltas
    textures.ts        all procedural art (tiles, props, items, robot)
    noise.ts           seeded PRNG, coordinate hash, 2D simplex noise + fbm
    items.ts           item definitions
    state.ts           reactive state shared between Pixi and Vue (bag, selection, messages)
    input.ts           keyboard / pointer / wheel input
    types.ts           constants and prop definitions
```

## Build

```bash
bun run build
```
