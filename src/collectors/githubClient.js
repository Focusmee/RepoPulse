import { normalizeRepoFromApi } from "./normalize.js";

const GITHUB_API = "https://api.github.com";

export class GitHubClient {
  constructor({ token = "", userAgent = "RepoPulse/0.1" } = {}) {
    this.token = token;
    this.userAgent = userAgent;
  }

  async requestJson(path, { query = {}, accept = "application/vnd.github+json" } = {}) {
    const url = new URL(path.startsWith("http") ? path : `${GITHUB_API}${path}`);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: this.headers(accept)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub API ${response.status} ${response.statusText}: ${body.slice(0, 240)}`);
    }

    return response.json();
  }

  async requestText(urlOrPath, { accept = "text/plain" } = {}) {
    const url = urlOrPath.startsWith("http") ? urlOrPath : `${GITHUB_API}${urlOrPath}`;
    const response = await fetch(url, {
      headers: this.headers(accept)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GitHub text request ${response.status} ${response.statusText}: ${body.slice(0, 240)}`);
    }
    return response.text();
  }

  async searchRepositories(query, { perPage = 20, sort = "stars", order = "desc" } = {}) {
    const payload = await this.requestJson("/search/repositories", {
      query: {
        q: query,
        sort,
        order,
        per_page: perPage
      }
    });
    return (payload.items || []).map((repo) => normalizeRepoFromApi(repo, [`search:${query}`])).filter(Boolean);
  }

  async getRepo(fullName, sourceTags = []) {
    const repo = await this.requestJson(`/repos/${fullName}`);
    return normalizeRepoFromApi(repo, sourceTags);
  }

  async getReadme(fullName) {
    return this.requestText(`/repos/${fullName}/readme`, {
      accept: "application/vnd.github.raw"
    });
  }

  async getLatestRelease(fullName) {
    try {
      return await this.requestJson(`/repos/${fullName}/releases/latest`);
    } catch {
      return null;
    }
  }

  headers(accept) {
    const headers = {
      Accept: accept,
      "User-Agent": this.userAgent,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }
}
