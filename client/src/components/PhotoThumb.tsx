import { usePhotoUrl } from "../lib/photos";

export function PhotoThumb({ id, onRemove, onOpen }: { id: string; onRemove?: () => void; onOpen?: (url: string) => void }) {
  const url = usePhotoUrl(id);
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-navy-50 ring-1 ring-navy-100">
      {url && <img src={url} alt="" className="h-full w-full object-cover" onClick={() => onOpen?.(url)} />}
      {onRemove && (
        <button
          type="button"
          aria-label="הסרת תמונה"
          onClick={onRemove}
          className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy-900/70 text-[12px] text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}
