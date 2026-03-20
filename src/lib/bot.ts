import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createPostgresState } from "@chat-adapter/state-pg";
import { streamText, stepCountIs, gateway } from "ai";
import { toAiMessages } from "chat";
import { agentTools, setCurrentChatId } from "./agent/tools";
import { pool } from "@/db";

const SYSTEM_PROMPT = `You are a concise content management agent for a multilingual blog.
Available locales: en, es

RULES:
- Be brief. No filler, no bullet lists of options, no "let me know if you need anything else."
- If the user's intent is clear, act immediately. Don't ask clarifying questions unless truly ambiguous.
- Do NOT use markdown formatting. Telegram renders plain text only. Use line breaks for structure.
- The MDX content you write for blog posts SHOULD use proper markdown (headings, lists, code blocks) — that's for the web.

BLOG POSTS:
- Use draftBlogPost first to preview, then createBlogPost after the user approves.
- If the user says "publish", "looks good", "go ahead", or similar — commit immediately.
- After committing, say it's done and that you'll notify them when it's deployed.

IMAGES:
- generateBlogImage creates an image and sends a preview photo to the chat.
- The image is also committed to the repo. If the user wants a different one, just regenerate (it overwrites).
- Write detailed, descriptive prompts for the image model.

TRANSLATIONS:
- Update keys directly. Preserve ICU placeholders like {date} or {count}.`;

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
