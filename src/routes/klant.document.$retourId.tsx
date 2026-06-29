import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, PalletStatus } from "@/lib/districo";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/klant/document/$retourId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Retourdocument — Districo Retour" }] }),
  component: DocumentPage,
});

async function fetchRetourData(retourId: string) {
  const { data: retour } = await supabase
    .from("retours")
    .select("*, customers(*)")
    .eq("id", retourId)
    .single();
  const { data: pallets } = await supabase
    .from("pallets")
    .select(
      "*, products(naam, leeggoedwaarde_per_bak, bakken_per_europallet, bakken_per_cheppallet), pallet_types(naam, standaard_bakken)",
    )
    .eq("retour_id", retourId)
    .order("positie");
  return { retour, pallets: (pallets ?? []) as any[] };
}

function palletWaarde(p: any): number | null {
  if (p.soort !== "vol" || !p.products) return null;
  const waardePerBak = Number(p.products.leeggoedwaarde_per_bak ?? 0);
  if (!waardePerBak) return null;
  const typeNaam: string = p.pallet_types?.naam ?? "";
  const isChep = /chep/i.test(typeNaam);
  const bakken =
    (isChep ? p.products.bakken_per_cheppallet : p.products.bakken_per_europallet) ??
    p.pallet_types?.standaard_bakken ??
    null;
  if (!bakken) return null;
  return waardePerBak * Number(bakken);
}

const eur = (n: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

const soortLabel: Record<string, string> = {
  vol: "Volle pallet",
  mixed: "Gemixte pallet",
  lege_bakken: "Lege bakken",
  lege_flesjes: "Lege flesjes",
};

function DocumentPage() {
  const { retourId } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["retour-document", retourId],
    queryFn: () => fetchRetourData(retourId),
  });

  if (!data?.retour)
    return <div className="p-10 text-center text-muted-foreground">Laden…</div>;

  const { retour, pallets } = data;
  const datum = new Date(retour.created_at).toLocaleDateString("nl-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const ontvangen = pallets.filter((p) => p.status === "ontvangen").length;

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto max-w-[210mm] px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/klant" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <p className="font-semibold text-sm">{retour.retournummer}</p>
              <p className="text-xs text-muted-foreground">
                {retour.customers?.naam} · {pallets.length} pallets
              </p>
            </div>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Afdrukken
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[210mm] px-6 py-8 print:p-0">
        <div className="mx-auto w-full rounded-lg border bg-white p-[15mm] text-black shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
          {/* Kop */}
          <div className="flex items-start justify-between border-b border-black/10 pb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Retourdocument</h1>
              <p className="mt-1 text-sm text-black/60">Districo Retour</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">{retour.retournummer}</p>
              <p className="text-black/60">Datum: {datum}</p>
              <p className="text-black/60">Status: {retour.status}</p>
            </div>
          </div>

          {/* Klant + samenvatting */}
          <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-1 font-semibold text-black/50 uppercase text-xs tracking-wide">Klant</p>
              <p className="font-medium">{retour.customers?.naam}</p>
              <p className="text-black/60">Klantnr. {retour.customers?.klantnummer}</p>
              <p className="text-black/60">{retour.customers?.plaats}</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-black/50 uppercase text-xs tracking-wide">Samenvatting</p>
              <p>Totaal pallets: <span className="font-medium">{pallets.length}</span></p>
              <p>Ontvangen: <span className="font-medium">{ontvangen} / {pallets.length}</span></p>
            </div>
          </div>

          {/* Pallettabel */}
          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black/20 text-left">
                <th className="py-2 pr-2 font-semibold">#</th>
                <th className="py-2 pr-2 font-semibold">Palletnummer</th>
                <th className="py-2 pr-2 font-semibold">Soort</th>
                <th className="py-2 pr-2 font-semibold">Inhoud</th>
                <th className="py-2 pr-2 font-semibold">Pallettype</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {pallets.map((p, i) => (
                <tr key={p.id} className="border-b border-black/10 align-top">
                  <td className="py-2 pr-2 text-black/60">{i + 1}</td>
                  <td className="py-2 pr-2 font-medium">{p.palletnummer}</td>
                  <td className="py-2 pr-2">{soortLabel[p.soort] ?? p.soort}</td>
                  <td className="py-2 pr-2">{p.products?.naam ?? p.inhoud ?? "—"}</td>
                  <td className="py-2 pr-2">{p.pallet_types?.naam ?? "—"}</td>
                  <td className="py-2">{STATUS_LABEL[p.status as PalletStatus] ?? p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Handtekeningen */}
          <div className="mt-16 grid grid-cols-2 gap-12 text-sm">
            <div>
              <div className="border-t border-black/40 pt-2 text-black/60">Handtekening klant</div>
            </div>
            <div>
              <div className="border-t border-black/40 pt-2 text-black/60">Handtekening magazijn</div>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-black/40">
            Gegenereerd via Districo Retour · {retour.retournummer}
          </p>
        </div>
      </main>
    </div>
  );
}
