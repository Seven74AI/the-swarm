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
  selectPrestigeRequirementCurrent,
  selectPrestigeRequirementMet,
  selectPrestigeTree,
  selectProjectedLegacyPoints,
} from '../../state/selectors';
import { PRESTIGE_REQUIREMENTS, type PrestigeRequirement } from '../../state/queries';
import { colonyLine } from '../../data/content/colonyLines';
import { formatFull } from '../../utils/format';
import { BUILDING_CARDS } from '../build/buildCatalog';
import { RESOURCES } from '../shell/resourceCatalog';
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
  const capHours = Math.floor(selectOfflineAwayLimitMs.value / HOUR_MS);
  return (
    <div id="prestige-panel" class="panel prestige-panel" data-panel="prestige_panel" data-tooltip={PRESTIGE_TIP}>
      <div>
        <div class="panel-title">✨ Legacy Prestige</div>
        <Stat label="🏆 Legacy Points" value={String(legacyPoints)} />
        <Stat label="🔄 Legacy" value={String(count)} />
        <button
          type="button"
          class="btn btn-tree"
          onClick={() => document.getElementById('prestige-tree-panel')?.scrollIntoView?.({ block: 'start' })}
        >
          🌳 Prestige Tree
        </button>
        {legacyPoints > 0 && <Stat label="⚡ Production Bonus" value={`+${legacyPoints * 2}%`} />}
        <Stat label="⏳ Offline Efficiency" value={`${percent(efficiency)}%`} />
        <Stat label="⌛ Offline Cap" value={`${capHours} h`} />
        <Stat class="projected" label="📊 Next Reset" value={available ? `+${selectProjectedLegacyPoints.value} LP` : '—'} />
      </div>
      <div class="prestige-confirm">
        <HoldToConfirm
          verb="PRESTIGE"
          onConfirm={() => actions.prestige()}
          settings={confirmSettings}
          disabled={available ? false : 'requirements not met'}
          class={available ? 'btn-prestige prestige-ready' : 'btn-prestige'}
          data-action="prestige"
        />
      </div>
      {!available && <PrestigeNeeds />}
    </div>
  );
}

/** The name a requirement goes by in its line: the building's card name, or the resource's. */
function requirementName(r: PrestigeRequirement): string {
  if (r.kind === 'building') return BUILDING_CARDS.find((b) => b.id === r.id)?.name ?? r.id;
  return RESOURCES.find((x) => x.id === r.id)?.name ?? r.id;
}

/** One unmet requirement, in the colony's voice; nothing once it is met. */
function RequirementLine({ requirement: r }: { requirement: PrestigeRequirement }) {
  const met = selectPrestigeRequirementMet(r.id).value;
  const current = selectPrestigeRequirementCurrent(r.id).value;
  if (met) return null;
  const line =
    r.kind === 'building'
      ? colonyLine('prestige_needs_building', { building: requirementName(r), level: current, target: r.target })
      : colonyLine('prestige_needs_produced', { resource: requirementName(r), current: formatFull(current), target: formatFull(r.target) });
  return (
    <li data-requirement={r.id} data-met="false">
      {line}
    </li>
  );
}

/**
 * What prestige still needs (Story 5.1, FR28): one line per unmet requirement,
 * in `PRESTIGE_REQUIREMENTS` order. Hooks: `[data-prestige-needs]`,
 * `[data-prestige-needs-lead]`, `li[data-requirement=<id>]`.
 */
function PrestigeNeeds() {
  return (
    <div class="prestige-needs" data-prestige-needs="">
      <p class="prestige-needs-lead" data-prestige-needs-lead="">
        {colonyLine('prestige_waits')}
      </p>
      <ul class="prestige-needs-list">
        {PRESTIGE_REQUIREMENTS.map((r) => (
          <RequirementLine key={r.id} requirement={r} />
        ))}
      </ul>
    </div>
  );
}

const TYPE_LABEL: Readonly<Record<PrestigeUpgrade['type'], string>> = {
  production: '📈 Production',
  unlock: '🔓 Unlock',
  offline: '⏳ Offline',
};

function UpgradeCard({ upgrade, actions }: { upgrade: PrestigeUpgrade; actions: Actions }) {
  const purchased = selectPrestigeTree.value.purchased.includes(upgrade.id);
  const points = selectPrestige.value.legacyPoints;
  const canPurchase = selectCanPurchasePrestigeUpgrade(upgrade.id).value;
  const short = !purchased && points < upgrade.cost;
  const state = purchased ? 'prestige-card-purchased' : short ? 'prestige-card-unaffordable' : 'prestige-card-available';
  return (
    <div class={`prestige-tree-card ${state}`}>
      <div class="prestige-tree-card-icon">{upgrade.icon}</div>
      <div class="prestige-tree-card-name">{upgrade.name}</div>
      <div class="prestige-tree-card-type">{TYPE_LABEL[upgrade.type]}</div>
      <div class="prestige-tree-card-desc">{upgrade.description}</div>
      <div class="prestige-tree-card-footer">
        {purchased ? (
          <span class="prestige-tree-purchased-badge">✅ Owned</span>
        ) : (
          <>
            <span class="prestige-tree-card-cost">{`🏆 ${upgrade.cost}`}</span>
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
      <div class="panel-title">🌳 Prestige Tree</div>
      <Stat class="prestige-tree-points" label="🏆 Available Points" value={String(selectPrestige.value.legacyPoints)} />
      <div class="prestige-tree-grid">
        {PRESTIGE_UPGRADES.map((u) => (
          <UpgradeCard key={u.id} upgrade={u} actions={actions} />
        ))}
      </div>
      {all && <div class="prestige-tree-complete">All upgrades owned.</div>}
    </div>
  );
}
