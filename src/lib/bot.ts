import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createPostgresState } from "@chat-adapter/state-pg";
import { streamText, stepCountIs, gateway } from "ai";
import { toAiMessages } from "chat";
import { agentTools, setCurrentChatId } from "./agent/tools";
import { pool } from "@/db";

const SYSTEM_PROMPT = `You are a content management agent for a multilingual blog.
You can create blog posts, update translations, and manage content.

Available locales: en, es

IMPORTANT — Formatting rules for your responses:
- Do NOT use markdown formatting (no **bold**, no *italic*, no # headings)
- Use plain text only. Telegram does not render markdown.
- Use line breaks and dashes (-) for lists
- Use CAPS sparingly for emphasis when needed
- Keep responses concise and conversational

When creating blog posts:
- ALWAYS use draftBlogPost FIRST to show the user a preview
- Wait for the user to approve (e.g. "publish", "looks good", "go ahead") before calling createBlogPost
- If the user requests changes, create a new draft with the adjustments
- Write engaging, well-structured content in the requested language
- The MDX content itself should use proper markdown (headings, lists, code blocks) — that's for the web, not Telegram
- Choose descriptive slugs and relevant tags
- Always provide both a title and description

When generating images:
- Use generateBlogImage to create images for blog posts
- Generate images before or after drafting the post — the user can reference them in the content
- Provide a detailed prompt to get the best results from the image model

When updating translations:
- Maintain consistency with existing translation keys
- Use natural, fluent language for each locale
- Preserve ICU message format placeholders like {date} or {count}

After creating or updating content, always confirm what you did.
When you create a blog post, tell the user the post was committed and that you will notify them when the deployment finishes and the blog is live.`;

let _bot: Chat | null = null;

export function getBot() {
  if (!_bot) {
    _bot = new Chat({
      userName: "ai-blog-agent",
      adapters: {
        telegram: createTelegramAdapter(),
      },
      state: createPostgresState({ client: pool }),
      onLockConflict: "force",
    });

    _bot.onNewMention(async (thread, message) => {
      await thread.subscribe();
      await handleMessage(thread, message);
    });

    _bot.onSubscribedMessage(async (thread, message) => {
      await handleMessage(thread, message);
    });
  }

  return _bot;
}

async function handleMessage(
  thread: Parameters<Parameters<Chat["onNewMention"]>[0]>[0],
  _message: Parameters<Parameters<Chat["onNewMention"]>[0]>[1],
) {
  await thread.startTyping();

  // Extract the Telegram chat ID so the deployment workflow
  // can send notifications back to this conversation.
  const chatId = thread.channelId;
  setCurrentChatId(chatId);

  const messages = [];
  for await (const msg of thread.allMessages) {
    messages.push(msg);
  }
  const history = await toAiMessages(messages);

  const result = streamText({
    model: gateway("anthropic/claude-sonnet-4.5"),
    system: SYSTEM_PROMPT,
    messages: history,
    tools: agentTools,
    stopWhen: stepCountIs(10),
  });

  await thread.post(result.fullStream);
}
