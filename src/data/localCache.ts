import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BootstrapStatic } from '../models/bootstrapStatic';
import type { Fixture } from '../models/fixture';
import type { ManagerSquad } from '../models/squad';
import type { NewsItem } from '../models/news';

export interface LocalCache {
  getBootstrap(): Promise<BootstrapStatic | null>;
  setBootstrap(data: BootstrapStatic): Promise<void>;
  getFixtures(): Promise<Fixture[] | null>;
  setFixtures(data: Fixture[]): Promise<void>;
  getManagerSquad(): Promise<ManagerSquad | null>;
  setManagerSquad(data: ManagerSquad): Promise<void>;
  getLastRefreshTime(): Promise<Date | null>;
  setLastRefreshTime(time: Date): Promise<void>;
  getTeamId(): Promise<number | null>;
  setTeamId(id: number): Promise<void>;
}

const KEYS = {
  bootstrap: '@gaffr/bootstrap',
  fixtures: '@gaffr/fixtures',
  managerSquad: '@gaffr/manager-squad',
  lastRefresh: '@gaffr/last-refresh',
  teamId: '@gaffr/team-id',
} as const;

async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function createLocalCache(): LocalCache {
  return {
    getBootstrap: () => getJSON<BootstrapStatic>(KEYS.bootstrap),
    setBootstrap: (data) => setJSON(KEYS.bootstrap, data),

    getFixtures: () => getJSON<Fixture[]>(KEYS.fixtures),
    setFixtures: (data) => setJSON(KEYS.fixtures, data),

    getManagerSquad: () => getJSON<ManagerSquad>(KEYS.managerSquad),
    setManagerSquad: (data) => setJSON(KEYS.managerSquad, data),

    async getLastRefreshTime(): Promise<Date | null> {
      const raw = await AsyncStorage.getItem(KEYS.lastRefresh);
      if (raw === null) return null;
      const date = new Date(raw);
      return isNaN(date.getTime()) ? null : date;
    },
    async setLastRefreshTime(time: Date): Promise<void> {
      await AsyncStorage.setItem(KEYS.lastRefresh, time.toISOString());
    },

    async getTeamId(): Promise<number | null> {
      const raw = await AsyncStorage.getItem(KEYS.teamId);
      if (raw === null) return null;
      const id = Number(raw);
      return isNaN(id) ? null : id;
    },
    async setTeamId(id: number): Promise<void> {
      await AsyncStorage.setItem(KEYS.teamId, String(id));
    },
  };
}
