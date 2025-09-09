import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@/lib/supabase/server";
import { sendEvent, isFeatureEntitled } from "@getlumen/server";

const FEATURE_NAME = "ai";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (
    await isFeatureEntitled({
      feature: FEATURE_NAME,
      userId: user.id,
    })
  ) {
    const { prompt } = await req.json();
    const { text } = await generateText({
      model: openai("gpt-4o"),
      prompt: prompt,
    });

    await sendEvent({
      name: FEATURE_NAME,
      userId: user.id,
      value: 1,
    });
    return text;
  }
}
