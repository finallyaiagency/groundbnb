export type ForecastInputs = {
  remainingCredits: number | null;
  fiveHourCapacity: number | null;
  weeklyCapacity: number | null;
  dwellSamples: number[];
  waitHours: number;
  now: Date;
};

export type Scenario = {
  capacityPerWeek: number;
  days: number;
  date: string;
  limiter: 'Five-hour window' | 'Weekly allowance';
};

export function median(values: number[]): number | null {
  const clean = values.filter(x => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

export function scenario(input: ForecastInputs, dwellHours: number): Scenario | null {
  const { remainingCredits, fiveHourCapacity, weeklyCapacity, waitHours, now } = input;
  if (remainingCredits === null || fiveHourCapacity === null || weeklyCapacity === null ||
      remainingCredits < 0 || fiveHourCapacity <= 0 || weeklyCapacity <= 0 ||
      !Number.isFinite(dwellHours) || dwellHours < 0 || waitHours < 0) return null;
  const fiveHourWeekly = fiveHourCapacity * 168 / (5 + dwellHours);
  const capacityPerWeek = Math.min(weeklyCapacity, fiveHourWeekly);
  const days = remainingCredits / capacityPerWeek * 7 + waitHours / 24;
  const date = new Date(now.getTime() + days * 86400000).toISOString();
  return { capacityPerWeek, days, date, limiter: weeklyCapacity <= fiveHourWeekly ? 'Weekly allowance' : 'Five-hour window' };
}

export function forecast(input: ForecastInputs) {
  const minimum = scenario(input, 0);
  const observedDwell = input.dwellSamples.length >= 3 ? median(input.dwellSamples) : null;
  const consistent = observedDwell === null ? null : scenario(input, observedDwell);
  const windows = input.remainingCredits !== null && input.fiveHourCapacity && input.fiveHourCapacity > 0
    ? Math.ceil(input.remainingCredits / input.fiveHourCapacity) : null;
  return { minimum, consistent, observedDwell, windows, dwellSampleSize: input.dwellSamples.length };
}
