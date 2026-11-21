import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import '@preact/signals';
import { ABBREVIATIONS, hasAbbreviation, spellOut } from '../../../../src/data/content/abbreviations';
import { RESOURCES } from '../../../../src/ui/shell/resourceCatalog';
import { Button } from '../../../../src/ui/primitives/Button';
import { Card } from '../../../../src/ui/primitives/Card';
import { decorate } from '../../../../src/ui/primitives/Deco';
import { described, spoken, visibleText } from '../../helpers/a11y';

/**
 * Story 1.33 (UX-DR42): abbreviations are visual only. A short form keeps its
 * look, and assistive tech reads the full word.
 */

afterEach(cleanup);

/** True when a label is a short form of its name rather than the word itself (EGG for Eggs is the word). */
const isShortForm = (label: string, name: string): boolean =>
  label !== name.toUpperCase() && `${label}S` !== name.toUpperCase();

describe('the abbreviation registry', () => {
  it('spells out every short form as full words', () => {
    expect(spellOut('LV.2 → 3')).toBe('level 2 → 3');
    expect(spellOut('STR 5 · DEF 4 · HP 25')).toBe('strength 5 · defense 4 · hit points 25');
    expect(spellOut('10 CHTN · 5 VNOM')).toBe('10 chitin · 5 venom');
    expect(spellOut('THE LEVEL HAS STRENGTH')).toBe('THE LEVEL HAS STRENGTH');
    expect(hasAbbreviation('LV.2')).toBe(true);
    expect(hasAbbreviation('DEFENDS THE NEST')).toBe(false);
  });

  it('knows every strip label that is not a word, by its full name', () => {
    for (const r of RESOURCES.filter((x) => isShortForm(x.label, x.name))) {
      expect(ABBREVIATIONS[r.label], r.id).toBe(r.name.toLowerCase());
    }
  });

  it('spells nothing out as another short form', () => {
    for (const full of Object.values(ABBREVIATIONS)) expect(hasAbbreviation(full), full).toBe(false);
  });
});

describe('short forms on screen', () => {
  const view = (node: preact.ComponentChildren) => render(<p>{node}</p>).container.querySelector('p')!;

  it('decorate keeps the short form visible and reads it in full', () => {
    const p = view(decorate('LV.2 → 3 · 5 CHTN'));
    expect(visibleText(p)).toBe('LV.2 → 3 · 5 CHTN');
    expect(spoken(p)).toBe('level 2 to 3 , 5 chitin');
  });

  it('decorate leaves plain words alone', () => {
    expect(decorate('BRINGS IN FOOD')).toBe('BRINGS IN FOOD');
  });

  it("a button's target and cost line are read in full", () => {
    const { container } = render(<Button verb="BUY" target="WALLS LV.3" cost="10 CHTN" onPress={() => {}} />);
    const btn = container.querySelector('button')!;
    expect(spoken(btn)).toContain('BUY WALLS level 3');
    expect(visibleText(btn)).toContain('WALLS LV.3');
    expect(described(btn)).toBe('10 chitin');
  });

  it("a card's level, effect and cost lines are read in full", () => {
    const { container } = render(
      <Card title="WALLS" level="LV.1 → 2" effect="+1 STR PER LEVEL" cost="5 VNOM" affordable action={null} />,
    );
    const card = container.querySelector('article')!;
    const said = spoken(card);
    expect(said).toContain('level 1 to 2');
    expect(said).toContain('strength');
    expect(said).not.toMatch(/\b(LV|STR|VNOM)\b/);
    expect(visibleText(container.querySelector('.card__level')!)).toBe('LV.1 → 2');
  });
});
