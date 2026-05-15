import { createHash } from "node:crypto";

export function stableHash(text) {
  return createHash("sha256").update(text || "").digest("hex");
}

export function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function truncate(text, maxLength = 240) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function includesAny(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
}

export function countMatches(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(String(term).toLowerCase()) ? 1 : 0), 0);
}

export function firstUsefulParagraph(markdown) {
  const lines = String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("!"))
    .filter((line) => !line.startsWith("[!"));

  return truncate(lines.find((line) => line.length >= 30) || lines[0] || "", 220);
}

export function extractHeadings(markdown, limit = 8) {
  return String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/)?.[2]?.trim())
    .filter(Boolean)
    .slice(0, limit);
}
