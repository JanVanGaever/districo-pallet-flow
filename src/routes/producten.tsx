import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Database, Settings2, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  parseProductFile,
  importProducts,
  type ParsedProduct,
  type ImportResult,
} from "@/lib/products-import";
import {
  fetchPalletTypes,
  updatePalletTypeBakken,
  WEGWERP_NAAM,
  fetchProductConfigs,
  updateProductConfig,
  applyBakkenToVerpakkingstype,
  type PalletType,
  type ProductConfig,
} from "@/lib/districo";
import { Input } from "@/components/ui/input";

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

        <ProductConfigurator />

        <PalletBakkenSettings />

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

function PalletBakkenSettings() {
  const [types, setTypes] = useState<PalletType[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const t = await fetchPalletTypes();
    setTypes(t);
    setValues(
      Object.fromEntries(t.map((x) => [x.id, x.standaard_bakken != null ? String(x.standaard_bakken) : ""])),
    );
  }
  useEffect(() => {
    load();
  }, []);

  async function save(t: PalletType) {
    const raw = values[t.id]?.trim() ?? "";
    const val = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
    if (raw !== "" && Number.isNaN(val)) {
      toast.error("Geef een geldig getal in.");
      return;
    }
    setSavingId(t.id);
    try {
      await updatePalletTypeBakken(t.id, val);
      toast.success(`Standaard bakken voor ${t.naam} opgeslagen.`);
      await load();
    } catch (e: any) {
      toast.error("Opslaan mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setSavingId(null);
    }
  }

  const editable = (types ?? []).filter((t) => t.naam !== WEGWERP_NAAM);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Database className="size-6" />
        </div>
        <div>
          <p className="font-semibold">Standaard bakken per volle pallet</p>
          <p className="text-sm text-muted-foreground">
            Stel in hoeveel bakken er standaard op één volle pallet staan, per pallettype. Niet van toepassing op wegwerppallet.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {editable.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-lg border p-3">
            <span className="flex-1 font-medium">{t.naam}</span>
            <Input
              type="number"
              min={0}
              className="w-24"
              placeholder="bv. 36"
              value={values[t.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))}
            />
            <span className="text-xs text-muted-foreground">bakken</span>
            <Button size="sm" onClick={() => save(t)} disabled={savingId === t.id}>
              {savingId === t.id ? <Loader2 className="size-4 animate-spin" /> : "Opslaan"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

type ConfigDraft = { perBak: string; euro: string; chep: string };

function ProductConfigurator() {
  const [products, setProducts] = useState<ProductConfig[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ConfigDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");

  function draftOf(p: ProductConfig): ConfigDraft {
    return {
      perBak: p.aantal_per_bak != null ? String(p.aantal_per_bak) : "",
      euro: p.bakken_per_europallet != null ? String(p.bakken_per_europallet) : "",
      chep: p.bakken_per_cheppallet != null ? String(p.bakken_per_cheppallet) : "",
    };
  }

  async function load() {
    const ps = await fetchProductConfigs();
    setProducts(ps);
    setDrafts(Object.fromEntries(ps.map((p) => [p.id, draftOf(p)])));
  }
  useEffect(() => {
    load();
  }, []);

  function toNum(s: string): number | null {
    const t = s.trim();
    if (t === "") return null;
    const n = Math.round(Number(t));
    return Number.isNaN(n) ? null : Math.max(0, n);
  }

  function isDirty(p: ProductConfig): boolean {
    const d = drafts[p.id];
    if (!d) return false;
    const o = draftOf(p);
    return d.perBak !== o.perBak || d.euro !== o.euro || d.chep !== o.chep;
  }

  async function save(p: ProductConfig) {
    const d = drafts[p.id];
    if (!d) return;
    if ([d.perBak, d.euro, d.chep].some((s) => s.trim() !== "" && Number.isNaN(Number(s)))) {
      toast.error("Geef geldige getallen in.");
      return;
    }
    setSavingId(p.id);
    try {
      await updateProductConfig(p.id, {
        aantal_per_bak: toNum(d.perBak),
        bakken_per_europallet: toNum(d.euro),
        bakken_per_cheppallet: toNum(d.chep),
      });
      toast.success(`${p.naam} opgeslagen.`);
      await load();
    } catch (e: any) {
      toast.error("Opslaan mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setSavingId(null);
    }
  }

  async function propagate(p: ProductConfig) {
    const d = drafts[p.id];
    if (!d) return;
    if (!p.verpakkingstype) {
      toast.error("Dit product heeft geen verpakkingstype om naar door te trekken.");
      return;
    }
    if ([d.euro, d.chep].some((s) => s.trim() !== "" && Number.isNaN(Number(s)))) {
      toast.error("Geef geldige getallen in.");
      return;
    }
    setSavingId(p.id);
    try {
      // Eerst dit product zelf opslaan, dan doortrekken naar zelfde soort.
      await updateProductConfig(p.id, {
        aantal_per_bak: toNum(d.perBak),
        bakken_per_europallet: toNum(d.euro),
        bakken_per_cheppallet: toNum(d.chep),
      });
      const n = await applyBakkenToVerpakkingstype(p.verpakkingstype, {
        bakken_per_europallet: toNum(d.euro),
        bakken_per_cheppallet: toNum(d.chep),
      });
      toast.success(`Bakken per pallet doorgetrokken naar ${n} product(en) met verpakkingstype "${p.verpakkingstype}".`);
      await load();
    } catch (e: any) {
      toast.error("Doortrekken mislukt: " + (e?.message ?? "onbekende fout"));
    } finally {
      setSavingId(null);
    }
  }

  const cats = ["all", "bier", "water", "frisdrank", "andere"];
  const q = search.trim().toLowerCase();
  const filtered = (products ?? []).filter((p) => {
    if (catFilter !== "all" && p.categorie !== catFilter) return false;
    if (!q) return true;
    return (
      p.naam.toLowerCase().includes(q) ||
      (p.code ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Settings2 className="size-6" />
        </div>
        <div>
          <p className="font-semibold">Productconfigurator</p>
          <p className="text-sm text-muted-foreground">
            Stel per product in: flesjes per bak, bakken per europallet en bakken per cheppallet.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek product of code…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${catFilter === c ? "border-primary bg-accent/40 font-medium" : "hover:border-primary"}`}
            >
              {c === "all" ? "Alle" : (catLabel[c] ?? c)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Categorie</th>
              <th className="px-3 py-2 text-center">Flesjes/bak</th>
              <th className="px-3 py-2 text-center">Bakken/europallet</th>
              <th className="px-3 py-2 text-center">Bakken/cheppallet</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products == null && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            )}
            {products != null && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Geen producten gevonden.
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const d = drafts[p.id] ?? { perBak: "", euro: "", chep: "" };
              const dirty = isDirty(p);
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.naam}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.code ? `${p.code} · ` : ""}{p.verpakkingstype ?? "—"}{p.inhoud ? ` · ${p.inhoud}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{catLabel[p.categorie] ?? p.categorie}</td>
                  <td className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      className="mx-auto w-20 text-center"
                      value={d.perBak}
                      onChange={(e) => setDrafts((v) => ({ ...v, [p.id]: { ...d, perBak: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      className="mx-auto w-20 text-center"
                      value={d.euro}
                      onChange={(e) => setDrafts((v) => ({ ...v, [p.id]: { ...d, euro: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Input
                      type="number"
                      min={0}
                      className="mx-auto w-20 text-center"
                      value={d.chep}
                      onChange={(e) => setDrafts((v) => ({ ...v, [p.id]: { ...d, chep: e.target.value } }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || savingId === p.id}
                        onClick={() => save(p)}
                      >
                        {savingId === p.id ? <Loader2 className="size-4 animate-spin" /> : "Opslaan"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Bakken per pallet doortrekken naar alle producten met hetzelfde verpakkingstype"
                        disabled={!p.verpakkingstype || savingId === p.id}
                        onClick={() => propagate(p)}
                      >
                        Doortrekken
                      </Button>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
