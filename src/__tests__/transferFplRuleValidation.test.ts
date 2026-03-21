import fc from 'fast-check';
import type { Player, Position, Squad, SquadPlayer } from '../models';
import { validateTransfer } from '../domain/transferSuggester';

// ── Helpers ──────────────────────────────────────────────────────────

const POSITIONS: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];

/** Build a minimal Player object. */
function makePlayer(overrides: Partial<Player> & { id: number; teamId: number; position: Position }): Player {
  return {
    name: 'Player',
    totalPoints: 80,
    form: 5.0,
    cost: 60,
    ownershipPercentage: 10,
    minutesPlayed: 900,
    news: '',
    chanceOfPlaying: 100,
    gameweekPoints: [],
    ...overrides,
  };
}

/** Promote a Player to a SquadPlayer. */
function toSquadPlayer(
  player: Player,
  opts: { isBenched: boolean; benchOrder: number },
): SquadPlayer {
  return {
    ...player,
    isCaptain: false,
    isViceCaptain: false,
    isBenched: opts.isBenched,
    benchOrder: opts.benchOrder,
    sellingPrice: player.cost,
  };
}

/**
 * Build a valid 15-player squad: 2 GKP, 5 DEF, 5 MID, 3 FWD.
 * Starters: 1 GKP, 4 DEF, 4 MID, 2 FWD (11 total).
 * Bench: 1 GKP, 1 DEF, 1 MID, 1 FWD (4 total).
 *
 * teamIds is a 15-element array assigning a teamId to each slot.
 */
function buildSquad(teamIds: number[]): Squad {
  // Position layout: [GKP, GKP, DEF x5, MID x5, FWD x3]
  const positions: Position[] = [
    'GKP', 'GKP',
    'DEF', 'DEF', 'DEF', 'DEF', 'DEF',
    'MID', 'MID', 'MID', 'MID', 'MID',
    'FWD', 'FWD', 'FWD',
  ];

  // Starter flags — first of each group are starters
  // Starters: idx 0 (GKP), 2-5 (4 DEF), 7-10 (4 MID), 12-13 (2 FWD) = 11
  // Bench:    idx 1 (GKP), 6 (DEF), 11 (MID), 14 (FWD) = 4
  const benchIndices = new Set([1, 6, 11, 14]);

  let benchOrder = 1;
  const players: SquadPlayer[] = positions.map((pos, i) => {
    const isBenched = benchIndices.has(i);
    const bo = isBenched ? benchOrder++ : 0;
    return toSquadPlayer(
      makePlayer({ id: i + 1, teamId: teamIds[i], position: pos }),
      { isBenched, benchOrder: bo },
    );
  });

  return {
    players,
    budget: 100,
    freeTransfers: 1,
    activeChip: null,
  };
}

// ── Arbitraries ──────────────────────────────────────────────────────

/** Generate 15 teamIds where no team appears more than 3 times. */
const arbTeamIds: fc.Arbitrary<number[]> = fc
  .array(fc.integer({ min: 1, max: 20 }), { minLength: 15, maxLength: 15 })
  .filter((ids) => {
    const counts = new Map<number, number>();
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (counts.get(id)! > 3) return false;
    }
    return true;
  });

// ── Property Tests ───────────────────────────────────────────────────

describe('Property 14: Transfer FPL Rule Validation', () => {
  /**
   * For any squad and proposed transfer (player out, player in), if applying
   * the transfer would result in more than 3 players from one team or an
   * invalid formation, the transfer shall be marked as invalid.
   */

  it('detects team limit violation when a 4th player from the same team is brought in', () => {
    fc.assert(
      fc.property(
        arbTeamIds,
        fc.integer({ min: 0, max: 14 }), // index of player to transfer out
        (teamIds, outIdx) => {
          const squad = buildSquad(teamIds);
          const playerOut = squad.players[outIdx];

          // Find a teamId that already has exactly 3 players (excluding playerOut's team contribution)
          const counts = new Map<number, number>();
          for (const p of squad.players) {
            if (p.id !== playerOut.id) {
              counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
            }
          }

          // Pick a team that already has 3 players (after removing playerOut)
          let targetTeamId: number | null = null;
          for (const [tid, count] of counts) {
            if (count >= 3 && tid !== playerOut.teamId) {
              targetTeamId = tid;
              break;
            }
          }

          // If no team has 3 players after removing playerOut, skip this case
          if (targetTeamId === null) return;

          const playerIn = makePlayer({
            id: 999,
            teamId: targetTeamId,
            position: playerOut.position, // same position to isolate team-limit check
          });

          const result = validateTransfer(squad, playerOut, playerIn);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('3-player team limit');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('detects formation violation when a starter is replaced with a different position', () => {
    fc.assert(
      fc.property(
        arbTeamIds,
        (teamIds) => {
          const squad = buildSquad(teamIds);

          // Pick a starting FWD (index 12 or 13) — starters have exactly 2 FWD
          // Replacing one FWD starter with a MID drops FWD below minimum (1)
          // Actually we have 2 FWD starters, replacing one leaves 1 which is the minimum.
          // Instead, pick the starting GKP (index 0) — only 1 GKP starter.
          // Replacing GKP with a DEF drops GKP starters to 0 — invalid.
          const playerOut = squad.players[0]; // GKP starter

          // Use a unique teamId that won't violate the 3-player limit
          const usedTeams = new Map<number, number>();
          for (const p of squad.players) {
            if (p.id !== playerOut.id) {
              usedTeams.set(p.teamId, (usedTeams.get(p.teamId) ?? 0) + 1);
            }
          }
          let safeTeamId = 20;
          for (let t = 1; t <= 20; t++) {
            if ((usedTeams.get(t) ?? 0) < 3) {
              safeTeamId = t;
              break;
            }
          }

          const playerIn = makePlayer({
            id: 999,
            teamId: safeTeamId,
            position: 'DEF', // different from GKP
          });

          const result = validateTransfer(squad, playerOut, playerIn);
          expect(result.valid).toBe(false);
          expect(result.reason).toContain('Invalid formation');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('accepts valid transfers where position matches and team limit is respected', () => {
    fc.assert(
      fc.property(
        arbTeamIds,
        fc.integer({ min: 0, max: 14 }), // index of player to transfer out
        (teamIds, outIdx) => {
          const squad = buildSquad(teamIds);
          const playerOut = squad.players[outIdx];

          // Find a teamId that has room (fewer than 3 after removing playerOut)
          const counts = new Map<number, number>();
          for (const p of squad.players) {
            if (p.id !== playerOut.id) {
              counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
            }
          }

          let safeTeamId: number | null = null;
          for (let t = 1; t <= 20; t++) {
            if ((counts.get(t) ?? 0) < 3) {
              safeTeamId = t;
              break;
            }
          }

          // Should always find one since we have 20 teams and 14 remaining players
          if (safeTeamId === null) return;

          const playerIn = makePlayer({
            id: 999,
            teamId: safeTeamId,
            position: playerOut.position, // same position — no formation change
          });

          const result = validateTransfer(squad, playerOut, playerIn);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});
