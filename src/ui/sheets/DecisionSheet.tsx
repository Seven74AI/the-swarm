import { useContext, useEffect } from 'preact/hooks';
import type { EventBus } from '../../engine/EventBus';
import type { DecisionEvent } from '../../state/queries';
import type { SheetController } from '../shell/SheetController';
import { ModalSheet, SheetContext } from '../shell/Sheet';
import { Button } from '../primitives/Button';

/**
 * The decision sheet (Story 1.14; was `DecisionPopup`, GM-2).
 *
 * A `decision_event` opens it through the SheetController at `decision` priority.
 * It is a modal sheet that is not dismissible: it closes only by a choice or by
 * its timeout. Its scrim lets taps through, so the game stays playable behind it,
 * as the legacy popup did. Its timer starts when it actually opens, so it never
 * runs out while the sheet waits behind the offline summary.
 * A choice calls the `chooseDecision` action, then emits `decision_chosen`.
 * Hooks kept for decision-popups.spec: `#decision-popup`, `.decision-popup-title`,
 * `.decision-popup-desc`, one `button[data-choice]` per choice.
 *
 * Ignore lines, ignore policies, a timer meter and the two-choice content arrive
 * with the decision-event stories (D8, Epic 4); until then the legacy events keep
 * their 2-3 choices, listed in the body.
 */

export const DECISION_AUTO_DISMISS_MS = 30_000;

export type ChooseDecision = (type: DecisionEvent['type'], choice: string) => unknown;

interface DecisionSheetProps {
  event: DecisionEvent;
  onChoose: (choice: string) => void;
}

export function DecisionSheet({ event, onChoose }: DecisionSheetProps) {
  const { close } = useContext(SheetContext);
  useEffect(() => {
    const timer = setTimeout(close, DECISION_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [close]);
  return (
    <ModalSheet headline={event.title} id="decision-popup" headlineClass="decision-popup-title" dismissible={false}>
      <p class="decision-popup-desc">{event.description}</p>
      <div class="decision-popup-choices">
        {event.choices.map((c) => (
          <Button
            key={c.label}
            verb={c.label}
            cost={c.description}
            data-choice={c.label}
            onPress={() => {
              onChoose(c.label);
              close();
            }}
          />
        ))}
      </div>
    </ModalSheet>
  );
}

/** Opens a decision sheet for each `decision_event`; a newer event replaces an open or waiting one. */
export function bindDecisionSheets(deps: { bus: EventBus; sheets: SheetController; choose: ChooseDecision }): () => void {
  const { bus, sheets, choose } = deps;
  let current: number | null = null;
  const onEvent = (event: DecisionEvent) => {
    if (current !== null) sheets.close(current);
    const id = sheets.open({
      priority: 'decision',
      render: () => (
        <DecisionSheet
          event={event}
          onChoose={(choice) => {
            choose(event.type, choice);
            bus.emit('decision_chosen', { type: event.type, choice });
          }}
        />
      ),
      onClose: () => {
        if (current === id) current = null;
      },
    });
    current = id;
  };
  bus.subscribe('decision_event', onEvent);
  return () => bus.unsubscribe('decision_event', onEvent);
}
