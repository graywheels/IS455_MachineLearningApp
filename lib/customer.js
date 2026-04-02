import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const CUSTOMER_COOKIE = "selected_customer_id";

export async function getSelectedCustomerId() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_COOKIE)?.value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function getSelectedCustomer() {
  const customerId = await getSelectedCustomerId();
  if (!customerId) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, full_name, email")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}
