import type { Store } from '../../state/Store';
import type { GameState } from '../../state/GameState';
import { launchExpedition } from '../../systems/ExpeditionSystem';
import { MAX_ACTIVE_EXPEDITIONS } from '../../systems/ExpeditionSystem';

/**
 * ExpeditionPanel — launch expeditions, view active ones.
 */
export class ExpeditionPanel {
  private container: HTMLDivElement;

  constructor(
    private store: Store,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'expedition-panel';
    this.container.className = 'panel expedition-panel';

    this.render();

    store.subscribe('expeditions', () => this.render());
    store.subscribe('soldiers', () => this.render());
  }

  /** Public refresh for tests */
  refresh(): void {
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    const state = this.getState();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '🗺️ Expeditions';
    this.container.appendChild(title);

    // Launch form
    this.container.appendChild(this.createLaunchForm(state));

    // Active expeditions list
    if (state.expeditions.length > 0) {
      const listTitle = document.createElement('div');
      listTitle.className = 'expedition-list-title';
      listTitle.textContent = 'Active Expeditions:';
      this.container.appendChild(listTitle);

      for (const exp of state.expeditions) {
        this.container.appendChild(this.createExpeditionRow(exp));
      }
    }
  }

  private createLaunchForm(state: GameState): HTMLDivElement {
    const form = document.createElement('div');
    form.className = 'expedition-launch';

    const scoutsInput = document.createElement('input');
    scoutsInput.type = 'number';
    scoutsInput.min = '0';
    scoutsInput.max = String(state.soldiers.scouts);
    scoutsInput.value = '0';
    scoutsInput.className = 'expedition-input';
    scoutsInput.setAttribute('placeholder', 'Scouts');

    const warriorsInput = document.createElement('input');
    warriorsInput.type = 'number';
    warriorsInput.min = '0';
    warriorsInput.max = String(state.soldiers.warriors);
    warriorsInput.value = '0';
    warriorsInput.className = 'expedition-input';
    warriorsInput.setAttribute('placeholder', 'Warriors');

    const destSelect = document.createElement('select');
    destSelect.className = 'expedition-select';
    const destinations = ['MEADOW', 'FOREST', 'MOUNTAIN'];
    for (const dest of destinations) {
      const opt = document.createElement('option');
      opt.value = dest;
      opt.textContent = dest;
      destSelect.appendChild(opt);
    }

    const label = document.createElement('span');
    label.textContent = `Scout: ${state.soldiers.scouts} Warrior: ${state.soldiers.warriors}`;
    label.className = 'soldier-count';
    form.appendChild(label);

    const btn = document.createElement('button');
    btn.textContent = 'Launch';
    btn.className = 'btn';
    btn.disabled = state.expeditions.length >= MAX_ACTIVE_EXPEDITIONS;

    btn.addEventListener('click', () => {
      const scouts = parseInt(scoutsInput.value, 10) || 0;
      const warriors = parseInt(warriorsInput.value, 10) || 0;
      const dest = destSelect.value;
      const s = this.getState();
      const updated = launchExpedition(s, scouts, warriors, dest);
      this.setState(updated);
    });

    form.appendChild(scoutsInput);
    form.appendChild(warriorsInput);
    form.appendChild(destSelect);
    form.appendChild(btn);

    return form;
  }

  private createExpeditionRow(exp: {
    id: string;
    scouts: number;
    warriors: number;
    destination: string;
    ticksRemaining: number;
    risk: number;
  }): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'stat-row expedition-row';

    const info = document.createElement('span');
    info.className = 'stat-label';
    info.textContent = `${exp.destination} (${exp.scouts}S/${exp.warriors}W)`;
    row.appendChild(info);

    const timer = document.createElement('span');
    timer.className = 'stat-value';
    timer.textContent = `${exp.ticksRemaining}⏳ Risk: ${Math.round(exp.risk * 100)}%`;
    row.appendChild(timer);

    return row;
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
