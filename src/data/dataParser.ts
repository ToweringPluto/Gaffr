import type { BootstrapStatic, Team, Gameweek } from '../models/bootstrapStatic';
import type { Fixture } from '../models/fixture';
import type { ManagerSquad, Squad, SquadPlayer, ChipStatus } from '../models/squad';
import type { NewsItem, NewsSeverity } from '../models/news';
import type { Player, Position, GameweekPoints } from '../models/player';

export interface DataParser {
  parseBootstrap(json: unknown): BootstrapStatic;
  parseFixtures(json: unknown): Fixture[];
  parseManagerSquad(json: unknown): ManagerSquad;
  parseNewsItems(json: unknown): NewsItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = num(value, NaN);
  return Number.isNaN(n) ? null : n;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function obj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ── Position mapping ─────────────────────────────────────────────────

const POSITION_MAP: Record<number, Position> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

function toPosition(value: unknown): Position {
  return POSITION_MAP[num(value)] ?? 'MID';
}

// ── Severity mapping ─────────────────────────────────────────────────

function toSeverity(chanceOfPlaying: number | null, newsText: string): NewsSeverity {
  if (chanceOfPlaying === null || chanceOfPlaying === undefined) {
    return newsText ? 'injured_suspended' : 'available';
  }
  if (chanceOfPlaying >= 100) return 'available';
  if (chanceOfPlaying >= 75) return 'doubtful_75';
  if (chanceOfPlaying >= 50) return 'doubtful_50';
  if (chanceOfPlaying >= 25) return 'doubtful_25';
  return 'injured_suspended';
}

// ── Player parsing ───────────────────────────────────────────────────

function parsePlayer(raw: unknown): Player {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.web_name ?? r.name),
    teamId: num(r.team ?? r.teamId),
    position: toPosition(r.element_type ?? r.position),
    totalPoints: num(r.total_points ?? r.totalPoints),
    form: num(r.form),
    cost: num(r.now_cost ?? r.cost),
    ownershipPercentage: num(r.selected_by_percent ?? r.ownershipPercentage),
    minutesPlayed: num(r.minutes ?? r.minutesPlayed),
    news: str(r.news),
    chanceOfPlaying: nullableNum(r.chance_of_playing_next_round ?? r.chanceOfPlaying),
    gameweekPoints: arr(r.gameweekPoints).map(parseGameweekPoints),
  };
}

function parseGameweekPoints(raw: unknown): GameweekPoints {
  const r = obj(raw);
  return {
    gameweek: num(r.gameweek ?? r.round),
    points: num(r.points ?? r.total_points),
    minutes: num(r.minutes),
  };
}

// ── Team parsing ─────────────────────────────────────────────────────

function parseTeam(raw: unknown): Team {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name),
    shortName: str(r.short_name ?? r.shortName),
  };
}

// ── Gameweek parsing ─────────────────────────────────────────────────

function parseGameweek(raw: unknown): Gameweek {
  const r = obj(raw);
  return {
    id: num(r.id),
    name: str(r.name),
    deadlineTime: str(r.deadline_time ?? r.deadlineTime),
    finished: bool(r.finished),
    isCurrent: bool(r.is_current ?? r.isCurrent),
    isNext: bool(r.is_next ?? r.isNext),
  };
}

// ── Fixture parsing ──────────────────────────────────────────────────

function parseFixture(raw: unknown): Fixture {
  const r = obj(raw);
  return {
    id: num(r.id),
    gameweek: num(r.event ?? r.gameweek),
    homeTeamId: num(r.team_h ?? r.homeTeamId),
    awayTeamId: num(r.team_a ?? r.awayTeamId),
    homeTeamDifficulty: num(r.team_h_difficulty ?? r.homeTeamDifficulty),
    awayTeamDifficulty: num(r.team_a_difficulty ?? r.awayTeamDifficulty),
    kickoffTime: str(r.kickoff_time ?? r.kickoffTime),
    finished: bool(r.finished),
  };
}

