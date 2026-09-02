import { useEffect, useRef, useState } from "react";

type Props = { onScan: (text: string) => void; onCancel: () => void };

export function QrScanner({ onScan, onCancel }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled || !ref.current) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const id = "districo-qr-reader";
        ref.current.id = id;
        const scanner = new Html5Qrcode(id);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            onScan(decoded);
            scanner.stop().catch(() => {});
          },
          () => {},
        );
      } catch (e: any) {
        setError(e?.message ?? "Camera niet beschikbaar");
      }
    })();
    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear?.();
      }
    };
  }, [onScan]);

  return (
    <div className="space-y-3">
      <div ref={ref} className="w-full overflow-hidden rounded-xl bg-black" style={{ minHeight: 280 }} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        onClick={onCancel}
        className="h-14 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base font-medium text-neutral-800"
      >
        Annuleer
      </button>
    </div>
  );
}
