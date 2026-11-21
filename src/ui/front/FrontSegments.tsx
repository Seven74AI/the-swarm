import type { Actions } from '../../actions';
import type { EventBus } from '../../engine/EventBus';
import type { GameState } from '../../state/GameState';
import { MapPanel } from '../panels/MapPanel';
import { ExpeditionPanel } from '../panels/ExpeditionPanel';
import { SpaceshipPanel } from '../panels/SpaceshipPanel';
import { ExplorationPanel } from '../panels/ExplorationPanel';
import { CosmicPanel } from '../panels/CosmicPanel';
import { StarmapPanel } from '../panels/StarmapPanel';
import { explain } from '../panels/refusal';
import { LegacyPanel } from './LegacyPanel';
import { RecruitSection } from './RecruitSection';

/**
 * FRONT → MAP and STARS (Story 1.36): the Phase 4–5 panels are still the
 * legacy vanilla-DOM ones, and these segments mount them directly (UIRoot is
 * gone). Epic 6 rebuilds them as Preact views; until then they read state
 * through `getState` inside their selector effects (#186) and act through `actions`.
 */
export interface FrontSegmentDeps {
  bus: EventBus;
  getState: () => GameState;
  actions: Actions;
}

/** MAP: the territory map (a tapped tile claims it), RECRUIT (Story 4.10), then expeditions. */
export function MapSegment({ bus, getState, actions }: FrontSegmentDeps) {
  return (
    <>
      <LegacyPanel
        id="map_panel"
        create={() => {
          const map = new MapPanel(getState);
          map.onTileClick = (x, y) => void explain(map.getElement(), actions.claimTile(x, y));
          return map.getElement();
        }}
      />
      <div class="panel recruit-panel" data-recruit-panel="">
        <RecruitSection actions={actions} />
      </div>
      <LegacyPanel id="expedition_panel" create={() => new ExpeditionPanel(bus, getState, actions).getElement()} />
    </>
  );
}

/** STARS: ships, explorations, cosmic discoveries, then the star map (a tapped planet goes to the event log). */
export function StarsSegment({ bus, getState, actions }: FrontSegmentDeps) {
  return (
    <>
      <LegacyPanel id="spaceship_panel" create={() => new SpaceshipPanel(bus, getState, actions).getElement()} />
      <LegacyPanel id="exploration_panel" create={() => new ExplorationPanel(bus, getState, actions).getElement()} />
      <LegacyPanel id="cosmic_panel" create={() => new CosmicPanel(bus, getState).getElement()} />
      <LegacyPanel
        id="starmap_panel"
        create={() => {
          const starmap = new StarmapPanel(bus, getState);
          starmap.onPlanetClick = (planet, discovered) => {
            if (discovered) {
              bus.emit('planet_clicked', {
                name: planet.name,
                type: planet.type,
                yields: planet.yields,
                accessibility: planet.accessibility,
              });
            } else {
              bus.emit('planet_clicked', {
                name: planet.name,
                type: planet.type,
                requirement: planet.requirement,
                discovered: false,
              });
            }
          };
          return starmap.getElement();
        }}
      />
    </>
  );
}
