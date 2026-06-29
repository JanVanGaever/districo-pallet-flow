import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Database } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  parseProductFile,
  importProducts,
  type ParsedProduct,
  type ImportResult,
} from "@/lib/products-import";

export const Route = createFileRoute("/producten")({
  head: () => ({
    meta: [
      { title: "Producten importeren — Districo Retour" },
      { name: "description", content: "Importeer de Districo productenlijst (XLSX/ODS) naar de gedeelde database voor klant en magazijn." },
    ],
  }),
  component: ProductenImport,
});

const catLabel: Record<string, string> = {
  bier: "Bier",
  water: "Water",
  frisdrank: "Limonade",
  andere: "Andere",
};

function ProductenImport() {
  const [parsed, setParsed] = useState<ParsedProduct[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadCount() {
    const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
    setDbCount(count ?? 0);
  }
  useEffect(() => {
    loadCount();
  }, []);

  async function onFile(file: File) {
    setResult(null);
    setParsed(null);
    setFileName(file.name);
    try {
      const products = await parseProductFile(file);
      if (products.length === 0) {
        toast.error("Geen producten gevonden. Controleer of het bestand een kolom 'Productnaam' en 'Product ID' heeft.");
        return;
      }
      setParsed(products);
      toast.success(`${products.length} producten ingelezen — controleer en importeer.`);
    } catch (e: any) {
      toast.error("Kon het bestand niet lezen: " + (e?.message ?? "onbekende fout"));
    }
  }

  async function doImport() {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await importProducts(parsed);
      setResult(res);
      toast.success(`Klaar: ${res.inserted} nieuw, ${res.updated} bijgewerkt.`);
      await loadCount();
    } catch (e: any) {
      toast.error("Import mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setBusy(false);
    }
  }

  const byCat = (parsed ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.categorie] = (acc[p.categorie] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Producten importeren" />
      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="rounded-xl border bg-card p-5 flex items-center gap-4">
          <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Database className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Gedeelde productendatabase</p>
            <p className="text-sm text-muted-foreground">
              Eén lijst voor klantenportaal én magazijnier-app. Bijwerken op Product ID.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{dbCount ?? "—"}</p>
            <p className="text-xs text-muted-foreground">producten in database</p>
          </div>
        </div>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className="block cursor-pointer rounded-xl border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-primary hover:bg-accent/40"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <Upload className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Sleep je bestand hierheen of klik om te kiezen</p>
          <p className="text-sm text-muted-foreground">XLSX, XLS, ODS of CSV — met tabbladen per categorie</p>
          {fileName && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
              <FileSpreadsheet className="size-4" /> {fileName}
            </p>
          )}
        </label>

        {parsed && (
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold">{parsed.length} producten klaar om te importeren</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {Object.entries(byCat).map(([c, n]) => (
                    <span key={c} className="rounded-full bg-muted px-2.5 py-1">
                      {catLabel[c] ?? c}: <strong>{n}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <Button onClick={doImport} disabled={busy} variant="success">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Importeer naar database
              </Button>
            </div>

            {result && (
              <div className="rounded-lg bg-success/10 text-success-foreground border border-success/30 p-3 text-sm">
                Geïmporteerd: <strong>{result.inserted}</strong> nieuw, <strong>{result.updated}</strong> bijgewerkt
                ({result.total} totaal verwerkt).
              </div>
            )}

            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Categorie</th>
                    <th className="px-3 py-2">Verpakking</th>
                    <th className="px-3 py-2">Inhoud</th>
                    <th className="px-3 py-2 text-right">Per bak</th>
                    <th className="px-3 py-2 text-right">Leeggoed/bak</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 100).map((p) => (
                    <tr key={p.code} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                      <td className="px-3 py-2">{p.naam}</td>
                      <td className="px-3 py-2">{catLabel[p.categorie] ?? p.categorie}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.verpakkingstype ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.inhoud ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{p.aantal_per_bak ?? "—"}</td>
                      <td className="px-3 py-2 text-right">€ {p.leeggoedwaarde_per_bak.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 100 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  … en nog {parsed.length - 100} producten (alleen eerste 100 getoond).
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
