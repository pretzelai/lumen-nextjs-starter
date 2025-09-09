import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createFreeSubscriptionIfNoneExists } from "@getlumen/server";

export async function GET(request: Request) {
  // The `/auth/callback` route is required for the server-side auth flow implemented
  // by the SSR package. It exchanges an auth code for the user's session.
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirect_to")?.toString();

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      try {
        await Promise.all([
          createFreeSubscriptionIfNoneExists({
            userId: user.id,
            email: user.email!,
            name: user.user_metadata.name || user.email!,
            apiUrl: process.env.LUMEN_API_URL,
          }),
        ]);
      } catch (error) {
        console.error(error);
      }
    }
  }

  if (redirectTo) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // URL to redirect to after sign up process completes
  return NextResponse.redirect(`${origin}/chat`);
}
