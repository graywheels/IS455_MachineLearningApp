"use server";

import { redirect } from "next/navigation";
import { getSelectedCustomerId } from "@/lib/customer";
import { createSupabaseAdminClient } from "@/lib/supabase";

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function nowSqlTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Phoenix",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export async function placeOrderAction(formData) {
  const customerId = await getSelectedCustomerId();
  if (!customerId) redirect("/select-customer");
  const supabase = createSupabaseAdminClient();

  const productIds = formData.getAll("product_id");
  const quantities = formData.getAll("quantity");
  const rows = [];

  for (let i = 0; i < productIds.length; i += 1) {
    const productId = toInt(productIds[i]);
    const quantity = toInt(quantities[i]);
    if (Number.isInteger(productId) && Number.isInteger(quantity) && quantity > 0) {
      rows.push({ productId, quantity });
    }
  }

  if (rows.length === 0) {
    redirect("/place-order?status=error&message=Add%20at%20least%20one%20valid%20line%20item");
  }

  const { data: products = [] } = await supabase
    .from("products")
    .select("product_id, product_name, price")
    .in("product_id", rows.map((r) => r.productId));
  const productMap = new Map(products.map((p) => [p.product_id, p]));

  if (productMap.size === 0) {
    redirect("/place-order?status=error&message=No%20matching%20products%20found");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("zip_code, state")
    .eq("customer_id", customerId)
    .maybeSingle();

  let subtotal = 0;
  const normalizedLines = rows.map(({ productId, quantity }) => {
    const product = productMap.get(productId);
    if (!product) throw new Error(`Product ${productId} not found`);
    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * quantity;
    subtotal += lineTotal;
    return { productId, quantity, unitPrice, lineTotal };
  });

  const shippingFee = subtotal >= 50 ? 0 : 6.99;
  const taxAmount = subtotal * 0.08;
  const orderTotal = subtotal + shippingFee + taxAmount;

  const { data: insertedOrder, error: insertOrderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customerId,
      order_datetime: nowSqlTimestamp(),
      billing_zip: customer?.zip_code ?? null,
      shipping_zip: customer?.zip_code ?? null,
      shipping_state: customer?.state ?? null,
      payment_method: "card",
      device_type: "web",
      ip_country: "US",
      promo_used: 0,
      promo_code: null,
      order_subtotal: subtotal,
      shipping_fee: shippingFee,
      tax_amount: taxAmount,
      order_total: orderTotal,
      risk_score: 0,
      is_fraud: 0,
    })
    .select("order_id")
    .single();

  if (insertOrderError || !insertedOrder) {
    throw new Error(insertOrderError?.message || "Failed to create order");
  }
  const orderId = Number(insertedOrder.order_id);

  const { error: lineInsertError } = await supabase.from("order_items").insert(
    normalizedLines.map((line) => ({
      order_id: orderId,
      product_id: line.productId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    })),
  );
  if (lineInsertError) {
    throw new Error(lineInsertError.message);
  }

  redirect(`/orders?status=success&message=Order%20${orderId}%20placed%20successfully`);
}
