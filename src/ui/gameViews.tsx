import type { ReadonlySignal } from '@preact/signals-core';
import type { Actions } from '../actions';
import type { EventBus } from '../engine/EventBus';
import type { SegmentId } from '../data/content/tabs';
import type { GameState } from '../state/GameState';
import type { Chronicle } from '../state/chronicle';
import { selectPhase } from '../state/selectors';
import type { Phase } from '../phases/phases';
import type { LayMode } from '../platform/settings';
import type { ShellViews } from './shell/Shell';
import type { SheetController } from './shell/SheetController';
import type { ResourceFeed } from './shell/resourceFeed';
import { Panel } from './shell/Panel';
import { TopBar } from './shell/TopBar';
import { ResourceStrip } from './shell/ResourceStrip';
import { SaveFailedMarker } from './shell/SaveFailedMarker';
import { PhaseLine, phaseClass } from './shell/GoalMeter';
import type { ConfirmSettings } from './primitives/HoldToConfirm';
import { NestPrimary } from './nest/NestPrimary';
import { NestScene } from './nest/NestScene';
import { ClickPowerCard } from './nest/ClickPowerCard';
import { EventLines } from './nest/EventLines';
import { Transcendence } from './endgame/Transcendence';
import { WorkersPrimary, WorkersTab } from './wrkr/WorkersTab';
import { FoodStock } from './wrkr/FoodStock';
import { AutomationSection } from './wrkr/AutomationSection';
import { BuildHeader } from './build/BuildHeader';
import { BuildingCards } from './build/BuildingCards';
import { ResearchCards } from './build/ResearchCards';
import { ConverterCard } from './build/ConverterCard';
import { BuildPrimary } from './build/BuildPrimary';
import { CombatLog, EnemyCard, MutationsSection, SoldiersSection, WarPrimary } from './war/WarSegment';
import type { WarSession } from './war/warSession';
import { MapSegment, StarsSegment } from './front/FrontSegments';
import { ChronicleLog } from './log/ChronicleLog';
import { LifetimeStats } from './log/LifetimeStats';
import { LogSettingsEntry } from './log/LogSettingsEntry';
import { LegacySection } from './log/LegacySection';
import { PrestigeCard, PrestigeTree } from './log/Prestige';
import type { LineJump } from './log/jump';

/** What the game's views need; main builds every one of them once (Story 1.36). */
export interface GameViewDeps {
  bus: EventBus;
  /** Read only inside the legacy FRONT panels' selector effects (they migrate in Epic 6). */
  getState: () => GameState;
  actions: Actions;
  /** Confirm style and hold duration for irreversible actions (platform settings, Story 1.13). */
  confirmSettings: ReadonlySignal<ConfirmSettings>;
  /** The resource strip's sampled feed and the sheet controller its resource sheet opens in (Story 1.16). */
  feed: ResourceFeed;
  sheets: SheetController;
  onOpenSettings: () => void;
  onTogglePause: () => void;
  /** NEST's lay mode (hold / toggle, Story 1.22). */
  layMode: ReadonlySignal<LayMode>;
  /** FRONT → WAR's battle session and the open FRONT segment (Story 1.25). */
  war: WarSession;
  segment: ReadonlySignal<SegmentId | null>;
  chronicle: Chronicle;
  jump: LineJump;
  /** True while save writes fail: `• SAVE FAILED` under the strip, with EXPORT SAVE (Story 2.2). */
  saveFailing: ReadonlySignal<boolean>;
  onExportSave: () => void;
}

/** `#phase-indicator` keeps PhaseIndicator's per-phase class (`phase-colony` …), which main.css styles. */
function PhaseIndicator() {
  const cls = phaseClass(selectPhase.value as Phase);
  return (
    <Panel id="phase_indicator" domId="phase-indicator" class={cls ? `phase-indicator ${cls}` : 'phase-indicator'}>
      <PhaseLine />
    </Panel>
  );
}

/**
 * Every panel of the game, placed by the tab registry (`data/content/tabs.ts`,
 * Story 1.36; this replaces UIRoot's panel registry). Each `Panel` keeps the
 * id, classes and `data-*` hooks of the host UIRoot drew, and appears once its
 * phase reveals it. Order inside a container is top to bottom.
 */
