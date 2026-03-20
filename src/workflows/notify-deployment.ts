import { sleep } from "workflow";
import { FatalError } from "workflow";

interface NotifyDeploymentInput {
  chatId: string;
  locale: string;
  slug: string;
}

export async function notifyDeployment(input: NotifyDeploymentInput) {
  "use workflow";

  // Give Vercel time to pick up the commit and start building
  await sleep("30s");

  // Poll deployment status (up to 18 attempts = ~3 minutes)
  for (let attempt = 0; attempt < 18; attempt++) {
    const status = await checkDeploymentStatus();

    if (status.state === "success" || status.state === "ready") {
      const siteUrl = process.env.SITE_URL ?? status.environmentUrl;
      const blogUrl = `${siteUrl}/${input.locale}/blog/${input.slug}`;
      await sendTelegramMessage(
        input.chatId,
        `Your blog post is live! Check it out:\n${blogUrl}`,
      );
      return { success: true, url: blogUrl };
    }

    if (status.state === "failure" || status.state === "error") {
      await sendTelegramMessage(
        input.chatId,
        `Deployment failed: ${status.description ?? "unknown error"}. Check Vercel dashboard.`,
      );
      return { success: false, state: status.state };
    }

    await sleep("10s");
  }

  // Timed out — send the URL anyway since it likely deployed
  const siteUrl = process.env.SITE_URL ?? "https://ai-blog-template.vercel.app";
  const blogUrl = `${siteUrl}/${input.locale}/blog/${input.slug}`;
  await sendTelegramMessage(
    input.chatId,
    `Deployment status check timed out, but the post should be live:\n${blogUrl}`,
  );
  return { success: false, state: "timeout" };
}

interface DeployStatus {
  state: string;
  environmentUrl: string | null;
  description: string | null;
}

async function checkDeploymentStatus(): Promise<DeployStatus> {
  "use step";

  const { Octokit } = await import("@octokit/rest");
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;

  // Don't filter by ref — Vercel may register the deployment
  // under the commit SHA rather than the branch name.
  const { data: deployments } = await octokit.repos.listDeployments({
    owner,
    repo,
    per_page: 5,
    sort: "created_at",
    direction: "desc",
  });

  if (deployments.length === 0) {
    return { state: "pending", environmentUrl: null, description: null };
  }

  // Find the most recent deployment that's either in progress or just finished.
  // Skip "inactive" deployments — those are old ones replaced by Vercel.
  for (const deployment of deployments) {
    const { data: statuses } = await octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deployment.id,
      per_page: 1,
    });

    if (statuses.length === 0) {
      // Deployment exists but no status yet — it's being set up
      return { state: "pending", environmentUrl: null, description: null };
    }

    const latest = statuses[0];

    // Skip inactive (replaced) deployments
    if (latest.state === "inactive") {
      continue;
    }

    return {
      state: latest.state,
      environmentUrl: latest.environment_url || null,
      description: latest.description || null,
    };
  }

  // All deployments are inactive — new one hasn't appeared yet
  return { state: "pending", environmentUrl: null, description: null };
}

async function sendTelegramMessage(chatId: string, text: string) {
  "use step";

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new FatalError("TELEGRAM_BOT_TOKEN is not set");
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${body}`);
  }
}
