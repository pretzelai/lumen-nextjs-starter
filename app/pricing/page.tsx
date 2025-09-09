import { PricingTable } from "@/components/ui/pricing-table";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  return (
    <PricingTable
      userId={user.id}
      loginRedirectUrl="/sign-in"
      paymentProvider="stripe"
    />
  );
}
