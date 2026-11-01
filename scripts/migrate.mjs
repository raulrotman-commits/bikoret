// מריץ את קובצי ההגירה שב-drizzle/ מול DATABASE_URL (נקרא בהפעלה ב-Railway).
// אם מסד הנתונים שבכתובת עוד לא קיים בשרת — יוצר אותו (מסד נפרד, כדי לא לגעת בטבלאות של אפליקציות אחרות).
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL ?? "mysql://bikoret:bikoret@localhost:3306/bikoret";
const u = new URL(url);
const dbName = decodeURIComponent(u.pathname.replace(/^\//, "")) || "bikoret";
if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`שם מסד נתונים לא תקין: ${dbName}`);

try {
  const serverUrl = new URL(url);
  serverUrl.pathname = "/";
  const admin = await mysql.createConnection({ uri: serverUrl.toString() });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
} catch (e) {
  console.warn("create database skipped:", e?.message ?? e);
}

const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
const db = drizzle(conn);
await migrate(db, { migrationsFolder: "./drizzle", migrationsTable: "__bk_migrations" });
await conn.end();
console.log(`migrations: up to date (${dbName})`);
