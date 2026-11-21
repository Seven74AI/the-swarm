/** The 9 building glyphs (Story 8.2, UX-DR35), in the frame of `Glyph.tsx`. */
import { GlyphFrame, type GlyphProps } from './Glyph';

/** BARRACKS: a hall with a gabled roof and one door. */
export function GlyphBarracks(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M3 20V10l9-6 9 6v10z" />
      <path d="M9 20v-6h6v6M3 10h18" />
    </GlyphFrame>
  );
}

/** WALLS: a crenellated wall. */
export function GlyphWalls(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M3 20V9h3v3h3V9h3v3h3V9h3v3h3v8z" />
      <path d="M3 15h18M9 15v5M15 15v5" />
    </GlyphFrame>
  );
}

/** WAREHOUSE: a store with shelved bays. */
export function GlyphWarehouse(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M3 20V9l9-5 9 5v11z" />
      <path d="M7 20v-7h10v7M7 16h10" />
    </GlyphFrame>
  );
}

/** SILK WEAVING: a web, spokes and a ring. */
export function GlyphSilkWeaving(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7" />
    </GlyphFrame>
  );
}

/** CHITIN ARMORY: a shell shield with a cross. */
export function GlyphChitinArmory(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M12 4l7 4v6c0 3-3 6-7 7-4-1-7-4-7-7V8z" />
      <path d="M12 8v9M8.5 12.5h7" />
    </GlyphFrame>
  );
}

/** VENOM LAB: a flask with a fill line. */
export function GlyphVenomLab(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M9 4h6M10 4v6l-5 9h14l-5-9V4" />
      <path d="M7.5 15h9" />
    </GlyphFrame>
  );
}

/** TUNNELS: two passages branching under the ground line. */
export function GlyphTunnels(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M3 6h18" />
      <path d="M12 6v5M12 11l-6 6v3M12 11l6 6v3" />
    </GlyphFrame>
  );
}

/** FUNGUS GARDEN: a mushroom cap on a stem, a bed under it. */
export function GlyphFungusGarden(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M4 12a8 7 0 0 1 16 0z" />
      <path d="M10 12v6h4v-6M3 20h18" />
    </GlyphFrame>
  );
}

/** MIDDEN: a heap of refuse, three layers piled up. */
export function GlyphMidden(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M3 20h18l-4-6H7z" />
      <path d="M8 14l2-4h4l2 4M10.5 10l1.5-3 1.5 3" />
    </GlyphFrame>
  );
}
