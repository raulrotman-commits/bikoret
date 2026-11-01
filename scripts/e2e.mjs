// בדיקת קצה לקצה על מסך נייד: הרשמה → מיתוג → אתר → ביקור עם ממצאים ותמונה → הפקת דוח → קישור ציבורי → ביקור המשך
// הרצה: BASE=http://localhost:8080 node scripts/e2e.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:8080";
const OUT = process.env.OUT ?? "screens";
fs.mkdirSync(OUT, { recursive: true });
const email = `demo${Date.now()}@rotmansafety.test`;
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${new URL(r.url()).pathname}`));

// הרשמה
await page.goto(`${BASE}/signup`);
await page.getByLabel("שם מלא").fill("ראול רוטמן");
await page.getByLabel("מייל").fill(email);
await page.getByLabel("סיסמה").fill("Bikoret!2026");
await shot(page, "01-signup");
await page.getByRole("button", { name: "פתיחת חשבון" }).click();
await page.waitForURL(/\/settings/);
log("signed up", email);

// מיתוג
await page.getByLabel("מס' רישיון / רישום").fill("108703");
await page.getByLabel("שם החברה").fill("רוטמן בטיחות");
await page.getByLabel("טלפון החברה").fill("054-2017006");
await page.locator('input[type=file][accept^="image/png"]').setInputFiles("client/public/icon-512.png");
await page.waitForTimeout(800);
await shot(page, "02-settings");
await page.getByRole("button", { name: "שמירה והתחלה" }).click();
await page.waitForURL(`${BASE}/`);
await shot(page, "03-home-empty");
log("branding saved");

// אתר חדש
await page.getByRole("button", { name: "＋ ביקור חדש" }).click();
await page.waitForURL(/\/sites\/new/);
await page.getByLabel("שם האתר").fill("מגדלי הים — בניין B");
await page.getByLabel("כתובת").fill("רחוב הים 12, אשדוד");
await page.getByLabel("המזמין").fill("ים ייזום בע״מ");
await page.getByLabel("מבצע הבנייה").fill("א.ב. בנייה בע״מ");
await page.getByLabel("מנהל העבודה").fill("יוסי לוי");
await page.getByLabel("ממונה הבטיחות").fill("ראול רוטמן");
await shot(page, "04-site-form");
await page.getByRole("button", { name: "שמירה והתחלת ביקור" }).click();
await page.waitForURL(/\/visit\/[0-9a-f-]{36}$/);
const visitUrl = page.url();
log("visit editor", visitUrl);
await shot(page, "05-editor-empty");

// ממצא מהמאגר בחיפוש
await page.getByRole("button", { name: "＋ הוספת ממצא" }).click();
await page.getByPlaceholder(/למשל: מעקה/).fill("מעקה");
await page.waitForTimeout(300);
await shot(page, "06-picker-search");
const sheet = () => page.locator(".fixed.inset-0");
const first = sheet().locator("button.card").filter({ hasText: "גידור" }).first();
await first.click();
await page.getByRole("button", { name: /סבירות 3, חומרה 4/ }).click();
await page.getByLabel("העבודה הקשורה בסיכון הופסקה").check();
await page.getByPlaceholder("קומה, אגף, ציר").fill("קומה 4, אגף מזרח");
await page.getByPlaceholder("מה ראית, מה נדרש לעשות").fill("קצה תקרה פתוח באורך 12 מ׳, עובדים בסביבה בלי ריתום.");
await page.locator('input[type=file][capture]').setInputFiles("client/public/icon-512.png");
await page.waitForTimeout(1200);
await shot(page, "07-finding-sheet");
await page.getByRole("button", { name: "סיום" }).click();
log("finding 1 added");

// ממצאים מהערות שטח
await page.getByRole("button", { name: "＋ הוספת ממצא" }).click();
await page.getByRole("button", { name: "מהערות שטח" }).click();
await page.getByPlaceholder(/כתוב או הכתב/).fill("אין פנקס הדרכה, לוח חשמל פתוח");
await page.waitForTimeout(300);
await shot(page, "08-picker-notes");
await sheet().locator("button.card").first().click();
await page.getByRole("button", { name: /סבירות 2, חומרה 2/ }).click();
await page.getByRole("button", { name: "סיום" }).click();
log("finding 2 added");

// נושא מיקוד: אחריות המזמין
await page.getByRole("button", { name: "＋ הוספת ממצא" }).click();
await page.getByRole("button", { name: "חיפוש במאגר" }).click();
await page.getByRole("button", { name: /אחריות המזמין/ }).click();
await page.waitForTimeout(200);
await shot(page, "09-picker-focus");
await sheet().locator("button.card").first().click();
await page.getByRole("button", { name: /סבירות 2, חומרה 3/ }).click();
await page.getByRole("button", { name: "סיום" }).click();

// ממצא חופשי
await page.getByRole("button", { name: "＋ הוספת ממצא" }).click();
await page.getByRole("button", { name: "+ ממצא שלא מופיע במאגר" }).click();
await page.getByPlaceholder("מה נמצא באתר").fill("ערימת פסולת חוסמת את דרך המילוט בקומת הקרקע");
await page.getByRole("button", { name: /סבירות 3, חומרה 2/ }).click();
await page.getByRole("button", { name: "סיום" }).click();
await page.waitForTimeout(1800);
await shot(page, "10-editor-list");

// פרטי הדוח
await page.getByRole("button", { name: "פרטי הדוח" }).click();
await page.getByLabel("שם").nth(1).fill("יוסי לוי");
await page.getByLabel("הערות כלליות לדוח").fill("הביקור נערך בשלב השלד. נבדקו קומות 1–5 וחצר ההתארגנות.");
await shot(page, "11-details");
await page.waitForTimeout(1800);

// הפקה
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "הפקת דוח" }).click();
await page.waitForURL(/\/report/);
await page.waitForTimeout(1200);
await shot(page, "12-report-owner");
const reportText = await page.locator("article").innerText();
log("report has 'סיכונים שאינם קבילים':", reportText.includes("סיכונים שאינם קבילים"));
log("report has source line:", /מקור: (תקנה|תקנות)/.test(reportText));

// קישור ציבורי
const shareUrl = await page.evaluate(async () => {
  const id = location.pathname.split("/")[2];
  const r = await fetch(`/api/trpc/visits.report?input=${encodeURIComponent(JSON.stringify({ json: { id } }))}`, { credentials: "include" });
  const j = await r.json();
  return j.result.data.json.visit.shareUrl;
});
log("share url", shareUrl);
const anon = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
const pub = await anon.newPage();
await pub.goto(shareUrl);
await pub.waitForSelector("article");
await pub.waitForTimeout(1000);
const imgs = await pub.$$eval("article img", (els) => els.map((e) => ({ src: e.getAttribute("src"), ok: e.complete && e.naturalWidth > 0 })));
log("public images:", JSON.stringify(imgs));
await pub.screenshot({ path: `${OUT}/13-report-public.png`, fullPage: true });
await pub.emulateMedia({ media: "print" });
await pub.pdf({ path: `${OUT}/report.pdf`, format: "A4", printBackground: true }).catch(() => {});

// ביקור המשך באותו אתר
await page.goto(`${BASE}/`);
await page.getByRole("button", { name: "＋ ביקור חדש" }).click();
await page.waitForURL(/\/visit\/[0-9a-f-]{36}$/);
await page.waitForTimeout(800);
await shot(page, "14-followup-editor");
await page.getByRole("button", { name: "✓ ראיתי שתוקן" }).first().click();
await page.waitForTimeout(1800);
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "הפקת דוח" }).click();
await page.waitForURL(/\/report/);
await page.waitForTimeout(1000);
await shot(page, "15-followup-report");
const t2 = await page.locator("article").innerText();
log("follow-up shows fixed section:", t2.includes("תוקנו מאז הביקור הקודם"));
log("follow-up carries open items:", t2.includes("פתוח מהביקור הקודם"));

console.log("errors:", errors.length ? errors : "none");
await browser.close();
