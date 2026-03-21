import type { BootstrapStatic } from '../models/bootstrapStatic';
import type { Fixture } from '../models/fixture';
import type { ManagerSquad } from '../models/squad';
import type { ManagerHistory } from '../models/managerHistory';
import type { LeagueStandings } from '../models/leagueStandings';
import type { GameweekLive } from '../models/gameweekLive';
import type { ManagerPicks } from '../models/managerPicks';

const BASE_URL = process.env.BASE_URL;
const TIMEOUT_MS = 10_000;

export interface FplApiClient {
  getBootstrapStatic(): Promise<BootstrapStatic>;
  getFixtures(): Promise<Fixture[]>;
  getManagerSquad(teamId: number): Promise<ManagerSquad>;
  getManagerHistory(teamId: number): Promise<ManagerHistory>;
  getLeagueStandings(leagueId: number): Promise<LeagueStandings>;
  getGameweekLive(gameweek: number): Promise<GameweekLive>;
  getManagerPicks(teamId: number, gameweek: number): Promise<ManagerPicks>;
}

export class FplApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'FplApiError';
  }
}

/**
 * Fetch with a 10-second AbortController timeout.
 * Throws FplApiError on network failure, timeout, or non-2xx status.
 */
async function fetchWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new FplApiError(
        `FPL API returned ${response.status}`,
        response.status,
        url,
      );
    }

    return await response.json();
  } catch (error: unknown) {
    if (error instanceof FplApiError) throw error;

    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? `FPL API request timed out after ${TIMEOUT_MS}ms`
        : `FPL API request failed: ${error instanceof Error ? error.message : String(error)}`;

    throw new FplApiError(message, undefined, url);
  } finally {
    clearTimeout(timer);
  }
}

export function createFplApiClient(): FplApiClient {
  return {
    async getBootstrapStatic(): Promise<BootstrapStatic> {
      return fetchWithTimeout(`${BASE_URL}/bootstrap-static/`) as Promise<BootstrapStatic>;
    },

    async getFixtures(): Promise<Fixture[]> {
      return fetchWithTimeout(`${BASE_URL}/fixtures/`) as Promise<Fixture[]>;
    },

    async getManagerSquad(teamId: number): Promise<ManagerSquad> {
      return fetchWithTimeout(`${BASE_URL}/entry/${teamId}/`) as Promise<ManagerSquad>;
    },

    async getManagerHistory(teamId: number): Promise<ManagerHistory> {
      return fetchWithTimeout(`${BASE_URL}/entry/${teamId}/history/`) as Promise<ManagerHistory>;
    },

    async getLeagueStandings(leagueId: number): Promise<LeagueStandings> {
      return fetchWithTimeout(
        `${BASE_URL}/leagues-classic/${leagueId}/standings/`,
      ) as Promise<LeagueStandings>;
    },

    async getGameweekLive(gameweek: number): Promise<GameweekLive> {
      return fetchWithTimeout(`${BASE_URL}/event/${gameweek}/live/`) as Promise<GameweekLive>;
    },

    async getManagerPicks(teamId: number, gameweek: number): Promise<ManagerPicks> {
      return fetchWithTimeout(
        `${BASE_URL}/entry/${teamId}/event/${gameweek}/picks/`,
      ) as Promise<ManagerPicks>;
    },
  };
}
