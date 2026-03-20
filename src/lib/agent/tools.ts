import { tool, generateImage, gateway } from "ai";
import { z } from "zod";
import { start } from "workflow/api";
import { assertAllowedPath } from "./sandbox";
import {
  createOrUpdateFile,
  getFileContent,
  listFiles,
} from "@/lib/github";
import { notifyDeployment } from "@/workflows/notify-deployment";
import { sendTelegramPhoto } from "@/lib/telegram";

// Set by the bot before invoking the agent, so the workflow
// can send deployment notifications back to the right chat.
let _currentChatId: string | null = null;

export function setCurrentChatId(chatId: string) {
  _currentChatId = chatId;
}

export const agentTools = {
  draftBlogPost: tool({
    description:
      "Show the user a draft of a blog post before publishing. Use this FIRST when asked to write a blog post, so the user can review and approve before committing. Returns the full content as text for the user to read in chat.",
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
      const date = new Date().toISOString().split("T")[0];

      return {
        draft: true,
        locale,
        slug,
        title,
        description,
        date,
        tags,
        content,
        message:
          "Here is your draft. Reply with 'publish' to commit it, or tell me what to change.",
      };
    },
  }),

  createBlogPost: tool({
    description:
      "Publish a blog post by committing an MDX file to the repository. Only use this AFTER the user has approved a draft via draftBlogPost.",
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

      if (_currentChatId) {
        await start(notifyDeployment, [
          { chatId: _currentChatId, locale, slug },
        ]);
      }

      const siteUrl = process.env.SITE_URL ?? "https://your-site.vercel.app";
      return {
        success: true,
        path: filePath,
        date,
        message: `Post committed. I'll notify you when it's live at ${siteUrl}/${locale}/blog/${slug}`,
      };
    },
  }),

  generateBlogImage: tool({
    description:
      "Generate an image for a blog post using AI and commit it to the repository. Returns the image path that can be used in MDX content as ![alt](/images/blog/filename.png).",
    inputSchema: z.object({
      prompt: z.string().describe("Detailed description of the image to generate"),
      filename: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe("Filename without extension (lowercase, hyphens only)"),
      size: z
        .enum(["1024x1024", "1360x768", "768x1360", "1152x864", "864x1152"])
        .default("1360x768")
        .describe("Image size (landscape 1360x768, portrait 768x1360, square 1024x1024, 4:3 1152x864)"),
    }),
    execute: async ({ prompt, filename, size }) => {
      const filePath = `public/images/blog/${filename}.png`;
      assertAllowedPath(filePath);

      const { image } = await generateImage({
        model: gateway.image("bfl/flux-2-pro"),
        prompt,
        size,
      });

      // Send photo preview to Telegram so the user can see it
      if (_currentChatId) {
        await sendTelegramPhoto(
          _currentChatId,
          image.base64,
          `Generated: ${filename}.png`,
        );
      }

      await createOrUpdateFile(
        filePath,
        image.base64,
        `blog: add image ${filename}.png`,
        true,
      );

      return {
        success: true,
        path: `/images/blog/${filename}.png`,
        mdxUsage: `![${prompt}](/images/blog/${filename}.png)`,
        message: `Image generated and committed. A preview was sent above. Use in MDX: ![alt](/images/blog/${filename}.png). If you don't like it, ask me to regenerate.`,
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
