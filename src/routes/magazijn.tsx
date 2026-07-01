import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ScanLine, X, BookOpen, FlaskConical, ChevronRight } from "lucide-react";
import { toast } from "sonner";

async function fetchScanbarePallets() {
  const { data, error } = await supabase
    .from("pallets")
    .select("id, palletnummer, status, inhoud, products(naam), retours(retournummer, status, customers(naam))")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).filter((r: any) => r.retours?.status !== "concept") as any[];
}

export const Route = createFileRoute("/magazijn")({
  ssr: false,
  head: () => ({ meta: [{ title: "Magazijnier — Districo Retour" }] }),
  component: MagazijnPage,
});

function MagazijnPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { data: demoPallets, isLoading: demoLoading } = useQuery({
    queryKey: ["scanbarePallets"],
    queryFn: fetchScanbarePallets,
    enabled: showDemo,
  });

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
            <Link
              to="/magazijn/catalogus"
              className="mt-8 inline-flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:border-primary"
            >
              <BookOpen className="size-4" /> Waardecatalogus openen
            </Link>

            {/* Demo-bypass: pallet openen zonder camera/QR */}
            <div className="mt-10 rounded-2xl border border-dashed bg-muted/30 p-4 text-left">
              <button
                onClick={() => setShowDemo((v) => !v)}
                className="flex w-full items-center gap-2 text-sm font-medium"
              >
                <FlaskConical className="size-4 text-primary" />
                Demo: pallet openen zonder scannen
                <ChevronRight className={`ml-auto size-4 transition-transform ${showDemo ? "rotate-90" : ""}`} />
              </button>
              {showDemo && (
                <div className="mt-3">
                  {demoLoading ? (
                    <p className="text-sm text-muted-foreground">Laden…</p>
                  ) : (demoPallets?.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">Geen ingediende pallets gevonden.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {demoPallets!.map((p: any) => (
                        <li key={p.id}>
                          <button
                            onClick={() => navigate({ to: "/magazijn/pallet/$id", params: { id: p.id } })}
                            className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary"
                          >
                            <span className="font-medium">{p.palletnummer}</span>
                            <span className="truncate text-muted-foreground">
                              {p.products?.naam ?? p.inhoud ?? "—"}
                              {p.retours?.customers?.naam ? ` · ${p.retours.customers.naam}` : ""}
                            </span>
                            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
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
