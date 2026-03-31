"use server";

import { redirect } from "next/navigation";
import { all, get, inTransaction, run } from "@/lib/db";
import { getSelectedCustomerId } from "@/lib/customer";

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

  const productMap = new Map(
    all(
      `SELECT product_id, product_name, price
       FROM products
       WHERE product_id IN (${rows.map(() => "?").join(",")})`,
      rows.map((r) => r.productId),
    ).map((p) => [p.product_id, p]),
  );

  if (productMap.size === 0) {
    redirect("/place-order?status=error&message=No%20matching%20products%20found");
  }

  const customer = get(
    `SELECT zip_code, state
     FROM customers
     WHERE customer_id = ?`,
    [customerId],
  );

  const result = inTransaction(() => {
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

    const orderInsert = run(
      `INSERT INTO orders (
        customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
        payment_method, device_type, ip_country, promo_used, promo_code,
        order_subtotal, shipping_fee, tax_amount, order_total, risk_score, is_fraud
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        nowSqlTimestamp(),
        customer?.zip_code ?? null,
        customer?.zip_code ?? null,
        customer?.state ?? null,
        "card",
        "web",
        "US",
        0,
        null,
        subtotal,
        shippingFee,
        taxAmount,
        orderTotal,
        0,
        0,
      ],
    );
    const orderId = Number(orderInsert.lastInsertRowid);

    for (const line of normalizedLines) {
      run(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.productId, line.quantity, line.unitPrice, line.lineTotal],
      );
    }

    return orderId;
  });

  redirect(`/orders?status=success&message=Order%20${result}%20placed%20successfully`);
}
