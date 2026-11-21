import type { SheetController } from '../shell/SheetController';
import { ModalSheet } from '../shell/Sheet';

/**
 * The one-time add-to-home-screen hint (Story 2.12; AR6, D4 → Durability).
 * Opened by main at the first meaningful play on a mobile browser that isn't
 * the installed app: a home-screen web app is exempt from Safari's 7-day
 * storage cap. Dismissible; it waits behind more urgent sheets.
 * Hooks: `[data-home-screen-hint]`, `[data-sheet-close]`.
 */
export function HomeScreenHintSheet() {
  return (
    <ModalSheet headline="ADD THE GAME TO YOUR HOME SCREEN." data-home-screen-hint="" closeLabel="GOT IT">
      <p>A BROWSER CAN DELETE A SITE'S SAVE AFTER 7 DAYS WITHOUT A VISIT. A GAME ON THE HOME SCREEN KEEPS ITS SAVE.</p>
      <p>ON IPHONE AND IPAD: SHARE, THEN ADD TO HOME SCREEN. ON ANDROID: THE BROWSER MENU, THEN ADD TO HOME SCREEN.</p>
      <p>THIS HINT SHOWS ONCE.</p>
    </ModalSheet>
  );
}

/** Request the hint at modal priority; returns its sheet id. */
export function openHomeScreenHint(sheets: SheetController): number {
  return sheets.open({ priority: 'modal', render: () => <HomeScreenHintSheet /> });
}
