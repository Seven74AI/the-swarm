/**
 * The 14 resource glyphs (Story 8.2, UX-DR35): one line drawing per resource,
 * in the frame of `Glyph.tsx`. VNOM is a pair of fangs, so it can't be read as
 * FOOD's drop.
 */
import { GlyphFrame, type GlyphProps } from './Glyph';

/** EGG: an upright egg with a glint. */
export function GlyphEggs(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <ellipse cx="12" cy="13" rx="6" ry="8" />
      <path d="M9.5 10.5a3 4 0 0 1 2-3" />
    </GlyphFrame>
  );
}

/** LRVA: a curled grub with its head. */
export function GlyphLarvae(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M6 15c0-5 4-8 8-7s5 5 2 7-5 0-4-2" />
      <circle cx="7" cy="16.5" r="1.4" />
    </GlyphFrame>
  );
}

/** WRKR: an ant from above, three body parts and six legs. */
export function GlyphWorkers(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <ellipse cx="7" cy="13" rx="3.4" ry="2.4" />
      <ellipse cx="12" cy="13" rx="1.8" ry="1.4" />
      <circle cx="16" cy="13" r="2" />
      <path d="M10.5 11.5 8.5 8M12 11.5V8M13.5 11.5l2-3.5M10.5 14.5l-2 3.5M12 14.5V18M13.5 14.5l2 3.5M18 12l3-2.5M18 14l3 2.5" />
    </GlyphFrame>
  );
}

/** FOOD: a drop of honeydew with a glint. */
export function GlyphFood(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M12 4c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z" />
      <path d="M10 14a2 2 0 0 0 2 2" />
    </GlyphFrame>
  );
}

/** WOOD: a log, end grain to the left. */
export function GlyphWood(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M4 10h16v7H4z" />
      <ellipse cx="4" cy="13.5" rx="1.6" ry="3.5" />
      <path d="M8 10v7M14 12h4" />
    </GlyphFrame>
  );
}

/** STON: a faceted rock. */
export function GlyphStone(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M5 17l2-7 5-3 6 2 2 6-4 3H8z" />
      <path d="M9 11l3 2 4-1" />
    </GlyphFrame>
  );
}

/** NECT: a flower head with its petals. */
export function GlyphNectar(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.2" />
      <path d="M12 5v3M12 16v3M5 12h3M16 12h3M7 7l2 2M17 7l-2 2M7 17l2-2M17 17l-2-2" />
    </GlyphFrame>
  );
}

/** SILK: three drawn threads. */
export function GlyphSilk(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M5 19C9 15 7 9 12 5M9 19c3-3 3-8 7-12M13 19c2-2 3-5 6-8" />
    </GlyphFrame>
  );
}

/** CHTN: a banded shell plate. */
export function GlyphChitin(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M12 4l7 4v6c0 3-3 6-7 7-4-1-7-4-7-7V8z" />
      <path d="M8 10h8M8 14h8" />
    </GlyphFrame>
  );
}

/** VNOM: two curved fangs under a jaw line, each with a venom groove. */
export function GlyphVenom(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M4 5h16" />
      <path d="M6.5 5c0 5 1.2 8.5 3.5 13 .8-4.5 1-8.5.8-13" />
      <path d="M13.2 5c-.2 4.5 0 8.5.8 13 2.3-4.5 3.5-8 3.5-13" />
      <path d="M8.7 8v4M15.3 8v4" />
    </GlyphFrame>
  );
}

/** VC: a cut crystal. */
export function GlyphVoidCrystals(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <path d="M12 3l5 6-5 12-5-12z" />
      <path d="M7 9h10M12 3v18" />
    </GlyphFrame>
  );
}

/** ANTM: a nucleus with three orbits. */
export function GlyphAntimatter(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-60 12 12)" />
    </GlyphFrame>
  );
}

/** DKMT: a body half in shadow. */
export function GlyphDarkMatter(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5a7 7 0 0 1 0 14 4 4 0 0 0 0-14z" fill="currentColor" />
    </GlyphFrame>
  );
}

/** SRVY: a scanner sweep with a contact. */
export function GlyphSurveyData(p: GlyphProps) {
  return (
    <GlyphFrame {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12l5.5-5.5" />
      <circle cx="15.5" cy="14.5" r="0.8" />
    </GlyphFrame>
  );
}
