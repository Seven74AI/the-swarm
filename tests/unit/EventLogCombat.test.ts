import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/engine/EventBus';
import { EventLog } from '../../src/ui/log/EventLog';

describe('EventLog — Combat Events', () => {
  let bus: EventBus;
  let log: EventLog;

  beforeEach(() => {
    bus = new EventBus();
    log = new EventLog(bus);
  });

  it('logs enemy_scouted event with enemy name', () => {
    bus.emit('enemy_scouted', { enemyType: 'red_ant', enemyName: 'Red Ant' });
    const el = { textContent: log.entries().map((e) => e.message).join('\n') };
    expect(el.textContent).toContain('SCOUTS SPOT A RED ANT');
  });

  it('logs battle_engage event with enemy type', () => {
    bus.emit('battle_engage', { enemyType: 'spider' });
    const el = { textContent: log.entries().map((e) => e.message).join('\n') };
    expect(el.textContent).toContain('SOLDIERS MARCH ON THE SPIDER');
  });

  it('logs battle_completed event with narrative', () => {
    bus.emit('battle_completed', {
      victory: true,
      outcome: 'victory',
      rounds: 3,
      cause: { kind: 'outnumbered', trait: 'thick_shell' },
      soldiersLost: 3,
      enemyType: 'beetle',
      foodGained: 45,
      specialLoot: { chitin: 2, silk: 0, venom: 0 },
        poisonDamageDealt: 0,
        narrative: '⚔️ 20 soldiers defeated a Beetle. 3 fell. +45 food. The colony salvages 2 chitin from the Beetle carcass.',
    });
    const el = { textContent: log.entries().map((e) => e.message).join('\n') };
    expect(el.textContent).toContain('20 soldiers defeated a Beetle');
  });

  it('logs defeat narrative from battle_completed', () => {
    bus.emit('battle_completed', {
      victory: false,
      outcome: 'defeat',
      rounds: 3,
      cause: { kind: 'outnumbered', trait: 'thick_shell' },
      soldiersLost: 10,
      enemyType: 'scorpion',
      foodGained: 0,
      specialLoot: { chitin: 0, silk: 0, venom: 0 },
        poisonDamageDealt: 0,
        narrative: '💀 10 soldiers were slaughtered by a Scorpion. None survived.',
    });
    const el = { textContent: log.entries().map((e) => e.message).join('\n') };
    expect(el.textContent).toContain('soldiers were slaughtered');
  });
});
