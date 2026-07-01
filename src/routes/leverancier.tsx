import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Leverancier,
  fetchLeveranciers,
  fetchPalletTypes,
  fetchProductsForLeverancier,
  fetchRetoursForLeverancier,
  getOrCreateConceptRetourLeverancier,
  deleteConceptRetour,
  submitRetour,
  leverancierCode,
} from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { RetourWizard, MAX_PALLETS } from "@/components/RetourWizard";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Check, Trash2, FileText, Truck, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leverancier")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leverancier leeggoed-afhaling — Districo Retour" }] }),
  component: LeverancierPage,
});

function LeverancierPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [leverancier, setLeverancier] = useState<Leverancier | null>(null);

  const { data: leveranciers } = useQuery({ queryKey: ["leveranciers"], queryFn: fetchLeveranciers });
  const { data: palletTypes } = useQuery({ queryKey: ["palletTypes"], queryFn: fetchPalletTypes });
  const { data: products } = useQuery({
    queryKey: ["leverancier-products", leverancier?.naam],
    queryFn: () => fetchProductsForLeverancier(leverancier!.naam),
    enabled: !!leverancier,
  });
  const { data: retours } = useQuery({
    queryKey: ["leverancier-retours", leverancier?.id],
    queryFn: () => fetchRetoursForLeverancier(leverancier!.id),
    enabled: !!leverancier,
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const concept = (retours ?? []).find((r) => r.status === "concept") ?? null;
  const ingediend = (retours ?? []).filter((r) => r.status !== "concept");
  const conceptPallets = concept?.pallets ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["leverancier-retours", leverancier?.id] });
  }

  async function openWizard() {
    if (!leverancier) return;
    const c = await getOrCreateConceptRetourLeverancier(leverancier);
    setConceptId(c.id);
    setWizardOpen(true);
    invalidate();
  }

  async function submit() {
    if (!leverancier || !concept) return;
    setBusy(true);
    try {
      await submitRetour(concept, leverancier.naam);
      toast.success(`Retour ${concept.retournummer} ingediend`);
      setWizardOpen(false);
      invalidate();
      navigate({ to: "/klant/print/$retourId", params: { retourId: concept.id } });
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function discardConcept() {
    if (!concept) return;
    if (!confirm("Lopende retour verwijderen?")) return;
    await deleteConceptRetour(concept.id);
    setWizardOpen(false);
    invalidate();
    toast.success("Lopende retour verwijderd");
  }

  // ---- Leverancier kiezen ----
  if (!leverancier) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Leverancier leeggoed-afhaling" />
        <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Truck className="size-6" /></span>
              <div>
                <h2 className="text-xl font-bold">Kies een leverancier</h2>
                <p className="text-sm text-muted-foreground">Enkel de producten van de gekozen leverancier worden getoond.</p>
              </div>
            </div>
          </div>

          {!leveranciers ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {leveranciers.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLeverancier(l)}
                  className="flex items-center justify-between rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent/40"
                >
                  <span>
                    <span className="block font-semibold">{l.naam}</span>
                    {l.plaats && <span className="block text-sm text-muted-foreground">{l.plaats}</span>}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  const code = leverancierCode(leverancier.naam);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Leverancier leeggoed-afhaling" />
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Leverancier header */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leverancier</p>
              <h2 className="mt-1 text-2xl font-bold">{leverancier.naam}</h2>
              {leverancier.plaats && <p className="text-sm text-muted-foreground">{leverancier.plaats}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setLeverancier(null); setWizardOpen(false); }}>
              Andere leverancier
            </Button>
          </div>
        </div>

        {/* Lopende retour */}
        {wizardOpen && conceptId && products && palletTypes ? (
          products.length === 0 ? (
            <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
              Geen producten gekoppeld aan deze leverancier.
            </div>
          ) : (
            <RetourWizard
              code={code}
              actorNaam={leverancier.naam}
              retourId={conceptId}
              pallets={conceptPallets}
              products={products}
              palletTypes={palletTypes}
              onChange={invalidate}
              onClose={() => setWizardOpen(false)}
              onSubmit={submit}
              onDiscard={discardConcept}
              busy={busy}
            />
          )
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lopende retour</h3>
              {concept && <span className="text-sm text-muted-foreground">{concept.retournummer}</span>}
            </div>
            {concept && conceptPallets.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">
                  {conceptPallets.length} van {MAX_PALLETS} pallets ingegeven — nog niet ingediend.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={openWizard}><Pencil className="size-4" /> Verder bewerken</Button>
                  <Button variant="success" onClick={submit} disabled={busy}><Check className="size-4" /> Indienen</Button>
                  <Button variant="outline" onClick={discardConcept}><Trash2 className="size-4" /> Verwijderen</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Geen lopende retour. Start een nieuwe afhaling voor {leverancier.naam}.</p>
                <Button className="mt-3" size="lg" onClick={openWizard}><Plus className="size-5" /> Nieuwe leeggoed-afhaling</Button>
              </div>
            )}
          </div>
        )}

        {/* Vorige retours */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">Vorige afhalingen</h3>
          </div>
          {ingediend.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nog geen ingediende afhalingen.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Retournummer</th>
                  <th className="px-5 py-3 font-medium">Datum</th>
                  <th className="px-5 py-3 font-medium">Pallets</th>
                  <th className="px-5 py-3 font-medium">Ontvangen</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {ingediend.map((r) => {
                  const pl = r.pallets ?? [];
                  const ontv = pl.filter((p: any) => p.status === "ontvangen").length;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-5 py-3 font-medium">{r.retournummer}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("nl-BE")}</td>
                      <td className="px-5 py-3">{pl.length}</td>
                      <td className="px-5 py-3">{ontv} / {pl.length}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-4">
                          <Link to="/klant/document/$retourId" params={{ retourId: r.id }} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                            <FileText className="size-4" /> Document
                          </Link>
                          <Link to="/klant/print/$retourId" params={{ retourId: r.id }} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                            <FileText className="size-4" /> QR-codes
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
