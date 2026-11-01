import { useEffect, useState } from "react";
import { getPhoto } from "./visitStore";

/** הקטנת תמונה במכשיר לפני שמירה והעלאה: עד 1600 פיקסלים בצלע הארוכה, JPEG */
export async function compressImage(file: File | Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("כשל בעיבוד התמונה"))), "image/jpeg", quality),
  );
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* נופלים לגיבוי */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** כתובת להצגת תמונה: מהמכשיר אם עוד לא עלתה, אחרת מהשרת */
export function usePhotoUrl(id: string) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let revoke = "";
    let alive = true;
    getPhoto(id).then((p) => {
      if (!alive) return;
      if (p?.blob) {
        revoke = URL.createObjectURL(p.blob);
        setUrl(revoke);
      } else setUrl(`/api/photos/${id}`);
    });
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);
  return url;
}
