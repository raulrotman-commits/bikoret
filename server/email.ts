import { env } from "./env";

/** שליחת מייל דרך Resend. בלי מפתח (פיתוח) — רק מדפיס ליומן. */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${html.replace(/<[^>]+>/g, " ")}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error("[email] failed", res.status, await res.text());
    return false;
  }
  return true;
}

export function resetEmailHtml(link: string) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;color:#0D2153">
<p>שלום,</p>
<p>התקבלה בקשה לקביעת סיסמה לחשבון שלך בביקורת שטח של רוטמן בטיחות.</p>
<p><a href="${link}" style="background:#0D2153;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">לקביעת סיסמה</a></p>
<p style="color:#555;font-size:13px">הקישור תקף לשעה אחת. אם לא ביקשת — אפשר להתעלם מהמייל.</p>
<p style="color:#8A6500">רוטמן בטיחות</p></div>`;
}
