const DEFAULT_DOCUMENT_TTL_HOURS = 72;

export function shouldReuseDocument(existing, repo, { ttlHours = DEFAULT_DOCUMENT_TTL_HOURS, now = new Date() } = {}) {
  if (!existing?.readme_text || !existing?.last_fetched_at) return false;

  const fetchedAt = new Date(existing.last_fetched_at);
  if (Number.isNaN(fetchedAt.getTime())) return false;

  const pushedAt = repo?.pushed_at ? new Date(repo.pushed_at) : null;
  if (pushedAt && !Number.isNaN(pushedAt.getTime()) && pushedAt > fetchedAt) return false;

  const ttlMs = Number(ttlHours) * 60 * 60 * 1000;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;

  return now.getTime() - fetchedAt.getTime() <= ttlMs;
}

export { DEFAULT_DOCUMENT_TTL_HOURS };
