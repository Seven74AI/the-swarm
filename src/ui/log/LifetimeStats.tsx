import { selectBattlesWon, selectPrestige, selectStats } from '../../state/selectors';
import { formatFull, formatTime } from '../../utils/format';
import './log.css';

/**
 * LOG's lifetime stats (Story 1.26, UX-DR31): what the colony has done across
 * runs. Hooks: `[data-log-section="stats"]`, `[data-lifetime-stat=<id>]`
 * with its number in `[data-value]`.
 */
export function LifetimeStats() {
  const stats = selectStats.value;
  const prestige = selectPrestige.value;
  const rows: Array<[id: string, label: string, value: string]> = [
    ['eggs', 'EGGS LAID', formatFull(stats.totalEggsLaid)],
    ['taps', 'TAPS', formatFull(stats.totalClicks)],
    ['food', 'FOOD GATHERED', formatFull(prestige.totalFoodProduced)],
    ['battles', 'BATTLES WON', formatFull(selectBattlesWon.value)],
    ['prestiges', 'PRESTIGES', formatFull(prestige.count)],
    ['time', 'TIME PLAYED', formatTime(stats.playTimeMs).toUpperCase()],
  ];
  return (
    <section class="log-section" data-log-section="stats" aria-labelledby="log-stats-heading">
      <h2 class="log-heading" id="log-stats-heading">
        LIFETIME
      </h2>
      <dl class="log-stats">
        {rows.map(([id, label, value]) => (
          <div class="log-stat" key={id} data-lifetime-stat={id}>
            <dt>{label}</dt>
            <dd data-value="">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
