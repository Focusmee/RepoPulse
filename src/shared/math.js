export function clamp(value, min = 0, max = 100) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function normalizeByMax(values) {
  const valid = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const max = Math.max(...valid, 0);
  if (max <= 0) return values.map(() => 0);
  return valid.map((value) => clamp((value / max) * 100));
}

export function logScore(value, maxValue = 10_000) {
  const safeValue = Math.max(0, value || 0);
  return clamp((Math.log10(safeValue + 1) / Math.log10(maxValue + 1)) * 100);
}
