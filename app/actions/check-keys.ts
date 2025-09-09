"use server";

export type ApiKeysStatus = {
  openai: boolean;
  anthropic: boolean;
  gemini: boolean;
};

export async function checkApiKeys(): Promise<ApiKeysStatus> {
  return {
    openai: Boolean(
      process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    ),
    anthropic: Boolean(
      process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim()
    ),
    gemini: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()
    ),
  };
}
