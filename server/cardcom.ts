/**
 * Cardcom — דף תשלום (LowProfile) לפי API v11.
 * תיעוד: https://secure.cardcom.solutions/Api/v11/Docs
 *
 * זרימה: Create → המשתמש משלם בדף של Cardcom → Cardcom קורא ל-WebHookUrl →
 * אנחנו מאמתים מול GetLpResult (לא סומכים על גוף ה-webhook) → מאריכים את המנוי.
 */
import { env } from "./env";

const BASE = "https://secure.cardcom.solutions/api/v11";

export interface CreateArgs {
  amount: number;
  productName: string;
  returnValue: string;
  customerName: string;
  customerEmail: string;
}

export async function createPaymentPage(a: CreateArgs): Promise<{ lowProfileId: string; url: string }> {
  const body: Record<string, unknown> = {
    TerminalNumber: Number(env.CARDCOM_TERMINAL_NUMBER),
    ApiName: env.CARDCOM_API_NAME,
    Operation: "ChargeOnly",
    ReturnValue: a.returnValue,
    Amount: a.amount,
    SuccessRedirectUrl: `${env.APP_URL}/billing/success`,
    FailedRedirectUrl: `${env.APP_URL}/billing/failed`,
    WebHookUrl: `${env.APP_URL}/api/cardcom/webhook`,
    ProductName: a.productName,
    Language: "he",
    ISOCoinId: 1,
  };
  // אותו מבנה מסמך שעובד בשומר תוקף; סוג המסמך נקבע בהגדרות המסוף, אלא אם הוגדר במפורש
  const doc: Record<string, unknown> = {
    To: a.customerName || a.customerEmail,
    Email: a.customerEmail,
    Products: [{ Description: a.productName, UnitCost: a.amount, Quantity: 1 }],
  };
  if (env.CARDCOM_DOCUMENT_TYPE) doc.DocumentTypeToCreate = env.CARDCOM_DOCUMENT_TYPE;
  body.Document = doc;
  const res = await fetch(`${BASE}/LowProfile/Create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ResponseCode: number; Description?: string; LowProfileId?: string; Url?: string };
  if (data.ResponseCode !== 0 || !data.Url || !data.LowProfileId) {
    throw new Error(`Cardcom: ${data.Description ?? "שגיאה ביצירת דף תשלום"} (${data.ResponseCode})`);
  }
  return { lowProfileId: data.LowProfileId, url: data.Url };
}

export async function getResult(lowProfileId: string) {
  const res = await fetch(`${BASE}/LowProfile/GetLpResult`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      TerminalNumber: Number(env.CARDCOM_TERMINAL_NUMBER),
      ApiName: env.CARDCOM_API_NAME,
      LowProfileId: lowProfileId,
    }),
  });
  const data = (await res.json()) as {
    ResponseCode: number;
    Description?: string;
    ReturnValue?: string;
    TranzactionId?: number;
    TranzactionInfo?: { ResponseCode?: number; Amount?: number };
  };
  const tx = data.TranzactionInfo;
  return {
    ok: data.ResponseCode === 0 && Boolean(data.TranzactionId) && (tx?.ResponseCode ?? 0) === 0,
    amount: tx?.Amount,
    returnValue: data.ReturnValue,
    raw: data,
  };
}
