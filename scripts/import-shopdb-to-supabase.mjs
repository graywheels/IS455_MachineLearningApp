import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const sqlitePath = path.join(process.cwd(), "shop.db");
const db = new Database(sqlitePath, { fileMustExist: true });

function chunk(array, size = 500) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function importTable(table, query) {
  const rows = db.prepare(query).all();
  console.log(`Importing ${table}: ${rows.length} rows`);
  for (const batch of chunk(rows, 500)) {
    const { error } = await supabase.from(table).upsert(batch);
    if (error) {
      throw new Error(`${table} import failed: ${error.message}`);
    }
  }
}

async function main() {
  await importTable("customers", "SELECT * FROM customers");
  await importTable("products", "SELECT * FROM products");
  await importTable("orders", "SELECT * FROM orders");
  await importTable("order_items", "SELECT * FROM order_items");
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_predictions'").get()) {
    await importTable("order_predictions", "SELECT * FROM order_predictions");
  } else {
    console.log("Skipping order_predictions (table not present in SQLite)");
  }
  console.log("Import complete.");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
