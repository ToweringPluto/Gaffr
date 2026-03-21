import type { BootstrapStatic } from '../models/bootstrapStatic';
import type { Fixture } from '../models/fixture';
import type { ManagerSquad } from '../models/squad';
import type { NewsItem } from '../models/news';

export interface DataFormatter {
  formatBootstrap(data: BootstrapStatic): string;
  formatFixtures(data: Fixture[]): string;
  formatManagerSquad(data: ManagerSquad): string;
  formatNewsItems(data: NewsItem[]): string;
}

export function createDataFormatter(): DataFormatter {
  return {
    formatBootstrap(data: BootstrapStatic): string {
      return JSON.stringify(data);
    },

    formatFixtures(data: Fixture[]): string {
      return JSON.stringify(data);
    },

    formatManagerSquad(data: ManagerSquad): string {
      return JSON.stringify(data);
    },

    formatNewsItems(data: NewsItem[]): string {
      return JSON.stringify(data);
    },
  };
}
