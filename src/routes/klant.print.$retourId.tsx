import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Pallet } from "@/lib/districo";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/klant/print/$retourId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Print QR-codes — Districo Retour" }] }),
  component: PrintPage,
});

async function fetchRetourData(retourId: string) {
  const { data: retour } = await supabase.from("retours").select("*, customers(*)").eq("id", retourId).single();
  const { data: pallets } = await supabase
    .from("pallets")
    .select("*, products(naam), pallet_types(naam)")
    .eq("retour_id", retourId)
    .order("positie");
  return { retour, pallets: (pallets ?? []) as any[] };
}

function PrintPage() {
  const { retourId } = Route.useParams();
  const { data } = useQuery({ queryKey: ["retour-print", retourId], queryFn: () => fetchRetourData(retourId) });

  if (!data?.retour) return <div className="p-10 text-center text-muted-foreground">Laden…</div>;

  const { retour, pallets } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/klant" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-5" /></Link>
            <div>
              <p className="font-semibold text-sm">{retour.retournummer}</p>
              <p className="text-xs text-muted-foreground">{retour.customers?.naam} · {pallets.length} pallets</p>
            </div>
          </div>
          <Button onClick={() => window.print()}><Printer className="size-4" /> Print QR-codes</Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 print:grid-cols-2">
          {pallets.map((p: any) => (
            <div key={p.id} className="rounded-lg border bg-card p-4 text-center break-inside-avoid">
              <div className="grid place-items-center">
                <QRCodeSVG value={p.qr_payload ?? p.id} size={180} />
              </div>
              <p className="mt-3 font-semibold text-sm">{p.palletnummer}</p>
              <p className="text-xs text-muted-foreground">{p.products?.naam} · {p.pallet_types?.naam}</p>
              <p className="text-xs text-muted-foreground">Pallet {p.positie} van {p.totaal}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
