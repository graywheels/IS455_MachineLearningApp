import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "shop.db");
let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath, { fileMustExist: true });
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function all(sql, params = {}) {
  return getDb().prepare(sql).all(params);
}

export function get(sql, params = {}) {
  return getDb().prepare(sql).get(params);
}

export function run(sql, params = {}) {
  return getDb().prepare(sql).run(params);
}

export function inTransaction(work) {
  const txn = getDb().transaction(work);
  return txn();
}

export function tableExists(tableName) {
  const row = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

export { getDb, dbPath };