// ── Squad parsing ────────────────────────────────────────────────────

function parseSquadPlayer(raw: unknown): SquadPlayer {
  const r = obj(raw);
  const base = parsePlayer(raw);
  return {
    ...base,
    isCaptain: bool(r.isCaptain ?? r.is_captain),
    isViceCaptain: bool(r.isViceCaptain ?? r.is_vice_captain),
    isBenched: bool(r.isBenched ?? r.is_benched),
    benchOrder: num(r.benchOrder ?? r.bench_order),
    sellingPrice: num(r.sellingPrice ?? r.selling_price),
  };
}

function parseChipStatus(raw: unknown): ChipStatus {
  const r = obj(raw);
  const chipName = str(r.chipName ?? r.chip_name ?? r.name) as ChipStatus['chipName'];
  return {
    chipName,
    used: bool(r.used),
    usedGameweek: nullableNum(r.usedGameweek ?? r.used_gameweek ?? r.event),
  };
}

function parseSquad(raw: unknown): Squad {
  const r = obj(raw);
  return {
    players: arr(r.players).map(parseSquadPlayer),
    budget: num(r.budget),
    freeTransfers: num(r.freeTransfers ?? r.free_transfers),
    activeChip: r.activeChip != null ? str(r.activeChip) : (r.active_chip != null ? str(r.active_chip) : null),
  };
}

// ── News parsing ─────────────────────────────────────────────────────

function parseNewsItem(raw: unknown): NewsItem {
  const r = obj(raw);
  const chanceOfPlaying = nullableNum(r.chanceOfPlaying ?? r.chance_of_playing);
  const content = str(r.content ?? r.news);
  const severity: NewsSeverity =
    (r.severity as NewsSeverity) ?? toSeverity(chanceOfPlaying, content);

  return {
    playerId: num(r.playerId ?? r.player_id ?? r.id),
    playerName: str(r.playerName ?? r.player_name ?? r.web_name),
    content,
    severity,
    source: (str(r.source) as NewsItem['source']) || 'fpl_api',
    timestamp: str(r.timestamp ?? r.date ?? new Date().toISOString()),
    ...(r.speakerName != null ? { speakerName: str(r.speakerName) } : {}),
    ...(r.speaker_name != null ? { speakerName: str(r.speaker_name) } : {}),
  };
}

// ── Public API ───────────────────────────────────────────────────────

export function createDataParser(): DataParser {
  return {
    parseBootstrap(json: unknown): BootstrapStatic {
      try {
        const r = obj(json);
        const gameweeks = arr(r.events ?? r.gameweeks).map(parseGameweek);
        const current = gameweeks.find((gw) => gw.isCurrent);
        const next = gameweeks.find((gw) => gw.isNext);

        return {
          players: arr(r.elements ?? r.players).map(parsePlayer),
          teams: arr(r.teams).map(parseTeam),
          gameweeks,
          currentGameweek: num(r.currentGameweek) || current?.id || next?.id || 1,
        };
      } catch {
        return { players: [], teams: [], gameweeks: [], currentGameweek: 1 };
      }
    },

    parseFixtures(json: unknown): Fixture[] {
      try {
        return arr(json).map(parseFixture);
      } catch {
        return [];
      }
    },

    parseManagerSquad(json: unknown): ManagerSquad {
      try {
        const r = obj(json);
        return {
          teamId: num(r.teamId ?? r.team_id ?? r.id),
          squad: parseSquad(r.squad ?? r),
          chipStatus: arr(r.chipStatus ?? r.chip_status ?? r.chips).map(parseChipStatus),
        };
      } catch {
        return {
          teamId: 0,
          squad: { players: [], budget: 0, freeTransfers: 0, activeChip: null },
          chipStatus: [],
        };
      }
    },

    parseNewsItems(json: unknown): NewsItem[] {
      try {
        return arr(json).map(parseNewsItem);
      } catch {
        return [];
      }
    },
  };
}
