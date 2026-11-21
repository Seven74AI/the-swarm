/**
 * Platform feedback wiring (Story 1.10).
 *
 * Listeners only: they play feedback and never write game state (AR18).
 * main binds them once at boot.
 */
import { effect, type ReadonlySignal } from '@preact/signals-core';
import type { EventBus } from '../engine/EventBus';
import type { HapticPattern, Haptics } from './haptics';
import type { Settings } from './settings';

/** Play the juice-table patterns (EXPERIENCE.md, Game Feel & Juice). Returns an unbind. */
export function bindHapticFeedback(bus: EventBus, haptics: Haptics): () => void {
  const play = (pattern: HapticPattern) => () => haptics.play(pattern);
  const onEgg = play('light');
  const onDecision = play('light');
  const onPhase = play('heavy');
  const onBattle = ({ victory }: { victory: boolean }) => haptics.play(victory ? 'medium' : 'double');
  bus.subscribe('egg_clicked', onEgg);
  bus.subscribe('decision_event', onDecision);
  bus.subscribe('battle_completed', onBattle);
  bus.subscribe('phase_committed', onPhase);
  return () => {
    bus.unsubscribe('egg_clicked', onEgg);
    bus.unsubscribe('decision_event', onDecision);
    bus.unsubscribe('battle_completed', onBattle);
    bus.unsubscribe('phase_committed', onPhase);
  };
}

/** Keep `audio.muted` in step with the sound setting (off by default). Returns an unbind. */
export function bindSoundSetting(audio: { muted: boolean }, settings: ReadonlySignal<Settings>): () => void {
  return effect(() => {
    audio.muted = !settings.value.sound;
  });
}
