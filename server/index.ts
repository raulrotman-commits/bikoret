import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import { createContext } from "./trpc";
import { env, isProd } from "./env";
import { db, pool, schema } from "./db";
import { userFromRequest, accessFor } from "./auth";
import { rsSelfCheck } from "./rs";
import { getObject, putObject } from "./storage";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(cookieParser());

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** העלאת תמונה לממצא. אידמפוטנטי לפי מזהה התמונה שנוצר במכשיר. */
app.post("/api/photos", upload.single("file"), async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "יש להתחבר" });
  if (!(await accessFor(user)).active) return res.status(403).json({ error: "אין מנוי פעיל" });
  const { id, findingId, visitId } = req.body as Record<string, string>;
  if (!req.file || !UUID.test(id ?? "") || !UUID.test(findingId ?? "") || !UUID.test(visitId ?? "")) {
    return res.status(400).json({ error: "בקשה לא תקינה" });
  }
  const [v] = await db
    .select()
    .from(schema.visits)
    .where(and(eq(schema.visits.id, visitId), eq(schema.visits.userId, user.id)))
    .limit(1);
  if (!v) return res.status(409).json({ error: "הביקור עדיין לא נשמר" });
  const [exists] = await db.select({ id: schema.photos.id }).from(schema.photos).where(eq(schema.photos.id, id)).limit(1);
  if (exists) return res.json({ ok: true, id });
  const type = req.file.mimetype === "image/png" ? "image/png" : "image/jpeg";
  const key = `u${user.id}/v-${visitId}/${id}.${type === "image/png" ? "png" : "jpg"}`;
  await putObject(key, req.file.buffer, type);
  await db.insert(schema.photos).values({
    id,
    findingId,
    visitId,
    userId: user.id,
    storageKey: key,
    contentType: type,
    bytes: req.file.size,
    createdAt: new Date(),
  });
  res.json({ ok: true, id });
});

/** הגשת תמונה: לבעלים, או לכל מי שמחזיק בקישור השיתוף של אותו דוח */
app.get("/api/photos/:id", async (req, res) => {
  const [p] = await db.select().from(schema.photos).where(eq(schema.photos.id, req.params.id)).limit(1);
  if (!p) return res.status(404).end();
  let allowed = false;
  const t = typeof req.query.t === "string" ? req.query.t : "";
  if (t) {
    const [v] = await db.select().from(schema.visits).where(eq(schema.visits.id, p.visitId)).limit(1);
    allowed = Boolean(v && v.shareToken === t && v.status === "final");
  }
  if (!allowed) {
    const user = await userFromRequest(req);
    allowed = Boolean(user && user.id === p.userId);
  }
  if (!allowed) return res.status(403).end();
  const obj = await getObject(p.storageKey);
  if (!obj) return res.status(404).end();
  res.setHeader("Content-Type", p.contentType);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  res.end(obj.body);
});

/** לוגו של לקוח (מוצג בדוחות שלו) */
app.post("/api/logo", upload.single("file"), async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: "יש להתחבר" });
  if (!req.file || !/^image\/(png|jpeg|webp)$/.test(req.file.mimetype)) return res.status(400).json({ error: "קובץ תמונה בלבד" });
  if (req.file.size > 2 * 1024 * 1024) return res.status(400).json({ error: "עד 2MB" });
  const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
  const key = `u${user.id}/logo-${Date.now()}.${ext}`;
  await putObject(key, req.file.buffer, req.file.mimetype);
  await db.update(schema.users).set({ logoKey: key }).where(eq(schema.users.id, user.id));
  res.json({ ok: true });
});

app.get("/api/logo/:userId", async (req, res) => {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, Number(req.params.userId))).limit(1);
  if (!u?.logoKey) return res.status(404).end();
  const obj = await getObject(u.logoKey);
  if (!obj) return res.status(404).end();
  res.setHeader("Content-Type", obj.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.end(obj.body);
});

app.use(
  "/api/trpc",
  express.json({ limit: "2mb" }),
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${path}`, error);
    },
  }),
);

// קבצי הלקוח (בייצור)
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");
if (isProd && fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.listen(env.PORT, () => {
  console.log(`bikoret listening on :${env.PORT} (${env.NODE_ENV})`);
  void rsSelfCheck();
});
