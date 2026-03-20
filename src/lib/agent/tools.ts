import { tool } from "ai";
import { z } from "zod";
import { start } from "workflow/api";
import { assertAllowedPath } from "./sandbox";
import {
  createOrUpdateFile,
  getFileContent,
  listFiles,
} from "@/lib/github";
import { notifyDeployment } from "@/workflows/notify-deployment";

// Set by the bot before invoking the agent, so the workflow
// can send deployment notifications back to the right chat.
let _currentChatId: string | null = null;

export function setCurrentChatId(chatId: string) {
  _currentChatId = chatId;
}

export const agentTools = {
  createBlogPost: tool({
    description:
      "Create a new blog post as an MDX file. The content should be valid MDX with frontmatter (title, description, date, tags).",
    inputSchema: z.object({
      locale: z
        .enum(["en", "es"])
        .describe("The locale/language for the blog post"),
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe("URL-friendly slug (lowercase, hyphens only)"),
      title: z.string().describe("The blog post title"),
      description: z.string().describe("A short summary of the post"),
      tags: z.array(z.string()).describe("Tags for the post"),
      content: z.string().describe("The MDX body content (no frontmatter)"),
    }),
    execute: async ({ locale, slug, title, description, tags, content }) => {
      const filePath = `content/blog/${locale}/${slug}.mdx`;
      assertAllowedPath(filePath);

      const date = new Date().toISOString().split("T")[0];
      const frontmatter = [
        "---",
        `title: "${title}"`,
        `description: "${description}"`,
        `date: "${date}"`,
        `tags: [${tags.map((t) => `"${t}"`).join(", ")}]`,
        "---",
      ].join("\n");

      const fullContent = `${frontmatter}\n\n${content}\n`;

      await createOrUpdateFile(
        filePath,
        fullContent,
        `blog: add ${slug} (${locale})`,
      );

      // Fire-and-forget: workflow watches deployment and notifies the chat
      if (_currentChatId) {
        await start(notifyDeployment, [{ chatId: _currentChatId, locale, slug }]);
      }

      const siteUrl = process.env.SITE_URL ?? "https://your-site.vercel.app";
      return {
        success: true,
        path: filePath,
        date,
        message: `Post committed. You'll get a notification when it's live at ${siteUrl}/${locale}/blog/${slug}`,
      };
    },
  }),

  updateTranslation: tool({
    description:
      "Update or add a translation key in a locale's message file. Use dot notation for nested keys (e.g. 'blog.readMore').",
    inputSchema: z.object({
      locale: z.enum(["en", "es"]).describe("The locale to update"),
      key: z.string().describe("Dot-notation key (e.g. 'blog.newKey')"),
      value: z.string().describe("The translated string value"),
    }),
    execute: async ({ locale, key, value }) => {
      const filePath = `messages/${locale}.json`;
      assertAllowedPath(filePath);

      const existing = await getFileContent(filePath);
      const messages = existing ? JSON.parse(existing) : {};

      const parts = key.split(".");
      let current: Record<string, unknown> = messages;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;

      await createOrUpdateFile(
        filePath,
        JSON.stringify(messages, null, 2) + "\n",
        `i18n: update ${key} (${locale})`,
      );

      return { success: true, key, locale };
    },
  }),

  listBlogPosts: tool({
    description: "List all blog post files for a given locale.",
    inputSchema: z.object({
      locale: z.enum(["en", "es"]).describe("The locale to list posts for"),
    }),
    execute: async ({ locale }) => {
      const files = await listFiles(`content/blog/${locale}`);
      return {
        posts: files
          .filter((f) => f.endsWith(".mdx"))
          .map((f) =>
            f.replace(/^content\/blog\/[a-z]{2}\//, "").replace(/\.mdx$/, ""),
          ),
      };
    },
  }),

  getBlogPost: tool({
    description: "Read the full content of an existing blog post.",
    inputSchema: z.object({
      locale: z.enum(["en", "es"]).describe("The locale of the post"),
      slug: z.string().describe("The post slug"),
    }),
    execute: async ({ locale, slug }) => {
      const filePath = `content/blog/${locale}/${slug}.mdx`;
      const content = await getFileContent(filePath);
      if (!content) {
        return { error: `Post not found: ${filePath}` };
      }
      return { content };
    },
  }),

  getTranslations: tool({
    description: "Read the current translation file for a locale.",
    inputSchema: z.object({
      locale: z
        .enum(["en", "es"])
        .describe("The locale to read translations for"),
    }),
    execute: async ({ locale }) => {
      const filePath = `messages/${locale}.json`;
      const content = await getFileContent(filePath);
      if (!content) {
        return { error: `Translation file not found: ${filePath}` };
      }
      return { messages: JSON.parse(content) };
    },
  }),
};
