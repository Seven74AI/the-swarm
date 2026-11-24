import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/preact';
import '@preact/signals';
import { gameState } from '../../../../src/state/gameSignal';
import { Phase } from '../../../../src/phases/phases';
import { createSheetController, type SheetController } from '../../../../src/ui/shell/SheetController';
import { SheetHost } from '../../../../src/ui/shell/SheetHost';
import { openRoomJobChoice, openRoomJobs } from '../../../../src/ui/sheets/RoomJobSheet';
import { RoomJobsLine } from '../../../../src/ui/nest/RoomJobsLine';
import { roomJobBalance } from '../../../../src/data/balance/roomJobs';
import { ROOM_JOB_REFUSALS } from '../../../../src/data/content/roomJobs';
import { testActions } from '../../helpers/actions';
import { makeState } from '../../helpers/makeState';
import { EventBus } from '../../../../src/engine/EventBus';
import { formatFull } from '../../../../src/utils/format';

/**
 * Story 9.14 (FR59, FR63): a room opened by a DIG press offers a one-tap job
 * choice (a peek, never a modal); NEST shows the plain rooms and a way to
 * assign them later.
 */
const initial = gameState.value;
let sheets: SheetController;

const colony = (rooms: number, fresh = rooms, gallery = 0, stone = 0) =>
  makeState({ phase: Phase.COLONY, dig: { roomsDug: rooms }, roomJobs: { jobs: { gallery }, fresh }, resources: { stone } });

beforeEach(() => {
  sheets = createSheetController();
  render(<SheetHost sheets={sheets} />);
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  gameState.value = initial;
});

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

describe('the room-opened choice', () => {
  it('is a peek, never a modal, with the room-opened line, GALLERY and PLAIN', () => {
    gameState.value = colony(1);
    act(() => void openRoomJobChoice(sheets, testActions(new EventBus())));
    const sheet = q('[data-room-job-choice]')!;
    expect(sheet).not.toBeNull();
    expect(sheet.closest('[data-sheet]')!.getAttribute('data-sheet')).toBe('peek');
    expect(sheets.state.value.open!.priority).toBe('peek');
    expect(sheet.textContent).toContain('ROOM OPENED');
    expect(q('[data-room-job-pick="gallery"]')!.textContent).toContain('GALLERY');
    expect(q('[data-room-job-pick="plain"]')!.textContent).toContain('PLAIN');
  });

  it('GALLERY gives the new room the job for free and closes', () => {
    gameState.value = colony(1);
    act(() => void openRoomJobChoice(sheets, testActions(new EventBus())));
    act(() => q<HTMLButtonElement>('[data-room-job-pick="gallery"]')!.click());
    expect(gameState.value.roomJobs.jobs.gallery).toBe(1);
    expect(gameState.value.resources.stone).toBe(0);
    expect(q('[data-room-job-choice]')).toBeNull();
  });

  it('explains a GALLERY it can’t give (the room’s free job was already used, and no stone)', () => {
    gameState.value = colony(1, 0, 0, 0);
    act(() => void openRoomJobChoice(sheets, testActions(new EventBus())));
    const pick = q<HTMLButtonElement>('[data-room-job-pick="gallery"]')!;
    expect(pick.getAttribute('aria-disabled')).toBe('true');
    expect(pick.textContent).toContain(ROOM_JOB_REFUSALS.cannot_afford);
  });

  it('PLAIN, or closing it, leaves the room plain', () => {
    gameState.value = colony(1);
    act(() => void openRoomJobChoice(sheets, testActions(new EventBus())));
    act(() => q<HTMLButtonElement>('[data-room-job-pick="plain"]')!.click());
    expect(gameState.value.roomJobs.jobs.gallery).toBe(0);
    expect(gameState.value.roomJobs.fresh).toBe(1);
    expect(q('[data-room-job-choice]')).toBeNull();
  });
});

describe('NEST’s room jobs line', () => {
  it('is absent before any room is dug', () => {
    gameState.value = colony(0);
    const { container } = render(<RoomJobsLine sheets={sheets} actions={testActions(new EventBus())} />);
    expect(container.querySelector('[data-room-jobs]')).toBeNull();
  });

  it('reads <n> PLAIN ROOMS and each job’s rooms, with a way to assign them', () => {
    gameState.value = colony(5, 3, 2);
    const { container } = render(<RoomJobsLine sheets={sheets} actions={testActions(new EventBus())} />);
    const line = container.querySelector('[data-room-jobs]')!;
    expect(line.textContent).toContain('3 PLAIN ROOMS');
    expect(line.textContent).toContain('2 GALLERY');
    act(() => container.querySelector<HTMLButtonElement>('[data-room-jobs-assign]')!.click());
    expect(q('[data-room-jobs-sheet]')).not.toBeNull();
  });
});

describe('the room jobs sheet', () => {
  it('assigns a plain room, and the change back costs stone and says so', () => {
    gameState.value = colony(2, 1, 0, roomJobBalance.changeCostStone);
    act(() => void openRoomJobs(sheets, testActions(new EventBus())));
    act(() => q<HTMLButtonElement>('[data-room-job-add="gallery"]')!.click());
    expect(gameState.value.roomJobs.jobs.gallery).toBe(1);
    const remove = q<HTMLButtonElement>('[data-room-job-remove="gallery"]')!;
    expect(remove.closest('[data-room-job-row]')!.textContent).toContain(formatFull(roomJobBalance.changeCostStone));
    act(() => remove.click());
    expect(gameState.value.roomJobs.jobs.gallery).toBe(0);
    expect(gameState.value.resources.stone).toBe(0);
  });

  it('explains a refusal on the button: no stone for a change', () => {
    gameState.value = colony(2, 0, 0, 0);
    act(() => void openRoomJobs(sheets, testActions(new EventBus())));
    const add = q<HTMLButtonElement>('[data-room-job-add="gallery"]')!;
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(add.closest('[data-room-job-row]')!.textContent).toContain(ROOM_JOB_REFUSALS.cannot_afford);
  });
});
