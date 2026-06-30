export function chartHasNoData(data: Record<string, unknown>[], dataKey: string): boolean {
  return data.length === 0 || data.every((row) => Number(row[dataKey] ?? 0) === 0);
}
