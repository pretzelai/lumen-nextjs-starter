import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { sendEvent, isFeatureEntitled } from "@getlumen/server";
import { createClient } from "@/lib/supabase/server";
import { AVAILABLE_MODELS } from "@/lib/constants";
import { anthropicStream } from "./anthropic-helper";

const FEATURE_NAME = "chat-messages";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !(await isFeatureEntitled({
      feature: FEATURE_NAME,
      userId: user.id,
      apiUrl: process.env.LUMEN_API_URL,
    }))
  ) {
    return NextResponse.json({ error: "Not entitled" }, { status: 401 });
  }

  try {
    const {
      messages,
      model = "gpt-3.5-turbo",
      provider = "openai",
      userApiKey,
    } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const supportedModel = AVAILABLE_MODELS.find((m) => m.id === model);
    if (!supportedModel) {
      throw new Error(`Model not supported: ${model}`);
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata about the request
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "metadata",
                model,
              })}\n\n`
            )
          );

          let totalTokens = 0;
          let inputTokens = 0;
          let outputTokens = 0;
          let finishReason = "";
          let totalCharacters = 0;
          const startTime = Date.now();

          if (provider === "openai") {
            const openaiClient = new OpenAI({
              apiKey: userApiKey || process.env.OPENAI_API_KEY,
            });

            const stream = await openaiClient.chat.completions.create({
              model,
              messages,
              stream: true,
              stream_options: { include_usage: true },
            });

            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                totalCharacters += content.length;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "content",
                      content,
                    })}\n\n`
                  )
                );
              }

              // Capture usage information from the final chunk
              if (chunk.usage) {
                totalTokens = chunk.usage.total_tokens;
                inputTokens = chunk.usage.prompt_tokens;
                outputTokens = chunk.usage.completion_tokens;
              }

              // Capture finish reason
              if (chunk.choices[0]?.finish_reason) {
                finishReason = chunk.choices[0].finish_reason;
              }
            }
          } else if (provider === "anthropic") {
            const usage = await anthropicStream(
              {
                model,
                messages,
                apiKey: userApiKey || process.env.ANTHROPIC_API_KEY!,
              },
              encoder,
              controller
            );

            // Update usage info from Anthropic response
            if (usage) {
              totalTokens = usage.input_tokens + usage.output_tokens;
              inputTokens = usage.input_tokens;
              outputTokens = usage.output_tokens;
              totalCharacters = usage.characters || 0;
            }
          } else {
            throw new Error(`Unknown provider: ${provider}`);
          }

          const endTime = Date.now();
          const duration = endTime - startTime;

          // Log comprehensive usage information
          console.log("=== Chat API Usage Information ===");
          console.log(`User ID: ${user.id}`);
          console.log(`Provider: ${provider}`);
          console.log(`Model: ${model}`);
          console.log(`Total Tokens: ${totalTokens}`);
          console.log(`Input Tokens: ${inputTokens}`);
          console.log(`Output Tokens: ${outputTokens}`);
          console.log(`Characters Generated: ${totalCharacters}`);
          console.log(`Finish Reason: ${finishReason}`);
          console.log(`Duration: ${duration}ms`);
          console.log(`Messages Count: ${messages.length}`);
          console.log(
            `Tokens per Second: ${
              outputTokens > 0
                ? (outputTokens / (duration / 1000)).toFixed(2)
                : 0
            }`
          );
          console.log("==================================");

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    sendEvent({
      name: FEATURE_NAME,
      value: 1,
      userId: user!.id,
      apiUrl: process.env.LUMEN_API_URL,
    });
  }
}
