export function preventiveDates(first: string, frequencyMonths: number, from: string, through: string) {
  if (!Number.isInteger(frequencyMonths) || frequencyMonths < 1 || from > through) return [];
  const [year, month, day] = first.split('-').map(Number);
  const startMonth = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1;
  const anchorMonth = year * 12 + month - 1;
  const firstCycle = Math.max(0, Math.floor((startMonth - anchorMonth) / frequencyMonths));
  const dates: string[] = [];

  for (let cycle = firstCycle; ; cycle++) {
    const monthIndex = month - 1 + cycle * frequencyMonths;
    const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const date = new Date(Date.UTC(year, monthIndex, Math.min(day, monthEnd))).toISOString().slice(0, 10);
    if (date > through) return dates;
    if (date >= from) dates.push(date);
  }
}
