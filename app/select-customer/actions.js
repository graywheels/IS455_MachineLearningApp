"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CUSTOMER_COOKIE } from "@/lib/customer";

export async function selectCustomerAction(formData) {
  const customerId = Number(formData.get("customer_id"));
  if (!Number.isInteger(customerId) || customerId <= 0) {
    redirect("/select-customer?status=error&message=Invalid%20customer%20selection");
  }

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_COOKIE, String(customerId), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });

  redirect("/dashboard");
}
