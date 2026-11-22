# 0044. Audio: one platform service, synthesized, gesture-gated, off by default

- **Status:** accepted (2026-11-21)
- **Source:** Story 8.8 (#316) · FR42 · AR12 · UX-DR37 · NFR11 · arch D9 · ADR 0007, 0031

## Context

The game had `ui/AudioSystem.ts`, a Web Audio synth that main called directly. Its mute was `false` until
Story 1.10 tied it to the sound setting. It made its `AudioContext` at the first play, which could come from a
tick rather than a tap. It had no hatch, decision or phase sound and no rate limits. The architecture puts
audio behind a platform service (D9, AR12), as it does haptics, so that a store build can replace it. Story
8.9 adds a feel to every important moment, and it builds on this service.

## Decision

- **`Audio`** (`src/platform/audio/index.ts`, `platform.audio`): `play(cue)`, `muted`, `available`.
  `createWebAudio({ env, enabled, now })` reads the sound setting at every call, like haptics. `noopAudio` is
  for tests and for anything without audio.
- **Cues** (`src/platform/audio/sounds.ts`): `key` (a tap: lay egg, a buy), `hatch`, `victory` / `defeat` /
  `draw` (the battle result), `phase`, `decision` (a two-tone chime), and `prestige` and `discovery` from the old
  synth. Each cue is a recipe of tones and noise bursts that `synth.ts` plays with oscillators and gain envelopes.
  All of it is **synthesized at play time**: no audio files to download, precache (ADR 0031) or license (NFR11).
- **Off by default**, and the setting stays **outside the save** (ADR 0007's settings store, which had `sound`
  since v1). So there is no save migration and no settings version bump.
- **No context before a user gesture.** The service listens on the window for `pointerdown` and `keydown`
  (capture, so the first tap's own cue can play) and for `click` and `keyup` (bubbling, so the tap that turns
  SOUND ON unlocks it). It makes the context at the first such gesture **while sound is on**, and resumes a
  suspended one. `play` before that does nothing.
- **Silent switch:** Web Audio only, never media elements. Where the browser has `navigator.audioSession`, the
  service sets it to `ambient`, which the device's silent switch mutes. Where the browser doesn't honour the
  switch, nothing more can be done from a web page; settings says so in a note.
- **Rate limits:** `SOUND_RATE_LIMITS` allows at most 1 `hatch` and 8 `key` in any 1 s (a sliding window). A
  dropped or muted play does not use up the limit.
- **Never throws, degrades to silence:** no `AudioContext` (or Safari's `webkitAudioContext`), a constructor that
  throws, a refused `resume()` or a refused node each give silence. `Capabilities.audio` says whether Web Audio
  exists, and the settings sound row says `THIS DEVICE CAN’T PLAY SOUND.` without it.
- **Wiring:** `bindSoundFeedback(bus, audio, {workers, larvae})` in `platform/feedback.ts`, bound by main
  beside the haptics. `SOUND_EVENTS` lists every event that plays a sound together with the UI hook that shows
  the same moment, because **audio is never the only channel**. The hatch plays when the larvae or worker count
  goes up. `spaceship_return` no longer plays a sound: its legacy panel has no visual for the return yet
  (Epic 6).
- **Boundary test** (`tests/arch/architecture.test.ts`): only platform/ names `AudioContext`,
  `webkitAudioContext` or `OfflineAudioContext`, and nothing in src/ uses media-element audio (`new Audio(`,
  `HTMLAudioElement`, `<audio>`).

## Consequences

- `ui/AudioSystem.ts` and its test are deleted. `bootstrap().audio` is `platform.audio`, so `__swarm.audio.muted`
  still works in E2E.
- Story 8.9 adds cues to `SOUNDS` and rows to `SOUND_EVENTS` (with the visual), and the feedback tests cover them.
  A new rate-limited cue goes in `SOUND_RATE_LIMITS`.
- `tests/e2e/sound.spec.ts` wraps `window.AudioContext` in an init script to count contexts and started sources.
  It shows that no context exists before a gesture or while sound is off.
- After a long return, the first live tick can raise the worker count by many at once. That plays one soft hatch
  at most, because of the rate limit.
