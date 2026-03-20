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
  await sleep("20s");

  // Poll deployment status (up to 12 attempts = ~2 minutes)
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await checkDeploymentStatus();

    if (status.state === "success") {
      const siteUrl = process.env.SITE_URL ?? status.environmentUrl;
      const blogUrl = `${siteUrl}/${input.locale}/blog/${input.slug}`;
      await sendTelegramMessage(input.chatId, blogUrl);
      return { success: true, url: blogUrl };
    }

    if (status.state === "failure" || status.state === "error") {
      await sendTelegramMessage(
        input.chatId,
        `⚠️ Deployment failed: ${status.description ?? "unknown error"}`,
      );
      return { success: false, state: status.state };
    }

    await sleep("10s");
  }

  // Timed out
  await sendTelegramMessage(
    input.chatId,
    "⏳ Deployment is taking longer than expected. Check Vercel dashboard.",
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
  const branch = process.env.GITHUB_BRANCH ?? "main";

  const { data: deployments } = await octokit.repos.listDeployments({
    owner,
    repo,
    ref: branch,
    per_page: 1,
  });

  if (deployments.length === 0) {
    return { state: "pending", environmentUrl: null, description: null };
  }

  const { data: statuses } = await octokit.repos.listDeploymentStatuses({
    owner,
    repo,
    deployment_id: deployments[0].id,
    per_page: 1,
  });

  if (statuses.length === 0) {
    return { state: "pending", environmentUrl: null, description: null };
  }

  return {
    state: statuses[0].state,
    environmentUrl: statuses[0].environment_url || null,
    description: statuses[0].description || null,
  };
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
        parse_mode: "HTML",
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${body}`);
  }
}
