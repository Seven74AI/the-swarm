import { describe, it, expect } from 'vitest';
import { PLANETS, type PlanetDef } from '../../src/data/planets';

describe('PlanetDef', () => {
  it('every planet has required fields', () => {
    for (const planet of PLANETS) {
      expect(planet.name).toBeTruthy();
      expect(['rocky', 'gas', 'ice', 'habitable']).toContain(planet.type);
      expect(planet.icon).toBeTruthy();
      expect(planet.yields).toBeTruthy();
      expect(planet.accessibility).toBeTruthy();
      expect(planet.requirement).toBeTruthy();
    }
  });

  it('accessibility is a non-empty string describing the planet', () => {
    for (const planet of PLANETS) {
      expect(typeof planet.accessibility).toBe('string');
      expect(planet.accessibility.length).toBeGreaterThan(10);
    }
  });

  it('requirement is a non-empty string explaining discovery prerequisites', () => {
    for (const planet of PLANETS) {
      expect(typeof planet.requirement).toBe('string');
      expect(planet.requirement.length).toBeGreaterThan(10);
    }
  });

  it('all four planets are defined', () => {
    expect(PLANETS).toHaveLength(4);
    const names = PLANETS.map((p) => p.name);
    expect(names).toContain('MARS');
    expect(names).toContain('SATURN');
    expect(names).toContain('EUROPA');
    expect(names).toContain('KEPLER-442B');
  });

  it('PlanetDef type is compatible with all PLANETS entries', () => {
    const _check: PlanetDef[] = PLANETS;
    expect(_check).toHaveLength(4);
  });
});
