const ALLOWED_PATHS = [
  /^content\/blog\/[a-z]{2}\/.+\.mdx$/,
  /^messages\/[a-z]{2}\.json$/,
  /^public\/images\/blog\/.+\.(png|jpg|jpeg|webp|gif|svg)$/,
] as const;

export function assertAllowedPath(filePath: string): void {
  const normalized = filePath.replace(/^\/+/, "");
  const isAllowed = ALLOWED_PATHS.some((pattern) => pattern.test(normalized));

  if (!isAllowed) {
    throw new Error(
      `Access denied: "${filePath}" is outside allowed content directories.`,
    );
  }
}

export function isAllowedPath(filePath: string): boolean {
  const normalized = filePath.replace(/^\/+/, "");
  return ALLOWED_PATHS.some((pattern) => pattern.test(normalized));
}
