import { Button } from '../primitives/Button';
import { GEAR_GLYPH } from '../shell/resourceCatalog';
import { SETTINGS_NOT_READY } from '../sheets/ResourceSheet';
import './log.css';

/**
 * LOG's settings entry (Story 1.26, UX-DR31). The settings screen is Story
 * 1.27: until main passes `onOpenSettings`, the entry shows disabled, like
 * the resource sheet's. Hook: `[data-log-section="settings"] [data-action="settings"]`.
 */
export function LogSettingsEntry({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <section class="log-section" data-log-section="settings">
      <Button
        verb={
        <>
          [ SETTINGS <GEAR_GLYPH /> ]
        </>
      }
        label="Settings"
        data-action="settings"
        disabled={onOpenSettings ? false : SETTINGS_NOT_READY}
        onPress={() => onOpenSettings?.()}
      />
    </section>
  );
}
