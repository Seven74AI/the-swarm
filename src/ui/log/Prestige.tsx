import type { ReadonlySignal } from '@preact/signals-core';
import type { Actions } from '../../actions';
import { PRESTIGE_UPGRADES, type PrestigeUpgrade } from '../../data/prestigeTree';
import { HOUR_MS } from '../../data/constants';
import {
  selectCanPurchasePrestigeUpgrade,
  selectOfflineAwayLimitMs,
  selectOfflineEfficiency,
  selectPrestige,
  selectPrestigeAvailable,
  selectPrestigeShortfall,
  selectPrestigeTree,
  selectProjectedLegacyPoints,
} from '../../state/selectors';
import { HoldToConfirm, type ConfirmSettings } from '../primitives/HoldToConfirm';

/*
 * LOG → LEGACY's prestige card and Legacy tree (Story 1.36; Preact views
 * replacing the legacy PrestigePanel and PrestigeTreePanel, same markup and
 * hooks). LegacySection hosts them (Story 1.26). The visual redesign is
 * Epic 5's; the copy is unchanged.
 */

const PRESTIGE_TIP =
  'Legacy Prestige: Reset your colony to earn Legacy Points. Each Legacy Point gives +2% production. Buildings, phases, and food produced determine your legacy.';

function Stat({ label, value, class: className }: { label: string; value: string; class?: string }) {
  return (
    <div class={className ? `stat-row ${className}` : 'stat-row'}>
      <span class="stat-label">{label}</span>
      <span class="stat-value">{value}</span>
    </div>
  );
}

const percent = (efficiency: number): number => Math.round(efficiency * 100);

/** Hook: `#prestige-panel`; PRESTIGE is a HoldToConfirm (`.btn-prestige`, `data-action="prestige"`, Story 1.13). */
export function PrestigeCard({ actions, confirmSettings }: { actions: Actions; confirmSettings: ReadonlySignal<ConfirmSettings> }) {
  const { count, legacyPoints } = selectPrestige.value;
  const efficiency = selectOfflineEfficiency.value;
  const available = selectPrestigeAvailable.value;
  const shortfall = selectPrestigeShortfall.value;
  const capHours = Math.floor(selectOfflineAwayLimitMs.value / HOUR_MS);
  const tooltip = available
    ? undefined
    : `Prestige needs:\n${shortfall
        .split('\n')
        .map((u) => `  ✗ ${u}`)
        .join('\n')}`;
  return (
    <div id="prestige-panel" class="panel prestige-panel" data-panel="prestige_panel" data-tooltip={PRESTIGE_TIP}>
      <div>
        <div class="panel-title">Legacy Prestige</div>
        <Stat label="Legacy Points" value={String(legacyPoints)} />
        <Stat label="Prestige Count" value={String(count)} />
        <button
          type="button"
          class="btn btn-tree"
          onClick={() => document.getElementById('prestige-tree-panel')?.scrollIntoView?.({ block: 'start' })}
        >
          Prestige Tree
        </button>
        {legacyPoints > 0 && <Stat label="Production Bonus" value={`+${legacyPoints * 2}%`} />}
        <Stat label="Offline Efficiency" value={`${percent(efficiency)}%`} />
        <Stat label="Offline Cap" value={`${capHours} h`} />
        <Stat class="projected" label="Next Reset" value={available ? `+${selectProjectedLegacyPoints.value} LP` : '—'} />
      </div>
      <div class="prestige-confirm">
        <HoldToConfirm
          verb="PRESTIGE"
          onConfirm={() => actions.prestige()}
          settings={confirmSettings}
          disabled={available ? false : 'requirements not met'}
          class={available ? 'btn-prestige prestige-ready' : 'btn-prestige'}
          title={tooltip}
          data-action="prestige"
        />
      </div>
    </div>
  );
}

const TYPE_LABEL: Readonly<Record<PrestigeUpgrade['type'], string>> = {
  production: 'Production',
  unlock: 'Unlock',
  offline: 'Offline',
};

function UpgradeCard({ upgrade, actions }: { upgrade: PrestigeUpgrade; actions: Actions }) {
  const purchased = selectPrestigeTree.value.purchased.includes(upgrade.id);
  const points = selectPrestige.value.legacyPoints;
  const canPurchase = selectCanPurchasePrestigeUpgrade(upgrade.id).value;
  const short = !purchased && points < upgrade.cost;
  const state = purchased ? 'prestige-card-purchased' : short ? 'prestige-card-unaffordable' : 'prestige-card-available';
  return (
    <div class={`prestige-tree-card ${state}`}>
      <div class="prestige-tree-card-name">{upgrade.name}</div>
      <div class="prestige-tree-card-type">{TYPE_LABEL[upgrade.type]}</div>
      <div class="prestige-tree-card-desc">{upgrade.description}</div>
      <div class="prestige-tree-card-footer">
        {purchased ? (
          <span class="prestige-tree-purchased-badge">Owned</span>
        ) : (
          <>
            <span class="prestige-tree-card-cost">{`${upgrade.cost} LP`}</span>
            <button
              type="button"
              class="btn btn-sm btn-tree-purchase"
              disabled={!canPurchase}
              title={canPurchase ? undefined : short ? `Need ${upgrade.cost - points} more Legacy Points` : 'Already purchased'}
              onClick={() => actions.buyPrestigeUpgrade(upgrade.id)}
            >
              Purchase
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Hook: `#prestige-tree-panel`, one `.prestige-tree-card` per upgrade. */
export function PrestigeTree({ actions }: { actions: Actions }) {
  const all = selectPrestigeTree.value.purchased.length >= PRESTIGE_UPGRADES.length;
  return (
    <div id="prestige-tree-panel" class="panel prestige-tree-panel" data-panel="prestige_tree_panel">
      <div class="panel-title">Prestige Tree</div>
      <Stat class="prestige-tree-points" label="Available Points" value={String(selectPrestige.value.legacyPoints)} />
      <div class="prestige-tree-grid">
        {PRESTIGE_UPGRADES.map((u) => (
          <UpgradeCard key={u.id} upgrade={u} actions={actions} />
        ))}
      </div>
      {all && <div class="prestige-tree-complete">All upgrades owned.</div>}
    </div>
  );
}
