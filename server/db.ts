import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";
import { env } from "./env";

export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 8,
  charset: "utf8mb4",
  timezone: "Z",
  dateStrings: false,
});

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
