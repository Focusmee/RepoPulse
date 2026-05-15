import { stableHash } from "../shared/text.js";

export async function fetchRepoDocuments({ client, repo, logger = console }) {
  let readmeText = "";
  let latestReleaseNotes = "";
  let readmeStatus = "ok";

  try {
    readmeText = await client.getReadme(repo.full_name);
  } catch (error) {
    readmeStatus = "failed";
    logger.warn?.(`README 获取失败 ${repo.full_name}: ${error.message}`);
  }

  try {
    const release = await client.getLatestRelease(repo.full_name);
    latestReleaseNotes = release?.body || release?.name || "";
  } catch {
    latestReleaseNotes = "";
  }

  return {
    repo_id: repo.repo_id,
    full_name: repo.full_name,
    readme_text: readmeText,
    latest_release_notes: latestReleaseNotes,
    readme_status: readmeStatus,
    document_hash: stableHash(`${readmeText}\n${latestReleaseNotes}`),
    last_fetched_at: new Date().toISOString()
  };
}
