import { sceneBalance } from '../../data/balance/scene';
import type { Ant, Point, Token, Tunnel } from './nestLayout';

/**
 * How the individual ants move (Story 8.6; AR14, N1): a pure function of
 * visual time (`sceneClock`), so the same ant at the same time is always in
 * the same pose and nothing about an ant is stored anywhere.
 *
 * A chamber ant sways forward and back along its heading and turns a little;
 * a tunnel walker goes from one end of its tunnel to the other and back,
 * facing the way it walks. Under reduced motion the clock stands still, so
 * every ant keeps one pose.
 */

/** How far a chamber ant sways along its heading, and how far it turns, in viewBox units and degrees. */
const SWAY = 2;
const TURN = 12;

const round = (n: number): number => Math.round(n * 10) / 10;
const TAU = 2 * Math.PI;

/** The point of a tunnel's centre line at `u` (0 at its start, 1 at its end). */
export function tunnelPoint(tunnel: Tunnel, u: number): Point {
  const [a, b, c, d] = tunnel.curve;
  const v = 1 - u;
  const k0 = v * v * v;
  const k1 = 3 * v * v * u;
  const k2 = 3 * v * u * u;
  const k3 = u * u * u;
  return { x: k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, y: k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y };
}

/** The direction of a tunnel at `u`, in degrees. */
function tunnelHeading(tunnel: Tunnel, u: number): number {
  const [a, b, c, d] = tunnel.curve;
  const v = 1 - u;
  const dx = 3 * v * v * (b.x - a.x) + 6 * v * u * (c.x - b.x) + 3 * u * u * (d.x - c.x);
  const dy = 3 * v * v * (b.y - a.y) + 6 * v * u * (c.y - b.y) + 3 * u * u * (d.y - c.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Where `ant` is, and which way it faces, at visual time `t` (ms). */
export function antPose(ant: Ant, tunnels: readonly Tunnel[], t: number): Token {
  const tunnel = ant.tunnel === null ? undefined : tunnels.find((x) => x.id === ant.tunnel);
  if (tunnel) {
    // Out and back: 0 → 2 over two walks, from where this ant starts.
    const s = (((t / sceneBalance.tunnelWalkMs + ant.start * 2) % 2) + 2) % 2;
    const out = s < 1;
    const u = out ? s : 2 - s;
    const p = tunnelPoint(tunnel, u);
    return { x: round(p.x), y: round(p.y), angle: Math.round(tunnelHeading(tunnel, u) + (out ? 0 : 180)) };
  }
  const cycle = TAU * (t / sceneBalance.antSwayMs + ant.start);
  const along = SWAY * Math.sin(cycle);
  const rad = (ant.angle * Math.PI) / 180;
  return {
    x: round(ant.x + Math.cos(rad) * along),
    y: round(ant.y + Math.sin(rad) * along),
    angle: Math.round(ant.angle + TURN * Math.sin(cycle / 2)),
  };
}
