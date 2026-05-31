export interface PlanetDef {
  name: string;
  type: 'rocky' | 'gas' | 'ice' | 'habitable';
  icon: string;
  yields: string;
  /** Human-readable explanation of what this planet offers once discovered. */
  accessibility: string;
  /** What the player needs to discover this planet (e.g., "Build a spaceship and launch a probe"). */
  requirement: string;
}

export const PLANETS: PlanetDef[] = [
  {
    name: 'MARS',
    type: 'rocky',
    icon: '🪨',
    yields: 'Antimatter',
    accessibility: 'A rocky world rich in antimatter deposits. Accessible by standard scout probe.',
    requirement: 'Build a spaceship and launch a probe from the Exploration panel.',
  },
  {
    name: 'SATURN',
    type: 'gas',
    icon: '🪐',
    yields: 'Dark Matter',
    accessibility: 'A gas giant swirling with dark matter clouds. Requires advanced probe technology.',
    requirement: 'Build a spaceship and launch a probe from the Exploration panel.',
  },
  {
    name: 'EUROPA',
    type: 'ice',
    icon: '🧊',
    yields: 'Void Crystals',
    accessibility: 'An icy moon harboring void crystals beneath its frozen crust.',
    requirement: 'Build a spaceship and launch a probe from the Exploration panel.',
  },
  {
    name: 'KEPLER-442B',
    type: 'habitable',
    icon: '🌍',
    yields: 'Food + Crystals',
    accessibility: 'A habitable exoplanet with Earth-like conditions, capable of producing food and crystals.',
    requirement: 'Build a spaceship and launch a probe from the Exploration panel.',
  },
];
