import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createPostgresState } from "@chat-adapter/state-pg";
import { streamText, stepCountIs, gateway, type ModelMessage } from "ai";
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

const MAX_HISTORY_MESSAGES = 40;

interface ThreadState {
  aiMessages?: ModelMessage[];
}

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
      // Clear any stale history on first mention
      await thread.setState({ aiMessages: [] }, { replace: true });
      await handleMessage(thread, message);
    });

    _bot.onSubscribedMessage(async (thread, message) => {
      if (message.text.trim().toLowerCase() === "/new") {
        await thread.unsubscribe();
        await thread.setState({ aiMessages: [] }, { replace: true });
        await thread.post(
          "Conversation cleared. Send a new message to start fresh.",
        );
        return;
      }
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

  // Load full AI message history (includes tool calls/results)
  const state = (await thread.state) as ThreadState | null;
  const previousMessages: ModelMessage[] = state?.aiMessages ?? [];

  // Add the new user message
  const userMessage: ModelMessage = {
    role: "user",
    content: _message.text,
  };

  const allMessages = [...previousMessages, userMessage];

  const result = streamText({
    model: gateway("openai/gpt-5-mini"),
    system: SYSTEM_PROMPT,
    messages: allMessages,
    tools: agentTools,
    stopWhen: stepCountIs(10),
  });

  // Ensure the stream runs to completion even if the chat post returns early
  result.consumeStream();

  await thread.post(result.fullStream);

  // Persist the full conversation including tool calls for next turn.
  // response.messages contains ALL steps (tool calls + results + final text).
  const { messages: responseMessages } = await result.response;
  const updatedMessages = [...allMessages, ...responseMessages].slice(
    -MAX_HISTORY_MESSAGES,
  );

  await thread.setState({ aiMessages: updatedMessages });
}
