// מריץ את קובצי ההגירה שב-drizzle/ מול DATABASE_URL (נקרא בהפעלה ב-Railway)
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL ?? "mysql://bikoret:bikoret@localhost:3306/bikoret";
const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
const db = drizzle(conn);
await migrate(db, { migrationsFolder: "./drizzle", migrationsTable: "__bk_migrations" });
await conn.end();
console.log("migrations: up to date");
