/**
 * gaffr Retro Arcade — FDR Colour System
 * Fixture Difficulty Rating 1–5 plus BGW/DGW special states.
 */

export interface FdrColorSpec {
  background: string;
  borderText: string;
}

export const fdrColors: Record<number, FdrColorSpec> = {
  1: { background: '#0a2a0a', borderText: '#39ff14' },
  2: { background: '#0f2a0a', borderText: '#88e848' },
  3: { background: '#2a2a00', borderText: '#e8c832' },
  4: { background: '#2a1400', borderText: '#e87832' },
  5: { background: '#2a0a0a', borderText: '#e84848' },
};

export const bgwColors: FdrColorSpec = {
  background: '#1a0a0a',
  borderText: '#e84848',
};

export const dgwColors: FdrColorSpec = {
  background: '#0a1a2a',
  borderText: '#39ff14',
};

/**
 * Get FDR colour spec for a given rating, or BGW/DGW special state.
 */
export function getFdrColors(rating: number): FdrColorSpec {
  return fdrColors[rating] ?? fdrColors[3];
}
