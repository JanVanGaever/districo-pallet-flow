import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ScanLine, X, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/magazijn")({
  ssr: false,
  head: () => ({ meta: [{ title: "Magazijnier — Districo Retour" }] }),
  component: MagazijnPage,
});

function MagazijnPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!scanning) return;
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          handleResult(decoded);
        },
        () => {},
      )
      .catch(() => toast.error("Kan camera niet starten. Geef toegang en gebruik HTTPS."));

    return () => {
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  function handleResult(decoded: string) {
    let id = decoded;
    const m = decoded.match(/\/magazijn\/pallet\/([0-9a-fA-F-]{36})/);
    if (m) id = m[1];
    setScanning(false);
    navigate({ to: "/magazijn/pallet/$id", params: { id } });
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Magazijnier" />
      <main className="mx-auto max-w-md px-5 py-10">
        {!scanning ? (
          <div className="text-center">
            <p className="text-muted-foreground mb-8">Scan de QR-code op de pallet om te starten.</p>
            <button
              onClick={() => setScanning(true)}
              className="mx-auto flex size-56 flex-col items-center justify-center gap-3 rounded-3xl bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
            >
              <ScanLine className="size-20" />
              <span className="text-xl font-semibold">Scan pallet</span>
            </button>
            <p className="mt-8 text-xs text-muted-foreground">
              Tip: de telefooncamera kan de QR ook rechtstreeks openen, want die bevat de directe link naar de pallet.
            </p>
          </div>
        ) : (
          <div>
            <div id="qr-reader" className="overflow-hidden rounded-2xl border" />
            <Button variant="outline" className="mt-4 w-full" onClick={() => setScanning(false)}>
              <X className="size-4" /> Stop scannen
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
