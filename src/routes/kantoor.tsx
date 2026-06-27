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
    .select("*, products(naam), pallet_types(naam), retours(retournummer, customers(naam, klantnummer)), pallet_photos(id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
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

function KantoorPage() {
  const qc = useQueryClient();
  const { data: rows } = useQuery({ queryKey: ["kantoor-rows"], queryFn: fetchRows });
  const [selected, setSelected] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "klant">("none");

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
          <span className="text-sm text-muted-foreground">Groeperen:</span>
          <button onClick={() => setGroupBy("none")} className={`rounded-lg border px-3 py-1.5 text-sm ${groupBy === "none" ? "border-primary bg-accent/40" : ""}`}>Geen</button>
          <button onClick={() => setGroupBy("klant")} className={`rounded-lg border px-3 py-1.5 text-sm ${groupBy === "klant" ? "border-primary bg-accent/40" : ""}`}>Per klant</button>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success animate-pulse" /> Live
          </span>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Palletnummer</th>
                <th className="px-4 py-3 font-medium">Klant</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Pallettype</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Foto's</th>
                <th className="px-4 py-3 font-medium">Ontvangst</th>
              </tr>
            </thead>
            <tbody>
              {renderRows(rows ?? [], groupBy, setSelected)}
            </tbody>
          </table>
        </div>
      </main>

      {selected && <DetailPanel palletId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function renderRows(rows: any[], groupBy: "none" | "klant", onSelect: (id: string) => void) {
  const rowEl = (r: any) => (
    <tr key={r.id} className="cursor-pointer border-t hover:bg-accent/30" onClick={() => onSelect(r.id)}>
      <td className="px-4 py-3 font-medium">{r.palletnummer}</td>
      <td className="px-4 py-3">{r.retours?.customers?.naam}</td>
      <td className="px-4 py-3">{r.products?.naam}</td>
      <td className="px-4 py-3">{r.pallet_types?.naam}</td>
      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
      <td className="px-4 py-3">{r.pallet_photos?.length ?? 0}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.ontvangen_at ? new Date(r.ontvangen_at).toLocaleString("nl-BE") : "—"}</td>
    </tr>
  );

  if (groupBy === "none") return rows.map(rowEl);

  const groups: Record<string, any[]> = {};
  for (const r of rows) {
    const k = r.retours?.customers?.naam ?? "Onbekend";
    (groups[k] ??= []).push(r);
  }
  return Object.entries(groups).flatMap(([naam, items]) => [
    <tr key={"h-" + naam} className="border-t bg-muted/30">
      <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{naam} ({items.length})</td>
    </tr>,
    ...items.map(rowEl),
  ]);
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
                <p className="font-medium">{data.pallet.products?.naam}</p>
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
