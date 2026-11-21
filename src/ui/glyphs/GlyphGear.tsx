/** The settings gear (Story 8.2): `[ SETTINGS ⟨gear⟩ ]`. */
import { GlyphFrame, type GlyphProps } from './Glyph';

/** A cog: hub, rim and eight teeth. */
export function GlyphGear(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </GlyphFrame>
  );
}
