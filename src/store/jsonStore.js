import { resolve } from "node:path";
import { readJson, writeJsonAtomic } from "../shared/fs.js";
import { addDays } from "../shared/date.js";

const EMPTY_STORE = {
  schemaVersion: "1.0",
  repos: {},
  snapshots: {},
  documents: {},
  analyses: {},
  reports: {}
};

export class JsonStore {
  constructor(path = "data/repopulse.store.json") {
    this.path = resolve(path);
    this.data = structuredClone(EMPTY_STORE);
  }

  async load() {
    this.data = await readJson(this.path, structuredClone(EMPTY_STORE));
    this.data.schemaVersion ||= "1.0";
    this.data.repos ||= {};
    this.data.snapshots ||= {};
    this.data.documents ||= {};
    this.data.analyses ||= {};
    this.data.reports ||= {};
    return this;
  }

  async save() {
    await writeJsonAtomic(this.path, this.data);
  }

  upsertRepo(repo) {
    const key = String(repo.repo_id);
    const existing = this.data.repos[key] || {};
    this.data.repos[key] = {
      ...existing,
      ...repo,
      source_tags: mergeUnique(existing.source_tags, repo.source_tags),
      first_seen_at: existing.first_seen_at || repo.first_seen_at
    };
    return this.data.repos[key];
  }

  upsertRepos(repos) {
    return repos.map((repo) => this.upsertRepo(repo));
  }

  upsertSnapshot(snapshot) {
    const key = snapshotKey(snapshot.repo_id, snapshot.snapshot_date);
    this.data.snapshots[key] = {
      ...(this.data.snapshots[key] || {}),
      ...snapshot
    };
    return this.data.snapshots[key];
  }

  getSnapshot(repoId, date) {
    return this.data.snapshots[snapshotKey(repoId, date)] || null;
  }

  findSnapshotOnOrBefore(repoId, date, maxDaysBack = 10) {
    for (let offset = 0; offset <= maxDaysBack; offset += 1) {
      const snapshot = this.getSnapshot(repoId, addDays(date, -offset));
      if (snapshot) return snapshot;
    }
    return null;
  }

  upsertDocument(document) {
    const key = String(document.repo_id);
    this.data.documents[key] = {
      ...(this.data.documents[key] || {}),
      ...document
    };
    return this.data.documents[key];
  }

  getDocument(repoId) {
    return this.data.documents[String(repoId)] || null;
  }

  upsertAnalysis(analysis) {
    const key = analysisKey(analysis.repo_id, analysis.analysis_date, analysis.profile_id);
    this.data.analyses[key] = {
      ...(this.data.analyses[key] || {}),
      ...analysis
    };
    return this.data.analyses[key];
  }

  getAnalysis(repoId, date, profileId) {
    return this.data.analyses[analysisKey(repoId, date, profileId)] || null;
  }

  upsertReport(report) {
    const key = reportKey(report.report_date, report.profile_id);
    this.data.reports[key] = {
      ...(this.data.reports[key] || {}),
      ...report
    };
    return this.data.reports[key];
  }

  getRecentReportRepoIds(profileId, beforeDate, days = 7) {
    const result = new Set();
    for (let offset = 1; offset <= days; offset += 1) {
      const report = this.data.reports[reportKey(addDays(beforeDate, -offset), profileId)];
      for (const item of report?.items_json || []) {
        if (item.repo?.repo_id) result.add(String(item.repo.repo_id));
      }
    }
    return result;
  }
}

export function snapshotKey(repoId, date) {
  return `${repoId}:${date}`;
}

export function analysisKey(repoId, date, profileId) {
  return `${repoId}:${date}:${profileId}`;
}

export function reportKey(date, profileId) {
  return `${date}:${profileId}`;
}

function mergeUnique(a = [], b = []) {
  return Array.from(new Set([...(a || []), ...(b || [])].filter(Boolean)));
}
