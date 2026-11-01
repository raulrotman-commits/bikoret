function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v != null ? n : d;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: num(process.env.PORT, 8080),
  DATABASE_URL: process.env.DATABASE_URL ?? "mysql://bikoret:bikoret@localhost:3306/bikoret",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  APP_URL: (process.env.APP_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  OWNER_EMAIL: (process.env.OWNER_EMAIL ?? "").toLowerCase().trim(),

  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "",
  S3_REGION: process.env.S3_REGION || "auto",
  S3_BUCKET: process.env.S3_BUCKET ?? "",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "",
  /** קידומת לתיקייה בדלי, כדי לא להתערבב עם קבצים של אפליקציות אחרות באותו דלי */
  S3_PREFIX: process.env.S3_PREFIX ?? "bikoret/",
  LOCAL_UPLOAD_DIR: process.env.LOCAL_UPLOAD_DIR ?? ".data/uploads",

  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "רוטמן בטיחות <no-reply@rotmansafety.com>",

  TRIAL_DAYS: num(process.env.TRIAL_DAYS, 14),

  /** מסד הנתונים של האתר הראשי (קריאה בלבד) — שם נמצא המנוי של רוטמן בטיחות */
  RS_DATABASE_URL: process.env.RS_DATABASE_URL ?? "",
  /** האתר הראשי, ודף המנוי בו */
  RS_SITE_URL: (process.env.RS_SITE_URL || "https://www.rotman-safety.com").replace(/\/$/, ""),
  RS_SUBSCRIBE_PATH: process.env.RS_SUBSCRIBE_PATH || "/pricing",
};

export const isProd = env.NODE_ENV === "production";
export const hasS3 = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
