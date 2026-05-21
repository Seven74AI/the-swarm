import { effect } from '@preact/signals-core';
import { gameState } from '../../state/gameSignal';
import { Phase, PHASE_ORDER } from '../../phases/phases';
import { EGG_HATCH_TIME, LARVA_MATURE_TIME } from '../../systems/ResourceSystem';
import { getConversionDefs, getConversionRate } from '../../systems/ResourceConversionSystem';
import type { ConversionId } from '../../systems/ResourceConversionSystem';
import { formatNumber, formatRate } from '../../utils/format';
import { ProgressBar } from '../components/ProgressBar';

const TEND_MULTIPLIER = 0.25;

/** localStorage key for collapse/expand state */
const STORAGE_KEY = 'swarm_hud_sections';

/** Section IDs for localStorage persistence */
type SectionId = 'colony' | 'space' | 'prestige';

/**
 * Read collapse state from localStorage. Returns true if expanded.
 */
function loadSectionState(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<SectionId, boolean>;
  } catch { /* ignore corrupt data */ }
  return { colony: true, space: true, prestige: true };
}

/**
 * Save collapse state to localStorage.
 */
function saveSectionState(state: Record<SectionId, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Get the numerical index of a phase (0-based). Used for phase gating.
 */
function phaseIndex(phase: string): number {
  return PHASE_ORDER.indexOf(phase as Phase);
}

/**
 * Scannable Multi-Resource HUD.
 *
 * Layout:
 *   Top "critical" bar: 🥚 eggs  🐛 larvae  🍞 food  ⚔️ soldiers
 *   ▼ Colony Resources: workers, nest capacity, larvae count + progress bars
 *   ◆ Space Resources [Phase 4+]: void crystals, antimatter, dark matter
 *   ✦ Prestige [Phase 5+]: legacy points
 *
 * Sections are collapsible; state saved in localStorage.
 * Space section DOM doesn't exist before SPACE phase.
 * Prestige section DOM doesn't exist before TRANSCENDENCE phase.
 */
export class ResourcePanel {
  private container: HTMLDivElement;
  private criticalBar: HTMLDivElement;
  private sectionState: Record<SectionId, boolean>;

  // Critical bar outer spans (for appending)
  private eggItemEl: HTMLSpanElement;
  private larvaItemEl: HTMLSpanElement;
  private foodItemEl: HTMLSpanElement;
  private soldierItemEl: HTMLSpanElement;

  // Critical bar inner value spans (for updating)
  private eggValEl: HTMLSpanElement;
  private larvaValEl: HTMLSpanElement;
  private foodValEl: HTMLSpanElement;
  private soldierValEl: HTMLSpanElement;

  // Rate indicator spans (updated by effect)
  private eggRateEl: HTMLSpanElement;
  private larvaRateEl: HTMLSpanElement;
  private lastEggRateText: string = '';
  private lastLarvaRateText: string = '';

  // Colony section progress bars
  private nestCapacityBar!: ProgressBar;

  constructor() {
    this.sectionState = loadSectionState();

    this.container = document.createElement('div');
    this.container.className = 'panel resource-panel';

    // ── Critical Bar ──────────────────────────────────────────
    this.criticalBar = document.createElement('div');
    this.criticalBar.className = 'critical-bar';

    const eggPair = this.makeCriticalItem('🥚', 'resources.eggs');
    this.eggItemEl = eggPair.item;
    this.eggValEl = eggPair.value;
    const larvaPair = this.makeCriticalItem('🐛', 'resources.larvae');
    this.larvaItemEl = larvaPair.item;
    this.larvaValEl = larvaPair.value;
    const foodPair = this.makeCriticalItem('🍞', 'resources.food');
    this.foodItemEl = foodPair.item;
    this.foodValEl = foodPair.value;
    const soldierPair = this.makeCriticalItem('⚔️');
    this.soldierItemEl = soldierPair.item;
    this.soldierValEl = soldierPair.value;

    this.criticalBar.appendChild(this.eggItemEl);
    this.criticalBar.appendChild(document.createTextNode(' '));
    this.criticalBar.appendChild(this.larvaItemEl);
    this.criticalBar.appendChild(document.createTextNode(' '));
    this.criticalBar.appendChild(this.foodItemEl);
    this.criticalBar.appendChild(document.createTextNode(' '));
    this.criticalBar.appendChild(this.soldierItemEl);
    this.container.appendChild(this.criticalBar);

    // Rate indicators below critical bar
    const rateRow = document.createElement('div');
    rateRow.className = 'critical-rates';
    this.eggRateEl = this.makeRateEl();
    this.larvaRateEl = this.makeRateEl();
    rateRow.appendChild(this.eggRateEl);
    rateRow.appendChild(this.larvaRateEl);
    this.container.appendChild(rateRow);

    // ── Colony Resources Section ──────────────────────────────
    this.container.appendChild(
      this.buildSection('colony', 'Colony Resources', () => this.buildColonyBody()),
    );

    // ── Reactive updates ──────────────────────────────────────
    effect(() => {
      const s = gameState.value;
      const phaseIdx = phaseIndex(s.phase);

      // Update critical bar values (targeting inner .critical-value spans)
      this.eggValEl.textContent = formatNumber(s.resources.eggs);
      this.larvaValEl.textContent = formatNumber(s.resources.larvae);
      this.foodValEl.textContent = formatNumber(s.resources.food);
      this.soldierValEl.textContent = formatNumber(
        s.soldiers.scouts + s.soldiers.warriors,
      );

      // Update rate indicators with dirty-checking
      const ep = s.eggPipeline;
      const eggRate = ep.count > 0
        ? (ep.count / EGG_HATCH_TIME) * (1 + s.workersAssigned.tend * TEND_MULTIPLIER)
        : 0;
      const eggText = `→ ${formatRate(eggRate)}/s · ${formatRate(eggRate * 60)}/min`;
      if (eggText !== this.lastEggRateText) {
        this.eggRateEl.textContent = eggText;
        this.lastEggRateText = eggText;
      }

      const lp = s.larvaPipeline;
      const larvaRate = lp.count > 0 ? lp.count / LARVA_MATURE_TIME : 0;
      const larvaText = `→ ${formatRate(larvaRate)}/s · ${formatRate(larvaRate * 60)}/min`;
      if (larvaText !== this.lastLarvaRateText) {
        this.larvaRateEl.textContent = larvaText;
        this.lastLarvaRateText = larvaText;
      }

      // Update progress bar
      this.nestCapacityBar.update(s.resources.workers, s.resources.nestCapacity);

      // Phase-gated section management
      this.manageSpaceSection(phaseIdx);
      this.managePrestigeSection(phaseIdx);
    });
  }

  // ── Critical bar helpers ────────────────────────────────────────

  /**
   * Creates a critical item: icon + value span.
   * Returns both the outer container (for appending) and the inner value span (for updating).
   */
  private makeCriticalItem(icon: string, dataStat?: string): { item: HTMLSpanElement; value: HTMLSpanElement } {
    const span = document.createElement('span');
    span.className = 'critical-item';
    if (dataStat) span.setAttribute('data-stat', dataStat);
    span.appendChild(document.createTextNode(icon + '\u00A0'));
    const val = document.createElement('span');
    val.className = 'critical-value';
    span.appendChild(val);
    return { item: span, value: val };
  }

  private makeRateEl(): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = 'rate-indicator critical-rate';
    return el;
  }

  // ── Section builder ─────────────────────────────────────────────

  /**
   * Build a collapsible section.
   * @param id       Section identifier for localStorage.
   * @param title    Display title.
   * @param bodyFn   Factory that returns the body element (lazy for phase-gated sections).
   */
  private buildSection(
    id: SectionId,
    title: string,
    bodyFn: () => HTMLElement,
  ): HTMLDivElement {
    const section = document.createElement('div');
    section.className = `hud-section ${id}-section`;

    // Header with toggle
    const header = document.createElement('div');
    header.className = 'section-header';

    const toggle = document.createElement('span');
    toggle.className = 'section-toggle';
    const expanded = this.sectionState[id] !== false; // default true
    toggle.textContent = expanded ? '▼' : '▶';
    toggle.setAttribute('data-section', id);

    const label = document.createElement('span');
    label.className = 'section-title';
    label.textContent = title;

    header.appendChild(toggle);
    header.appendChild(label);
    section.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'section-body';
    if (!expanded) {
      body.style.display = 'none';
    }
    body.appendChild(bodyFn());
    section.appendChild(body);

    // Click handler
    toggle.addEventListener('click', () => {
      const isNowExpanded = body.style.display === 'none';
      body.style.display = isNowExpanded ? '' : 'none';
      toggle.textContent = isNowExpanded ? '▼' : '▶';

      // Persist
      this.sectionState[id] = isNowExpanded;
      saveSectionState(this.sectionState);
    });

    return section;
  }

  // ── Section bodies ─────────────────────────────────────────────

  private buildColonyBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'colony-body';

    // Workers
    const workerRow = document.createElement('div');
    workerRow.className = 'hud-resource-row';
    workerRow.setAttribute('data-stat', 'resources.workers');
    workerRow.innerHTML = '<span class="hud-resource-icon">🐜</span>' +
      '<span class="hud-resource-label">Workers</span>';
    const workerVal = document.createElement('span');
    workerVal.className = 'hud-resource-value';
    workerRow.appendChild(workerVal);
    body.appendChild(workerRow);

    // Effect to update workers
    effect(() => {
      workerVal.textContent = formatNumber(gameState.value.resources.workers);
    });

    // Nest capacity progress bar
    this.nestCapacityBar = new ProgressBar('Nest Capacity');
    const pbEl = this.nestCapacityBar.getElement();
    body.appendChild(pbEl);

    // Larvae count
    const larvaRow = document.createElement('div');
    larvaRow.className = 'hud-resource-row';
    larvaRow.innerHTML = '<span class="hud-resource-icon">🐛</span>' +
      '<span class="hud-resource-label">Larvae</span>';
    const larvaVal = document.createElement('span');
    larvaVal.className = 'hud-resource-value';
    larvaRow.appendChild(larvaVal);
    body.appendChild(larvaRow);

    effect(() => {
      larvaVal.textContent = formatNumber(gameState.value.resources.larvae);
    });

    return body;
  }

  private buildSpaceBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'space-body';

    const resources: Array<{ icon: string; label: string; path: 'voidCrystals' | 'antimatter' | 'darkMatter' }> = [
      { icon: '💎', label: 'Void Crystals', path: 'voidCrystals' },
      { icon: '⚛️', label: 'Antimatter', path: 'antimatter' },
      { icon: '🌑', label: 'Dark Matter', path: 'darkMatter' },
    ];

    for (const r of resources) {
      const row = document.createElement('div');
      row.className = 'hud-resource-row';
      row.innerHTML = `<span class="hud-resource-icon">${r.icon}</span>` +
        `<span class="hud-resource-label">${r.label}</span>`;
      const val = document.createElement('span');
      val.className = 'hud-resource-value';
      row.appendChild(val);
      body.appendChild(row);

      effect(() => {
        val.textContent = formatNumber(gameState.value.resources[r.path]);
      });
    }

    // Append conversion chains section
    body.appendChild(this.buildConversionsBody());

    return body;
  }

  private buildPrestigeBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'prestige-body';

    const row = document.createElement('div');
    row.className = 'hud-resource-row';
    row.innerHTML = '<span class="hud-resource-icon">✨</span>' +
      '<span class="hud-resource-label">Legacy Points</span>';
    const val = document.createElement('span');
    val.className = 'hud-resource-value';
    val.textContent = '0';
    row.appendChild(val);
    body.appendChild(row);

    return body;
  }

  /**
   * Build the resource conversion chains UI subsection.
   * Shows each chain's name, rate (per tick), and rate cap.
   */
  private buildConversionsBody(): HTMLDivElement {
    const body = document.createElement('div');
    body.className = 'conversions-body';

    const header = document.createElement('div');
    header.className = 'conversions-header';
    header.textContent = 'Conversions';
    body.appendChild(header);

    const defs = getConversionDefs();
    const icons: Record<ConversionId, string> = {
      voidCrystalSynthesis: '💎',
      antimatterContainment: '⚛️',
      darkMatterDetection: '🌑',
    };

    for (const def of defs) {
      const row = document.createElement('div');
      row.className = 'hud-resource-row conversion-row';
      row.innerHTML = `<span class="hud-resource-icon">${icons[def.id] || '🔄'}</span>` +
        `<span class="hud-resource-label">${def.name}</span>`;

      const info = document.createElement('span');
      info.className = 'conversion-info';
      row.appendChild(info);
      body.appendChild(row);

      // Reactive: update rate and cap display
      effect(() => {
        const s = gameState.value;
        const rate = getConversionRate(s, def.id);
        const cap = def.getRateCap(s);

        if (rate > 0) {
          info.textContent = `${rate}/tick (cap: ${cap})`;
          row.classList.remove('conversion-inactive');
        } else if (cap > 0) {
          // Has capacity but missing inputs
          info.textContent = `0/tick (cap: ${cap})`;
          row.classList.add('conversion-inactive');
        } else {
          info.textContent = 'locked';
          row.classList.add('conversion-inactive');
        }
      });
    }

    return body;
  }

  // ── Phase-gated section management ──────────────────────────────

  private manageSpaceSection(phaseIdx: number): void {
    const existing = this.container.querySelector('.hud-section.space-section');
    const shouldExist = phaseIdx >= phaseIndex(Phase.SPACE);

    if (shouldExist && !existing) {
      // Insert after colony section
      const colonySection = this.container.querySelector('.hud-section.colony-section');
      const spaceSection = this.buildSection('space', 'Space Resources', () => this.buildSpaceBody());
      if (colonySection?.nextSibling) {
        this.container.insertBefore(spaceSection, colonySection.nextSibling);
      } else {
        this.container.appendChild(spaceSection);
      }
    }
  }

  private managePrestigeSection(phaseIdx: number): void {
    const existing = this.container.querySelector('.hud-section.prestige-section');
    const shouldExist = phaseIdx >= phaseIndex(Phase.TRANSCENDENCE);

    if (shouldExist && !existing) {
      this.container.appendChild(
        this.buildSection('prestige', 'Prestige', () => this.buildPrestigeBody()),
      );
    }
  }

  // ── Public API ─────────────────────────────────────────────────

  getElement(): HTMLDivElement {
    return this.container;
  }
}
