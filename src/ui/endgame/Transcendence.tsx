import { selectPrestige, selectVictoryAchieved } from '../../state/selectors';
import { formatFull } from '../../utils/format';

/**
 * The Transcendence status on NEST (Phase 6; Preact since Story 1.36,
 * replacing the legacy TranscendencePanel): whether the swarm has
 * transcended, and the legacy stats. Epic 7 builds the real ending. The
 * `transcendence_panel` panel (`#transcendence-panel`) holds it.
 */
export function Transcendence() {
  const victory = selectVictoryAchieved.value;
  const { count, legacyPoints, totalFoodProduced } = selectPrestige.value;
  const stats: ReadonlyArray<readonly [string, string]> = [
    ['Prestige Count', String(count)],
    ['Legacy Points', formatFull(legacyPoints)],
    ['Lifetime Food', formatFull(totalFoodProduced)],
  ];
  return (
    <>
      <h2 class="panel-title">
        <span aria-hidden="true">🌌 </span>Transcendence
      </h2>
      <div class="transcendence-status">
        <div class="transcendence-status-label">{victory ? 'THE SWARM TRANSCENDS.' : 'THE STARS ARE STILL OUT OF REACH.'}</div>
        <div class="transcendence-status-desc">
          {victory ? 'ALL BOUNDARIES DISSOLVE.' : 'Gather void crystals, antimatter and dark matter.'}
        </div>
      </div>
      <div class="transcendence-stats">
        <div class="transcendence-stats-title">Legacy Stats</div>
        {stats.map(([label, value]) => (
          <div class="stat-row" key={label}>
            <span class="stat-label">{label}</span>
            <span class="stat-value">{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}
