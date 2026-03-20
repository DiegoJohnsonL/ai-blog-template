import { Octokit } from "@octokit/rest";

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

function getRepoConfig() {
  return {
    owner: process.env.GITHUB_OWNER!,
    repo: process.env.GITHUB_REPO!,
    branch: process.env.GITHUB_BRANCH ?? "main",
  };
}

export async function getFileContent(
  filePath: string,
): Promise<string | null> {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepoConfig();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });

    if ("content" in data) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

export async function createOrUpdateFile(
  filePath: string,
  content: string,
  message: string,
  isBase64 = false,
): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepoConfig();

  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    });
    if ("sha" in data) {
      sha = data.sha;
    }
  } catch {
    // File doesn't exist yet — creating new
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message,
    content: isBase64 ? content : Buffer.from(content).toString("base64"),
    branch,
    ...(sha ? { sha } : {}),
  });
}

export async function listFiles(dirPath: string): Promise<string[]> {
  const octokit = getOctokit();
  const { owner, repo, branch } = getRepoConfig();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: dirPath,
      ref: branch,
    });

    if (Array.isArray(data)) {
      return data.map((f) => f.path);
    }
    return [];
  } catch {
    return [];
  }
}
