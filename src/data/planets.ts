export interface PlanetDef {
  name: string;
  type: 'rocky' | 'gas' | 'ice' | 'habitable';
  icon: string;
  yields: string;
}

export const PLANETS: PlanetDef[] = [
  { name: 'MARS', type: 'rocky', icon: '🪨', yields: 'Antimatter' },
  { name: 'SATURN', type: 'gas', icon: '🪐', yields: 'Dark Matter' },
  { name: 'EUROPA', type: 'ice', icon: '🧊', yields: 'Void Crystals' },
  { name: 'KEPLER-442B', type: 'habitable', icon: '🌍', yields: 'Food + Crystals' },
];
