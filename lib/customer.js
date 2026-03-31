import { cookies } from "next/headers";
import { get } from "@/lib/db";

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

  return (
    get(
      `SELECT customer_id, full_name, email
       FROM customers
       WHERE customer_id = ?`,
      [customerId],
    ) || null
  );
}