export function gameViews(d: GameViewDeps): ShellViews {
  const buyClickPower = () => d.actions.buyUpgrade('click_power');
  return {
    strip: (
      <>
        <TopBar onTogglePause={d.onTogglePause} />
        {/* The resource strip and resource sheet (Story 1.16); the `.resource-panel` hook stays. */}
        <Panel id="resource_panel" class="resource-panel" attrs={{ 'data-resource-panel': '' }}>
          <ResourceStrip feed={d.feed} sheets={d.sheets} onOpenSettings={d.onOpenSettings} />
        </Panel>
        {/* Outside the panel: shown whenever writes fail, in any phase (Story 2.2). */}
        <SaveFailedMarker failing={d.saveFailing} sheets={d.sheets} onExport={d.onExportSave} />
      </>
    ),
    tabs: {
      // NEST (Story 1.22): phase line and goal meter, the scene, the event lines, the Click Power card.
      nest: (
        <>
          <PhaseIndicator />
          <div data-nest-host="scene">
            <NestScene lay={d.actions.layEgg} />
          </div>
          <Panel id="event_log">
            <EventLines chronicle={d.chronicle} jump={d.jump} />
          </Panel>
          <div data-nest-host="click-power">
            <ClickPowerCard buy={buyClickPower} />
          </div>
          <Panel id="transcendence_panel" domId="transcendence-panel" class="panel transcendence-panel">
            <Transcendence />
          </Panel>
        </>
      ),
      // WRKR (Story 1.23): upkeep and role rows, the food stock, automation.
      wrkr: (
        <>
          <Panel id="worker_assignment" domId="worker-assignment" class="panel worker-assignment-panel">
            <WorkersTab actions={d.actions} />
          </Panel>
          <Panel id="food_display" domId="food-display" class="panel food-display-panel">
            <FoodStock />
          </Panel>
          <Panel id="automation_panel" class="panel automation-host">
            <AutomationSection actions={d.actions} />
          </Panel>
        </>
      ),
      // BUILD (Story 1.24): header, Click Power (Phase 2+), buildings, research, converter.
      build: (
        <>
          <Panel id="build_header" attrs={{ 'data-build-host': 'header' }}>
            <BuildHeader />
          </Panel>
          <Panel id="build_click_power" attrs={{ 'data-build-host': 'click-power' }}>
            <ClickPowerCard place="build" buy={buyClickPower} />
          </Panel>
          <Panel id="building_panel" tag="section" domId="building-panel" class="build-section building-panel">
            <BuildingCards buy={(id) => d.actions.buyBuilding(id)} />
          </Panel>
          <Panel id="research_panel" tag="section" domId="research-panel" class="build-section research-panel">
            <ResearchCards
              start={(id) => d.actions.startResearch(id)}
              cancel={(id) => d.actions.cancelResearch(id)}
              confirmSettings={d.confirmSettings}
            />
          </Panel>
          <Panel
            id="resource_converter_panel"
            tag="section"
            domId="resource-converter-panel"
            class="build-section resource-converter-panel"
          >
            <ConverterCard convert={() => d.actions.runConversions()} />
          </Panel>
        </>
      ),
      // LOG (Story 1.26): the chronicle, lifetime stats, the settings entry, then LEGACY.
      log: (
        <>
          <Panel id="log_chronicle" attrs={{ 'data-log-host': 'chronicle' }}>
            <ChronicleLog chronicle={d.chronicle} jump={d.jump} />
          </Panel>
          <Panel id="log_stats" attrs={{ 'data-log-host': 'stats' }}>
            <LifetimeStats />
          </Panel>
          <Panel id="log_settings" attrs={{ 'data-log-host': 'settings' }}>
            <LogSettingsEntry onOpenSettings={d.onOpenSettings} />
          </Panel>
          <Panel id="log_legacy" attrs={{ 'data-log-host': 'legacy' }}>
            <LegacySection>
              <PrestigeCard actions={d.actions} confirmSettings={d.confirmSettings} />
              <PrestigeTree actions={d.actions} />
            </LegacySection>
          </Panel>
        </>
      ),
    },
    segments: {
      // FRONT → WAR (Story 1.25): soldiers and equipment, mutations, the enemy card, the combat log.
      war: (
        <>
          <Panel id="soldier_panel" domId="soldier-panel" class="panel soldier-panel">
            <SoldiersSection actions={d.actions} />
          </Panel>
          <Panel id="mutation_panel" domId="mutation-panel" class="panel mutation-panel">
            <MutationsSection actions={d.actions} />
          </Panel>
          <Panel id="battle_panel" domId="battle-panel" class="panel battle-panel">
            <EnemyCard session={d.war} />
          </Panel>
          <Panel id="combat_log" domId="combat-log-panel" class="panel combat-log-panel">
            <CombatLog session={d.war} />
          </Panel>
        </>
      ),
      // FRONT → MAP and STARS: the legacy Phase 4–5 panels, mounted by their segment until Epic 6.
      map: <MapSegment bus={d.bus} getState={d.getState} actions={d.actions} />,
      stars: <StarsSegment bus={d.bus} getState={d.getState} actions={d.actions} />,
    },
    primary: {
      nest: (
        <Panel id="click_button" class="nest-primary-host" attrs={{ 'data-nest-primary': '' }}>
          <NestPrimary actions={d.actions} layMode={d.layMode} />
        </Panel>
      ),
      wrkr: (
        <Panel id="wrkr_primary" attrs={{ 'data-wrkr-primary': '' }}>
          <WorkersPrimary actions={d.actions} />
        </Panel>
      ),
      build: (
        <Panel id="build_primary" class="build-primary-host" attrs={{ 'data-build-primary-host': '' }}>
          <BuildPrimary perform={(intent) => d.actions.perform(intent)} />
        </Panel>
      ),
      front: (
        <Panel id="war_primary" attrs={{ 'data-war-primary-host': '' }}>
          <WarPrimary session={d.war} segment={d.segment} />
        </Panel>
      ),
    },
  };
}
