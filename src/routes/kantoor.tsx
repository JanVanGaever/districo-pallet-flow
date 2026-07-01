import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, STATUS_LABEL, PalletStatus, AuditEvent } from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { X } from "lucide-react";

export const Route = createFileRoute("/kantoor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Kantoor-dashboard — Districo Retour" }] }),
  component: KantoorPage,
});

async function fetchRows() {
  const { data, error } = await supabase
    .from("pallets")
    .select("*, products(naam, leeggoedwaarde_per_bak), pallet_types(naam), retours(retournummer, status, customers(naam, klantnummer)), pallet_photos(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((r: any) => r.retours?.status !== "concept") as any[];
}

const AUDIT_LABEL: Record<string, string> = {
  aangemaakt: "Aangemaakt",
  ontvangen: "Ontvangen",
  foto_toegevoegd: "Foto toegevoegd",
  product_gewijzigd: "Product gewijzigd",
  pallettype_gewijzigd: "Pallettype gewijzigd",
};

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
  klantNaam: string;
  klantnummer: string;
  pallets: any[];
  totaal: number;
  ontvangen: number;
  fotos: number;
  laatsteActiviteit: string;
};

function groupByRetour(rows: any[]): RetourGroup[] {
  const map = new Map<string, RetourGroup>();
  for (const r of rows) {
    const id = r.retour_id;
    let g = map.get(id);
    if (!g) {
      g = {
        retourId: id,
        retournummer: r.retours?.retournummer ?? "—",
        klantNaam: r.retours?.customers?.naam ?? "Onbekend",
        klantnummer: r.retours?.customers?.klantnummer ?? "",
        pallets: [],
        totaal: 0,
        ontvangen: 0,
        fotos: 0,
        laatsteActiviteit: r.created_at,
      };
      map.set(id, g);
    }
    g.pallets.push(r);
    g.totaal += 1;
    if (r.status === "ontvangen") g.ontvangen += 1;
    g.fotos += r.pallet_photos?.length ?? 0;
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

function KantoorPage() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["kantoor-rows"], queryFn: fetchRows });
  const [selectedRetour, setSelectedRetour] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("kantoor")
      .on("postgres_changes", { event: "*", schema: "public", table: "pallets" }, () => {
        qc.invalidateQueries({ queryKey: ["kantoor-rows"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pallet_photos" }, () => {
        qc.invalidateQueries({ queryKey: ["kantoor-rows"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const today = new Date().toDateString();
  const retoursVandaag = new Set(
    (rows ?? []).filter((r) => new Date(r.created_at).toDateString() === today).map((r) => r.retour_id),
  ).size;
  const ontvangenVandaag = (rows ?? []).filter((r) => r.ontvangen_at && new Date(r.ontvangen_at).toDateString() === today).length;
  const nogTeOntvangen = (rows ?? []).filter((r) => r.status !== "ontvangen").length;

  const cards = [
    { label: "Retours vandaag", value: retoursVandaag },
    { label: "Pallets ontvangen vandaag", value: ontvangenVandaag },
    { label: "Nog te ontvangen", value: nogTeOntvangen },
  ];

  const retours = groupByRetour(rows ?? []).sort(
    (a, b) => new Date(b.laatsteActiviteit).getTime() - new Date(a.laatsteActiviteit).getTime(),
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Kantoor-dashboard" />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="text-sm font-medium">Retours per klant</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success animate-pulse" /> Live
          </span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Retournummer</th>
                <th className="px-4 py-3 font-medium">Klant</th>
                <th className="px-4 py-3 font-medium">Pallets</th>
                <th className="px-4 py-3 font-medium">Ontvangen</th>
                <th className="px-4 py-3 font-medium">Foto's</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {retours.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nog geen retours.</td></tr>
              ) : (
                retours.map((g) => (
                  <tr key={g.retourId} className="cursor-pointer border-t hover:bg-accent/30" onClick={() => setSelectedRetour(g.retourId)}>
                    <td className="px-4 py-3 font-medium">{g.retournummer}</td>
                    <td className="px-4 py-3">
                      <div>{g.klantNaam}</div>
                      <div className="text-xs text-muted-foreground">Klantnr {g.klantnummer}</div>
                    </td>
                    <td className="px-4 py-3">{g.totaal}</td>
                    <td className="px-4 py-3">{g.ontvangen} / {g.totaal}</td>
                    <td className="px-4 py-3">{g.fotos}</td>
                    <td className="px-4 py-3"><RetourStatusBadge ontvangen={g.ontvangen} totaal={g.totaal} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {selectedRetour && (
        <RetourDetailPanel
          group={retours.find((g) => g.retourId === selectedRetour)!}
          onClose={() => setSelectedRetour(null)}
        />
      )}
    </div>
  );
}

const euro = (n: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

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

function RetourDetailPanel({ group, onClose }: { group: RetourGroup; onClose: () => void }) {
  const [selectedPallet, setSelectedPallet] = useState<string | null>(null);
  const { rows: verschilRows, totaalImpact } = buildVerschilrapport(group.pallets);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <p className="font-semibold">{group.retournummer}</p>
            <p className="text-xs text-muted-foreground">{group.klantNaam} · Klantnr {group.klantnummer}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Pallets</p>
              <p className="font-medium">{group.totaal}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Ontvangen</p>
              <p className="font-medium">{group.ontvangen} / {group.totaal}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Foto's</p>
              <p className="font-medium">{group.fotos}</p>
            </div>
          </div>

          {/* Verschilrapport: opgave vs. geteld bij inname, met euro-impact */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Verschilrapport</h3>
              {verschilRows.length > 0 && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${totaalImpact < 0 ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
                  Euro-impact {totaalImpact > 0 ? "+" : ""}{euro(totaalImpact)}
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
                      <td className={`py-1.5 text-right font-medium tabular-nums ${r.verschil < 0 ? "text-destructive" : "text-success"}`}>
                        {r.verschil > 0 ? "+" : ""}{r.verschil}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${r.impact < 0 ? "text-destructive" : "text-success"}`}>
                        {r.impact > 0 ? "+" : ""}{euro(r.impact)}
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
    .select("*, products(naam), pallet_types(naam), retours(retournummer, customers(naam, klantnummer, plaats))")
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
    <div className="fixed inset-0 z-20 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <p className="font-semibold">{data?.pallet?.palletnummer ?? "Laden…"}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        {data?.pallet && (
          <div className="space-y-6 p-5">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground">Klant</h3>
              <p className="mt-1 font-medium">{data.pallet.retours?.customers?.naam}</p>
              <p className="text-sm text-muted-foreground">
                Klantnr {data.pallet.retours?.customers?.klantnummer} · {data.pallet.retours?.customers?.plaats}
              </p>
              <p className="text-sm text-muted-foreground">{data.pallet.retours?.retournummer} · Pallet {data.pallet.positie} van {data.pallet.totaal}</p>
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

            {(data.pallet.gecontroleerd_aantal != null || data.pallet.gewogen_gewicht != null || data.pallet.ontvangen_door || data.pallet.klant_handtekening) && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground">Inname-verificatie</h3>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Opgave / geteld</p>
                    <p className="font-medium">{data.pallet.opgegeven_aantal ?? "—"} / {data.pallet.gecontroleerd_aantal ?? "—"}</p>
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
                    <p className="font-medium">{data.pallet.ontvangen_at ? new Date(data.pallet.ontvangen_at).toLocaleString("nl-BE") : "—"}</p>
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
