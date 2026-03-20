/**
 * Send a photo directly to a Telegram chat.
 * Used for image previews — the Chat SDK doesn't support sending photos natively.
 */
export async function sendTelegramPhoto(
  chatId: string,
  photoBase64: string,
  caption?: string,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const photoBuffer = Buffer.from(photoBase64, "base64");
  const blob = new Blob([photoBuffer], { type: "image/png" });

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", blob, "preview.png");
  if (caption) {
    form.append("caption", caption);
  }

  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}
