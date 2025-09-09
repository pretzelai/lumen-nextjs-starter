// Helpers for streaming Anthropic responses
export async function anthropicStream(
  params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    apiKey: string;
  },
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController
): Promise<{
  input_tokens: number;
  output_tokens: number;
  characters: number;
} | null> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error: ${response.status} ${response.statusText}`
    );
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) {
    throw new Error("Failed to read Anthropic response body");
  }

  const usage = { input_tokens: 0, output_tokens: 0, characters: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") {
          break;
        }
        try {
          const parsed = JSON.parse(data);

          // Handle content_block_delta events for text
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta"
          ) {
            usage.characters += parsed.delta.text.length;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "content",
                  content: parsed.delta.text,
                })}\n\n`
              )
            );
          }

          // Handle usage information from message_start event (contains input_tokens)
          if (parsed.type === "message_start" && parsed.message?.usage) {
            usage.input_tokens = parsed.message.usage.input_tokens || 0;
          }

          // Handle usage information from message_delta event (contains final output_tokens)
          if (parsed.type === "message_delta" && parsed.usage) {
            usage.output_tokens = parsed.usage.output_tokens || 0;
          }
        } catch (error) {
          console.error("Error parsing Anthropic response:", error);
        }
      }
    }
  }

  return usage;
}
