import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, STATUS_LABEL, PalletStatus, AuditEvent } from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { X, Check, Building2, Factory, ArrowUp, ArrowDown, ArrowUpDown, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/kantoor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Kantoor-dashboard — Districo Retour" }] }),
  component: KantoorPage,
});

async function fetchRows() {
  const { data, error } = await supabase
    .from("pallets")
    .select(
      "*, products(naam, leeggoedwaarde_per_bak, aantal_per_bak, bakken_per_europallet, bakken_per_cheppallet), pallet_types(naam, standaard_bakken), retours(retournummer, status, type, creditnota_nummer, creditnota_at, customers(naam, klantnummer, plaats), leveranciers(naam, plaats)), pallet_photos(id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((r: any) => r.retours?.status !== "concept") as any[];
}

async function saveCreditnota(retourId: string, nummer: string | null) {
  const { error } = await supabase
    .from("retours")
    .update({ creditnota_nummer: nummer, creditnota_at: nummer ? new Date().toISOString() : null })
    .eq("id", retourId);
  if (error) throw error;
}

const AUDIT_LABEL: Record<string, string> = {
  aangemaakt: "Aangemaakt",
  ontvangen: "Ontvangen",
  foto_toegevoegd: "Foto toegevoegd",
  product_gewijzigd: "Product gewijzigd",
  pallettype_gewijzigd: "Pallettype gewijzigd",
};

const euro = (n: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

function StatusBadge({ status }: { status: PalletStatus }) {
  const cls =
    status === "ontvangen"
      ? "bg-success/15 text-success"
      : status === "klaar_voor_retour"
        ? "bg-warning/20 text-warning-foreground"
        : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{STATUS_LABEL[status]}</span>;
}

type RetourGroup = {
  retourId: string;
  retournummer: string;
  soort: "klant" | "leverancier";
  partijNaam: string;
  partijSub: string;
  pallets: any[];
  totaal: number;
  ontvangen: number;
  fotos: number;
  waarde: number;
  creditnotaNummer: string | null;
  creditnotaAt: string | null;
  laatsteActiviteit: string;
};

/** Aantal bakken op een volle pallet: geteld bij inname > opgave > configuratie per pallettype. */
function palletBakken(p: any): number {
  if (p.gecontroleerd_aantal != null) return Number(p.gecontroleerd_aantal);
  if (p.opgegeven_aantal != null) return Number(p.opgegeven_aantal);
  if (p.soort !== "vol" || !p.products) return 0;
  const isChep = /chep/i.test(p.pallet_types?.naam ?? "");
  const bakken =
    (isChep ? p.products.bakken_per_cheppallet : p.products.bakken_per_europallet) ??
    p.pallet_types?.standaard_bakken ??
    0;
  return Number(bakken ?? 0);
}

function palletWaarde(p: any) {
  return palletBakken(p) * Number(p.products?.leeggoedwaarde_per_bak ?? 0);
}

type CreditLine = { naam: string; bakken: number; perBak: number; pallets: number; totaal: number };

/** Creditnota-voorstel: per product samengeteld over alle pallets van de retour. */
function buildCreditnota(pallets: any[]): { lines: CreditLine[]; totaal: number } {
  const map = new Map<string, CreditLine>();
  for (const p of pallets) {
    const bakken = palletBakken(p);
    const perBak = Number(p.products?.leeggoedwaarde_per_bak ?? 0);
    if (!bakken || !perBak) continue;
    const naam = p.products?.naam ?? p.inhoud ?? "Onbekend product";
    const key = `${naam}|${perBak}`;
    const line = map.get(key) ?? { naam, bakken: 0, perBak, pallets: 0, totaal: 0 };
    line.bakken += bakken;
    line.pallets += 1;
    line.totaal += bakken * perBak;
    map.set(key, line);
  }
  const lines = Array.from(map.values()).sort((a, b) => b.totaal - a.totaal);
  return { lines, totaal: lines.reduce((s, l) => s + l.totaal, 0) };
}


function groupByRetour(rows: any[]): RetourGroup[] {
  const map = new Map<string, RetourGroup>();
  for (const r of rows) {
    const id = r.retour_id;
    let g = map.get(id);
    if (!g) {
      const isLev = !!r.retours?.leveranciers || r.retours?.type === "leverancier";
      g = {
        retourId: id,
        retournummer: r.retours?.retournummer ?? "—",
        soort: isLev ? "leverancier" : "klant",
        partijNaam: r.retours?.leveranciers?.naam ?? r.retours?.customers?.naam ?? "Onbekend",
        partijSub: isLev
          ? (r.retours?.leveranciers?.plaats ?? "Leverancier")
          : `Klantnr ${r.retours?.customers?.klantnummer ?? "—"}`,
        pallets: [],
        totaal: 0,
        ontvangen: 0,
        fotos: 0,
        waarde: 0,
        creditnotaNummer: r.retours?.creditnota_nummer ?? null,
        creditnotaAt: r.retours?.creditnota_at ?? null,
        laatsteActiviteit: r.created_at,
      };
      map.set(id, g);
    }
    g.pallets.push(r);
    g.totaal += 1;
    if (r.status === "ontvangen") g.ontvangen += 1;
    g.fotos += r.pallet_photos?.length ?? 0;
    g.waarde += palletWaarde(r);
    if (new Date(r.created_at) > new Date(g.laatsteActiviteit)) g.laatsteActiviteit = r.created_at;
  }
  return Array.from(map.values());
}

function RetourStatusBadge({ ontvangen, totaal }: { ontvangen: number; totaal: number }) {
  const done = ontvangen === totaal;
  const started = ontvangen > 0;
  const cls = done
    ? "bg-success/15 text-success"
    : started
      ? "bg-warning/20 text-warning-foreground"
      : "bg-muted text-muted-foreground";
  const label = done ? "Volledig ontvangen" : started ? "Deels ontvangen" : "In afwachting";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CreditnotaCell({
  group,
  onSaved,
}: {
  group: RetourGroup;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(group.creditnotaNummer ?? "");
  const [busy, setBusy] = useState(false);
  const isLev = group.soort === "leverancier";

  async function save(nummer: string | null) {
    setBusy(true);
    try {
      await saveCreditnota(group.retourId, nummer);
      toast.success(nummer ? (isLev ? "Creditnota leverancier bevestigd" : "Creditnota geregistreerd") : "Creditnota verwijderd");
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  }

  if (group.creditnotaNummer && !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        <span className="font-medium">{group.creditnotaNummer}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setValue(group.creditnotaNummer ?? "");
            setEditing(true);
          }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          wijzig
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="rounded-lg border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
      >
        {isLev ? "Creditnota ontvangen?" : "Creditnotanummer invullen"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) void save(value.trim());
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="CN-2026-001"
        className="w-32 rounded-lg border bg-background px-2 py-1 text-sm"
      />
      <button
        disabled={busy || !value.trim()}
        onClick={() => void save(value.trim())}
        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        Bevestig
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">
        annuleer
      </button>
    </div>
  );
}

type SortKey = "datum" | "partij" | "retournummer" | "pallets" | "waarde" | "status";

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

function KantoorPage() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["kantoor-rows"], queryFn: fetchRows });
  const [selectedRetour, setSelectedRetour] = useState<string | null>(null);
  const [tab, setTab] = useState<"klant" | "leverancier">("klant");
  const [zoek, setZoek] = useState("");
  const [periode, setPeriode] = useState<"alles" | "7" | "30" | "90">("alles");
  const [statusFilter, setStatusFilter] = useState<"alles" | "open" | "gecrediteerd">("alles");
  const [sortKey, setSortKey] = useState<SortKey>("datum");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "partij" || k === "retournummer" ? "asc" : "desc");
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel("kantoor")
      .on("postgres_changes", { event: "*", schema: "public", table: "pallets" }, () => {
        qc.invalidateQueries({ queryKey: ["kantoor-rows"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pallet_photos" }, () => {
        qc.invalidateQueries({ queryKey: ["kantoor-rows"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "retours" }, () => {
        qc.invalidateQueries({ queryKey: ["kantoor-rows"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const alle = groupByRetour(rows ?? []);
  const klanten = alle.filter((g) => g.soort === "klant");
  const leveranciers = alle.filter((g) => g.soort === "leverancier");

  const basis = tab === "klant" ? klanten : leveranciers;

  const q = zoek.trim().toLowerCase();
  const grens = periode === "alles" ? null : Date.now() - Number(periode) * 86400000;
  const gefilterd = basis.filter((g) => {
    if (grens && new Date(g.laatsteActiviteit).getTime() < grens) return false;
    if (statusFilter === "open" && g.creditnotaNummer) return false;
    if (statusFilter === "gecrediteerd" && !g.creditnotaNummer) return false;
    if (!q) return true;
    return (
      g.partijNaam.toLowerCase().includes(q) ||
      g.partijSub.toLowerCase().includes(q) ||
      g.retournummer.toLowerCase().includes(q) ||
      (g.creditnotaNummer ?? "").toLowerCase().includes(q)
    );
  });

  const collator = new Intl.Collator("nl-BE", { sensitivity: "base", numeric: true });
  const statusRang = (g: RetourGroup) => (g.ontvangen === 0 ? 0 : g.ontvangen < g.totaal ? 1 : 2);
  const retours = gefilterd.slice().sort((a, b) => {
    const factor = sortDir === "asc" ? 1 : -1;
    let cmp = 0;
    switch (sortKey) {
      case "datum":
        cmp = new Date(a.laatsteActiviteit).getTime() - new Date(b.laatsteActiviteit).getTime();
        break;
      case "partij":
        // Sorteren op klant/leverancier, daarbinnen altijd nieuwste retour eerst
        cmp = collator.compare(a.partijNaam, b.partijNaam);
        if (cmp === 0)
          return new Date(b.laatsteActiviteit).getTime() - new Date(a.laatsteActiviteit).getTime();
        break;
      case "retournummer":
        cmp = collator.compare(a.retournummer, b.retournummer);
        break;
      case "pallets":
        cmp = a.totaal - b.totaal;
        break;
      case "waarde":
        cmp = a.waarde - b.waarde;
        break;
      case "status":
        cmp = statusRang(a) - statusRang(b);
        if (cmp === 0) cmp = a.ontvangen / a.totaal - b.ontvangen / b.totaal;
        break;
    }
    if (cmp === 0) cmp = new Date(a.laatsteActiviteit).getTime() - new Date(b.laatsteActiviteit).getTime();
    return cmp * factor;
  });

  const totals = (list: RetourGroup[]) => {
    const waarde = list.reduce((s, g) => s + g.waarde, 0);
    const open = list.filter((g) => !g.creditnotaNummer);
    return {
      aantal: list.length,
      pallets: list.reduce((s, g) => s + g.totaal, 0),
      waarde,
      afgehandeld: list.length - open.length,
      openWaarde: open.reduce((s, g) => s + g.waarde, 0),
    };
  };
  const t = totals(retours);
  const tk = totals(klanten);
  const tl = totals(leveranciers);


  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Kantoor-dashboard" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Overzicht retours &amp; creditnota's</h1>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success animate-pulse" /> Live
          </span>
        </div>

        {/* Globale totalen: klanten vs. leveranciers */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <p className="font-semibold">Klanten</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{euro(tk.waarde)}</p>
            <p className="text-xs text-muted-foreground">
              {tk.aantal} retours · {tk.pallets} pallets · {tk.afgehandeld}/{tk.aantal} gecrediteerd
            </p>
            <p className="mt-1 text-xs font-medium text-warning-foreground">Nog te crediteren: {euro(tk.openWaarde)}</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Factory className="size-4 text-primary" />
              <p className="font-semibold">Leveranciers</p>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{euro(tl.waarde)}</p>
            <p className="text-xs text-muted-foreground">
              {tl.aantal} retours · {tl.pallets} pallets · {tl.afgehandeld}/{tl.aantal} creditnota ontvangen
            </p>
            <p className="mt-1 text-xs font-medium text-warning-foreground">Nog te ontvangen: {euro(tl.openWaarde)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 inline-flex rounded-xl border bg-card p-1">
          {([
            ["klant", `Klanten (${klanten.length})`],
            ["leverancier", `Leveranciers (${leveranciers.length})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <KpiCard label="Retours" value={t.aantal} sub={`${t.pallets} pallets`} />
          <KpiCard
            label={tab === "klant" ? "Creditnota's opgemaakt" : "Creditnota's ontvangen"}
            value={`${t.afgehandeld} / ${t.aantal}`}
          />
          <KpiCard label="Totale leeggoedwaarde" value={euro(t.waarde)} sub={`Open: ${euro(t.openWaarde)}`} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Retournummer</th>
                <th className="px-4 py-3 font-medium">{tab === "klant" ? "Klant" : "Leverancier"}</th>
                <th className="px-4 py-3 font-medium">Pallets</th>
                <th className="px-4 py-3 font-medium">Ontvangen</th>
                <th className="px-4 py-3 text-right font-medium">Waarde</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">{tab === "klant" ? "Creditnota" : "Creditnota leverancier"}</th>
              </tr>
            </thead>
            <tbody>
              {retours.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nog geen retours.
                  </td>
                </tr>
              ) : (
                retours.map((g) => (
                  <tr
                    key={g.retourId}
                    className="cursor-pointer border-t hover:bg-accent/30"
                    onClick={() => setSelectedRetour(g.retourId)}
                  >
                    <td className="px-4 py-3 font-medium">{g.retournummer}</td>
                    <td className="px-4 py-3">
                      <div>{g.partijNaam}</div>
                      <div className="text-xs text-muted-foreground">{g.partijSub}</div>
                    </td>
                    <td className="px-4 py-3">{g.totaal}</td>
                    <td className="px-4 py-3">
                      {g.ontvangen} / {g.totaal}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{euro(g.waarde)}</td>
                    <td className="px-4 py-3">
                      <RetourStatusBadge ontvangen={g.ontvangen} totaal={g.totaal} />
                    </td>
                    <td className="px-4 py-3">
                      <CreditnotaCell
                        group={g}
                        onSaved={() => qc.invalidateQueries({ queryKey: ["kantoor-rows"] })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {retours.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/40 font-medium">
                  <td className="px-4 py-3" colSpan={2}>
                    Totaal {tab === "klant" ? "klanten" : "leveranciers"}
                  </td>
                  <td className="px-4 py-3">{t.pallets}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums">{euro(t.waarde)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">
                    {t.afgehandeld} / {t.aantal} afgehandeld
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </main>

      {selectedRetour && (
        <RetourDetailPanel
          group={alle.find((g) => g.retourId === selectedRetour)!}
          onClose={() => setSelectedRetour(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["kantoor-rows"] })}
        />
      )}
    </div>
  );
}

type VerschilRow = { pallet: any; opgegeven: number; geteld: number; verschil: number; impact: number };

function buildVerschilrapport(pallets: any[]) {
  const rows: VerschilRow[] = [];
  for (const p of pallets) {
    if (p.opgegeven_aantal == null || p.gecontroleerd_aantal == null) continue;
    const verschil = p.gecontroleerd_aantal - p.opgegeven_aantal;
    if (verschil === 0) continue;
    const waarde = Number(p.products?.leeggoedwaarde_per_bak ?? 0);
    rows.push({ pallet: p, opgegeven: p.opgegeven_aantal, geteld: p.gecontroleerd_aantal, verschil, impact: verschil * waarde });
  }
  const totaalImpact = rows.reduce((s, r) => s + r.impact, 0);
  return { rows, totaalImpact };
}

function RetourDetailPanel({ group, onClose, onSaved }: { group: RetourGroup; onClose: () => void; onSaved: () => void }) {
  const [selectedPallet, setSelectedPallet] = useState<string | null>(null);
  const { rows: verschilRows, totaalImpact } = buildVerschilrapport(group.pallets);
  const { lines: creditLines, totaal: creditTotaal } = buildCreditnota(group.pallets);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-foreground/20 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <p className="font-semibold">{group.retournummer}</p>
            <p className="text-xs text-muted-foreground">
              {group.partijNaam} · {group.partijSub}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Pallets</p>
              <p className="font-medium">{group.totaal}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Ontvangen</p>
              <p className="font-medium">
                {group.ontvangen} / {group.totaal}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Waarde</p>
              <p className="font-medium">{euro(group.waarde)}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">
              {group.soort === "klant" ? "Creditnota klant" : "Creditnota leverancier"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.soort === "klant"
                ? "Vul het nummer uit het boekhoudpakket in zodra de creditnota is opgemaakt."
                : "Bevestig met het nummer van de ontvangen creditnota van de leverancier."}
            </p>
            <div className="mt-3">
              <CreditnotaCell group={group} onSaved={onSaved} />
            </div>
            {group.creditnotaAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                Geregistreerd op {new Date(group.creditnotaAt).toLocaleString("nl-BE")}
              </p>
            )}
          </div>

          {/* Creditnota zoals ze opgemaakt moet worden */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Creditnota-opmaak</h3>
              <span className="text-xs text-muted-foreground">{group.retournummer}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.partijNaam} · {group.partijSub}
            </p>
            {creditLines.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Geen te crediteren leeggoed (geen bakken of leeggoedwaarde geconfigureerd).
              </p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1 font-medium">Omschrijving</th>
                    <th className="pb-1 text-right font-medium">Bakken</th>
                    <th className="pb-1 text-right font-medium">Per bak</th>
                    <th className="pb-1 text-right font-medium">Bedrag</th>
                  </tr>
                </thead>
                <tbody>
                  {creditLines.map((l) => (
                    <tr key={`${l.naam}-${l.perBak}`} className="border-t">
                      <td className="py-1.5">
                        {l.naam}
                        <span className="ml-1 text-xs text-muted-foreground">({l.pallets} pallet{l.pallets > 1 ? "s" : ""})</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{l.bakken}</td>
                      <td className="py-1.5 text-right tabular-nums">{euro(l.perBak)}</td>
                      <td className="py-1.5 text-right tabular-nums">{euro(l.totaal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="py-2" colSpan={3}>
                      Totaal te crediteren
                    </td>
                    <td className="py-2 text-right tabular-nums">{euro(creditTotaal)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Verschilrapport: opgave vs. geteld bij inname, met euro-impact */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Verschilrapport</h3>
              {verschilRows.length > 0 && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${totaalImpact < 0 ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}
                >
                  Euro-impact {totaalImpact > 0 ? "+" : ""}
                  {euro(totaalImpact)}
                </span>
              )}
            </div>
            {verschilRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Geen verschillen tussen opgave en telling.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1 font-medium">Pallet</th>
                    <th className="pb-1 text-right font-medium">Opgave</th>
                    <th className="pb-1 text-right font-medium">Geteld</th>
                    <th className="pb-1 text-right font-medium">Verschil</th>
                    <th className="pb-1 text-right font-medium">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {verschilRows.map((r) => (
                    <tr key={r.pallet.id} className="border-t">
                      <td className="py-1.5">{r.pallet.palletnummer}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.opgegeven}</td>
                      <td className="py-1.5 text-right tabular-nums">{r.geteld}</td>
                      <td
                        className={`py-1.5 text-right font-medium tabular-nums ${r.verschil < 0 ? "text-destructive" : "text-success"}`}
                      >
                        {r.verschil > 0 ? "+" : ""}
                        {r.verschil}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${r.impact < 0 ? "text-destructive" : "text-success"}`}>
                        {r.impact > 0 ? "+" : ""}
                        {euro(r.impact)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground">Pallets</h3>
            <ul className="mt-2 space-y-2">
              {group.pallets
                .slice()
                .sort((a, b) => (a.positie ?? 0) - (b.positie ?? 0))
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedPallet(p.id)}
                      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-accent/30"
                    >
                      <span className="font-medium">{p.palletnummer}</span>
                      <span className="text-sm text-muted-foreground">{p.products?.naam ?? p.inhoud ?? "—"}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{p.pallet_photos?.length ?? 0} foto's</span>
                        <StatusBadge status={p.status} />
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </aside>
      {selectedPallet && <DetailPanel palletId={selectedPallet} onClose={() => setSelectedPallet(null)} />}
    </div>
  );
}

async function fetchDetail(palletId: string) {
  const { data: pallet } = await supabase
    .from("pallets")
    .select("*, products(naam), pallet_types(naam), retours(retournummer, customers(naam, klantnummer, plaats), leveranciers(naam, plaats))")
    .eq("id", palletId)
    .single();
  const { data: photos } = await supabase.from("pallet_photos").select("*").eq("pallet_id", palletId).order("created_at");
  const { data: events } = await supabase.from("audit_events").select("*").eq("pallet_id", palletId).order("created_at");
  const urls = await Promise.all((photos ?? []).map((ph: any) => getSignedUrl(ph.storage_path)));
  return { pallet: pallet as any, photoUrls: urls.filter(Boolean) as string[], events: (events ?? []) as AuditEvent[] };
}

function DetailPanel({ palletId, onClose }: { palletId: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["detail", palletId], queryFn: () => fetchDetail(palletId) });

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-foreground/20 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <p className="font-semibold">{data?.pallet?.palletnummer ?? "Laden…"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        {data?.pallet && (
          <div className="space-y-6 p-5">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground">
                {data.pallet.retours?.leveranciers ? "Leverancier" : "Klant"}
              </h3>
              <p className="mt-1 font-medium">
                {data.pallet.retours?.leveranciers?.naam ?? data.pallet.retours?.customers?.naam}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.pallet.retours?.leveranciers
                  ? data.pallet.retours.leveranciers.plaats
                  : `Klantnr ${data.pallet.retours?.customers?.klantnummer} · ${data.pallet.retours?.customers?.plaats}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {data.pallet.retours?.retournummer} · Pallet {data.pallet.positie} van {data.pallet.totaal}
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Product</p>
                <p className="font-medium">{data.pallet.products?.naam ?? data.pallet.inhoud ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Pallettype</p>
                <p className="font-medium">{data.pallet.pallet_types?.naam}</p>
              </div>
              <div className="rounded-lg border p-3 col-span-2">
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={data.pallet.status} />
              </div>
            </section>

            {(data.pallet.gecontroleerd_aantal != null ||
              data.pallet.gewogen_gewicht != null ||
              data.pallet.ontvangen_door ||
              data.pallet.klant_handtekening) && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground">Inname-verificatie</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Opgave / geteld</p>
                    <p className="font-medium">
                      {data.pallet.opgegeven_aantal ?? "—"} / {data.pallet.gecontroleerd_aantal ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Gewogen gewicht</p>
                    <p className="font-medium">{data.pallet.gewogen_gewicht != null ? `${data.pallet.gewogen_gewicht} kg` : "—"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Aangenomen door</p>
                    <p className="font-medium">{data.pallet.ontvangen_door ?? "—"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Ontvangen op</p>
                    <p className="font-medium">
                      {data.pallet.ontvangen_at ? new Date(data.pallet.ontvangen_at).toLocaleString("nl-BE") : "—"}
                    </p>
                  </div>
                </div>
                {data.pallet.klant_handtekening && (
                  <div className="mt-3 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Handtekening klant</p>
                    <img src={data.pallet.klant_handtekening} alt="Handtekening klant" className="mt-1 h-24 rounded bg-white object-contain" />
                  </div>
                )}
              </section>
            )}

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground">Foto's ({data.photoUrls.length})</h3>
              {data.photoUrls.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nog geen foto's.</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {data.photoUrls.map((u, i) => (
                    <img key={i} src={u} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted-foreground">Audittrail</h3>
              <ol className="mt-2 space-y-2">
                {data.events.map((ev) => (
                  <li key={ev.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium">{AUDIT_LABEL[ev.type] ?? ev.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString("nl-BE")}
                        {ev.actor ? ` · ${ev.actor}` : ""}
                        {ev.detail ? ` · ${ev.detail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
