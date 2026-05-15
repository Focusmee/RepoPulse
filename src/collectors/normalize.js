export function normalizeRepoFromApi(repo, sourceTags = []) {
  if (!repo?.id || !repo.full_name) return null;
  return {
    repo_id: repo.id,
    owner: repo.owner?.login || repo.full_name.split("/")[0],
    name: repo.name || repo.full_name.split("/")[1],
    full_name: repo.full_name,
    description: repo.description || "",
    language: repo.language || "",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    license: repo.license?.spdx_id || repo.license?.key || "",
    html_url: repo.html_url || `https://github.com/${repo.full_name}`,
    created_at: repo.created_at || "",
    pushed_at: repo.pushed_at || "",
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    private: Boolean(repo.private),
    stars: Number(repo.stargazers_count || repo.stars || 0),
    forks: Number(repo.forks_count || repo.forks || 0),
    open_issues: Number(repo.open_issues_count || repo.open_issues || 0),
    watchers: Number(repo.watchers_count || repo.watchers || 0),
    source_tags: Array.from(new Set(sourceTags.filter(Boolean)))
  };
}

export function mergeCandidates(candidates) {
  const byFullName = new Map();
  for (const candidate of candidates.filter(Boolean)) {
    const key = candidate.full_name?.toLowerCase();
    if (!key) continue;
    const existing = byFullName.get(key) || {};
    byFullName.set(key, {
      ...existing,
      ...candidate,
      source_tags: Array.from(new Set([...(existing.source_tags || []), ...(candidate.source_tags || [])]))
    });
  }
  return Array.from(byFullName.values());
}
