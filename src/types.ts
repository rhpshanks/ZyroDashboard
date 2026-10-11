export interface Game {
  id: string;
  name: string;
  short: string;
  genre: string;
  package: string;
  icon?: string;
}

export interface Entry {
  date: string;
  spend: number;
  revenue: number;
  game?: string;
  installs?: number;
  note?: string;
}

export interface Settings {
  pkrPerUsd: number;
  monthlyProfitGoal: number;
  monthlySpendBudget: number;
}

export interface Dataset {
  studio: string;
  playStoreUrl: string;
  settings: Settings;
  games: Game[];
  entries: Entry[];
}

export interface DayRow {
  date: string;
  /** At least one entry exists for this day. */
  has: boolean;
  spend: number;
  revenue: number;
  net: number;
  installs: number;
  hasInstalls: boolean;
  entries: Entry[];
}

export type Gran = 'day' | 'week' | 'month';

export interface Bucket {
  key: string;
  start: string;
  end: string;
  spend: number;
  revenue: number;
  net: number;
  installs: number;
  has: boolean;
  tracked: number;
}
