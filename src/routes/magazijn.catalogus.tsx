import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCatalogus, type CatalogusItem } from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { Search } from "lucide-react";

export const Route = createFileRoute("/magazijn/catalogus")({
  ssr: false,
  head: () => ({ meta: [{ title: "Waardecatalogus — Districo Retour" }] }),
  component: CatalogusPage,
});

const CAT_COLOR: Record<string, string> = {
  bier: "bg-yellow-400",
  water: "bg-blue-400",
  frisdrank: "bg-green-500",
  limonade: "bg-green-500",
};

const euro = (n: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

function CatalogusPage() {
  const { data, isLoading } = useQuery({ queryKey: ["catalogus"], queryFn: fetchCatalogus });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set((data ?? []).map((d) => d.categorie))).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    let list: CatalogusItem[] = data ?? [];
    if (cat) list = list.filter((d) => d.categorie === cat);
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((d) => `${d.naam} ${d.merk ?? ""} ${d.verpakkingstype ?? ""}`.toLowerCase().includes(term));
    return list;
  }, [data, q, cat]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Waardecatalogus" back="/magazijn" />
      <main className="mx-auto max-w-md px-5 py-5">
        <p className="text-sm text-muted-foreground">
          Actuele statiegeldwaardes per baktype. Zoek het product bij inname — je hoeft niets uit het hoofd te kennen.
        </p>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek product, merk of verpakking…"
            className="h-11 w-full rounded-lg border bg-background pl-9 pr-3"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setCat(null)}
            className={`rounded-full border px-3 py-1 text-sm ${cat === null ? "border-primary bg-primary/10 font-medium" : ""}`}
          >
            Alle
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm capitalize ${cat === c ? "border-primary bg-primary/10 font-medium" : ""}`}
            >
              <span className={`size-2 rounded-full ${CAT_COLOR[c] ?? "bg-muted-foreground"}`} />
              {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-10 text-center text-muted-foreground">Laden…</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {filtered.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className={`size-3 shrink-0 rounded-full ${CAT_COLOR[item.categorie] ?? "bg-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.naam}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[item.merk, item.verpakkingstype, item.aantal_per_bak ? `${item.aantal_per_bak}/bak` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{euro(item.leeggoedwaarde_per_bak)}</p>
                  <p className="text-[11px] text-muted-foreground">per bak</p>
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="py-10 text-center text-muted-foreground">Geen producten gevonden.</li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
