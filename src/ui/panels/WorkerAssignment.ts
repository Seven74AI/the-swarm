import type { Store } from '../../state/Store';
import type { EventBus } from '../../engine/EventBus';
import type { ResourceSystem } from '../../systems/ResourceSystem';
import type { GameState } from '../../state/GameState';

type Role = 'gather' | 'tend' | 'dig' | 'guard';

const ROLE_DISPLAY: Record<Role, { label: string; icon: string }> = {
  gather: { label: 'Gather', icon: '🌾' },
  tend: { label: 'Tend', icon: '🥚' },
  dig: { label: 'Dig', icon: '⛏️' },
  guard: { label: 'Guard', icon: '🛡️' },
};

/**
 * Worker assignment panel with +/- buttons for each role.
 * Hidden initially, revealed when colony phase starts.
 */
export class WorkerAssignment {
  private container: HTMLDivElement;

  constructor(
    private store: Store,
    private bus: EventBus,
    private resourceSystem: ResourceSystem,
    private getState: () => GameState,
    private setState: (state: GameState) => void,
  ) {
    this.container = document.createElement('div');
    this.container.id = 'worker-assignment';
    this.container.className = 'panel worker-assignment-panel';
    this.container.style.display = 'none'; // Hidden until colony phase

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Assign Workers';
    this.container.appendChild(title);

    // Create role rows
    const roles: Role[] = ['gather', 'tend'];
    for (const role of roles) {
      this.container.appendChild(this.createRoleRow(role));
    }

    // Listen for phase change to reveal
    bus.subscribe('phase_changed', (payload: unknown) => {
      const phase = (payload as { phase: string }).phase;
      if (phase === 'colony') {
        this.container.style.display = '';
      }
    });

    // Listen for worker assignment changes to refresh
    store.subscribe('workersAssigned', () => this.refresh());
  }

  private createRoleRow(role: Role): HTMLDivElement {
    const display = ROLE_DISPLAY[role];
    const row = document.createElement('div');
    row.className = 'stat-row';

    const label = document.createElement('span');
    label.className = 'stat-label';
    label.textContent = `${display.icon} ${display.label}`;
    row.appendChild(label);

    const controls = document.createElement('span');
    controls.className = 'role-controls';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'btn btn-sm';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.resourceSystem.unassignWorker(state, role);
      this.setState(updated);
    });

    const countSpan = document.createElement('span');
    countSpan.className = 'stat-value role-count';
    countSpan.textContent = '0';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'btn btn-sm';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      const state = this.getState();
      const updated = this.resourceSystem.assignWorker(state, role);
      this.setState(updated);
    });

    controls.appendChild(minusBtn);
    controls.appendChild(countSpan);
    controls.appendChild(plusBtn);
    row.appendChild(controls);

    // Store reference for refresh
    row.setAttribute('data-role', role);
    return row;
  }

  private refresh(): void {
    const state = this.getState();
    const rows = this.container.querySelectorAll('[data-role]');
    rows.forEach((row) => {
      const role = row.getAttribute('data-role') as Role;
      const countSpan = row.querySelector('.role-count');
      if (countSpan) {
        countSpan.textContent = String(state.workersAssigned[role] ?? 0);
      }
    });
  }

  getElement(): HTMLDivElement {
    return this.container;
  }
}
