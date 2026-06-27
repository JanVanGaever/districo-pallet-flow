import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  CartLine,
  Customer,
  Product,
  PalletType,
  
  fetchDefaultCustomer,
  fetchPalletTypes,
  fetchProducts,
  fetchRetoursForCustomer,
  getOrCreateConceptRetour,
  addLineToRetour,
  addMixedPalletToRetour,
  removePalletFromRetour,
  deleteConceptRetour,
  submitRetour,
} from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Check, ArrowLeft, Pencil, FileText, Package, Layers, Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/klant")({
  ssr: false,
  head: () => ({ meta: [{ title: "Klantenportaal — Districo Retour" }] }),
  component: KlantPage,
});

const catLabel: Record<string, string> = { bier: "Bier", water: "Water", frisdrank: "Limonade" };

const MAX_PALLETS = 33;

const catSlot: Record<string, string> = {
  bier: "bg-warning text-warning-foreground border-warning",
  water: "bg-primary text-primary-foreground border-primary",
  frisdrank: "bg-success text-success-foreground border-success",
};


function KlantPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: customer } = useQuery({ queryKey: ["default-customer"], queryFn: fetchDefaultCustomer });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: palletTypes } = useQuery({ queryKey: ["palletTypes"], queryFn: fetchPalletTypes });
  const { data: retours } = useQuery({
    queryKey: ["customer-retours", customer?.id],
    queryFn: () => fetchRetoursForCustomer(customer!.id),
    enabled: !!customer,
  });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const concept = (retours ?? []).find((r) => r.status === "concept") ?? null;
  const ingediend = (retours ?? []).filter((r) => r.status !== "concept");

  const allPallets = ingediend.flatMap((r) => r.pallets ?? []);
  const palletStats = {
    totaal: allPallets.length,
    klaar: allPallets.filter((p: any) => p.status === "klaar_voor_retour").length,
    ontvangen: allPallets.filter((p: any) => p.status === "ontvangen").length,
  };

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["customer-retours", customer?.id] });
  }

  async function openWizard() {
    if (!customer) return;
    const c = await getOrCreateConceptRetour(customer);
    setConceptId(c.id);
    setWizardOpen(true);
    invalidate();
  }

  async function submit() {
    if (!customer || !concept) return;
    setBusy(true);
    try {
      await submitRetour(concept, customer);
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

  if (!customer) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Klantenportaal" />
        <main className="mx-auto max-w-4xl px-6 py-8 text-muted-foreground">Laden…</main>
      </div>
    );
  }

  const conceptPallets = concept?.pallets ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Klantenportaal" />
      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Klant header */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Welkom</p>
          <h2 className="mt-1 text-2xl font-bold">{customer.naam}</h2>
          <p className="text-sm text-muted-foreground">Klantnr {customer.klantnummer} · {customer.plaats}</p>
        </div>

        {/* Pallet-overzicht */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pallets ingediend", value: palletStats.totaal },
            { label: "Klaar voor retour", value: palletStats.klaar },
            { label: "Ontvangen", value: palletStats.ontvangen },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-3xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Lopende retour */}
        {wizardOpen && conceptId && products && palletTypes ? (
          <Wizard
            customer={customer}
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
                  <Button variant="success" onClick={submit} disabled={busy}>
                    <Check className="size-4" /> Indienen
                  </Button>
                  <Button variant="outline" onClick={discardConcept}><Trash2 className="size-4" /> Verwijderen</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Geen lopende retour. Start een nieuwe retour.</p>
                <Button className="mt-3" size="lg" onClick={openWizard}><Plus className="size-5" /> Nieuwe retour</Button>
              </div>
            )}
          </div>
        )}

        {/* Vorige retours */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h3 className="font-semibold">Vorige retours</h3>
          </div>
          {ingediend.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nog geen ingediende retours.</p>
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
                        <Link to="/klant/print/$retourId" params={{ retourId: r.id }} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                          <FileText className="size-4" /> QR-codes
                        </Link>
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

function Wizard({
  customer,
  retourId,
  pallets,
  products,
  palletTypes,
  onChange,
  onClose,
  onSubmit,
  onDiscard,
  busy,
}: {
  customer: Customer;
  retourId: string;
  pallets: any[];
  products: Product[];
  palletTypes: PalletType[];
  onChange: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  const [soort, setSoort] = useState<"vol" | "mixed" | null>(null);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [mixSelected, setMixSelected] = useState<Product[]>([]);
  const defaultType = palletTypes.find((t) => t.naam === "Europallet") ?? palletTypes[0];
  const [palletType, setPalletType] = useState<PalletType>(defaultType);
  const [aantal, setAantal] = useState(1);
  const [working, setWorking] = useState(false);

  function resetWizard() {
    setSoort(null);
    setStep(1);
    setProduct(null);
    setMixSelected([]);
    setPalletType(defaultType);
    setAantal(1);
    setSearch("");
    setCatFilter(null);
  }

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      cat,
      items: products.filter((p) => p.categorie === cat && p.naam.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0 && (!catFilter || g.cat === catFilter));
  }, [products, search, catFilter]);

  const totaal = pallets.length;
  const resterend = MAX_PALLETS - totaal;
  const maxToevoegen = Math.max(0, resterend);

  const sortedPallets = pallets.slice().sort((a, b) => (a.positie ?? 0) - (b.positie ?? 0));

  // Group persisted pallets into lines for a compact list
  const lines = useMemo(() => {
    const map = new Map<string, { naam: string; categorie: string; type: string; ids: string[] }>();
    for (const p of sortedPallets) {
      const key = `${p.product_id}|${p.pallet_type_id}`;
      let g = map.get(key);
      if (!g) {
        g = { naam: p.products?.naam ?? "?", categorie: p.products?.categorie ?? "", type: p.pallet_types?.naam ?? "", ids: [] };
        map.set(key, g);
      }
      g.ids.push(p.id);
    }
    return Array.from(map.values());
  }, [sortedPallets]);

  async function addLine() {
    if (!product) return;
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} pallets per retour`);
      return;
    }
    setWorking(true);
    try {
      await addLineToRetour(retourId, customer, { product, palletType, aantal });
      onChange();
      toast.success(`${aantal}× ${product.naam} toegevoegd`);
      resetWizard();
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setWorking(false);
    }
  }

  function toggleMix(p: Product) {
    setMixSelected((prev) =>
      prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p],
    );
  }

  async function addMixed() {
    if (mixSelected.length < 2) {
      toast.error("Kies minstens 2 producten voor een gemixte pallet");
      return;
    }
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} pallets per retour`);
      return;
    }
    setWorking(true);
    try {
      const inhoud = mixSelected.map((p) => p.naam).join(", ");
      await addMixedPalletToRetour(retourId, customer, { palletType, aantal, inhoud });
      onChange();
      toast.success(`${aantal}× gemixte pallet toegevoegd`);
      resetWizard();
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setWorking(false);
    }
  }


  async function removeOne(id: string) {
    setWorking(true);
    try {
      await removePalletFromRetour(id, retourId);
      onChange();
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Lopende retour bewerken</h2>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Sluiten</button>
      </div>

      <div className="mt-4 flex gap-2 text-xs">
        {[1, 2, 3].map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            Stap {s}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="mt-5">
          <Input placeholder="Zoek product…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = catFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCatFilter(active ? null : cat)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${active ? catSlot[cat] : "hover:border-primary"}`}
                >
                  <span className={`inline-block size-2.5 rounded-full ${active ? "bg-current opacity-80" : catSlot[cat]}`} />
                  {catLabel[cat]}
                </button>
              );
            })}
          </div>
          {grouped.map((g) => (
            <div key={g.cat} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{catLabel[g.cat]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setProduct(p); setStep(2); }}
                    className={`rounded-lg border p-3 text-left transition-colors hover:border-primary ${product?.id === p.id ? "border-primary bg-accent/40" : ""}`}
                  >
                    <p className="font-medium text-sm">{p.naam}</p>
                    <p className="text-xs text-muted-foreground">€{p.leeggoedwaarde_per_bak.toFixed(2)}/bak</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && product && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground mb-3">Gekozen: <span className="font-medium text-foreground">{product.naam}</span></p>
          <p className="text-sm font-medium">Pallettype</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {palletTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => setPalletType(t)}
                className={`rounded-lg border p-3 text-sm transition-colors hover:border-primary ${palletType.id === t.id ? "border-primary bg-accent/40 font-medium" : ""}`}
              >
                {t.naam}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Terug</Button>
            <Button onClick={() => setStep(3)}>Verder</Button>
          </div>
        </div>
      )}

      {step === 3 && product && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">{product.naam} · {palletType.naam}</p>
          <p className="mt-4 text-sm font-medium">Aantal pallets</p>
          <div className="mt-2 flex items-center gap-4">
            <Button variant="outline" size="icon" className="size-12" onClick={() => setAantal(Math.max(1, aantal - 1))}><Minus /></Button>
            <span className="w-12 text-center text-2xl font-bold">{aantal}</span>
            <Button
              variant="outline"
              size="icon"
              className="size-12"
              disabled={aantal >= maxToevoegen}
              onClick={() => setAantal(Math.min(maxToevoegen, aantal + 1))}
            >
              <Plus />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Nog {maxToevoegen} van {MAX_PALLETS} pallets beschikbaar</p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> Terug</Button>
            <Button onClick={addLine} disabled={maxToevoegen === 0 || working}><Plus className="size-4" /> Toevoegen aan retour</Button>
          </div>
        </div>
      )}

      <div className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Overzicht retour</p>
          <p className="text-sm font-semibold tabular-nums">
            <span className={totaal >= MAX_PALLETS ? "text-warning" : "text-foreground"}>{totaal}</span>
            <span className="text-muted-foreground"> / {MAX_PALLETS} pallets</span>
          </p>
        </div>

        {/* Voortgangsbalk */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(totaal / MAX_PALLETS) * 100}%` }} />
        </div>

        {/* Visueel rooster van 33 plekken */}
        <div className="mt-4 grid grid-cols-11 gap-1.5">
          {Array.from({ length: MAX_PALLETS }).map((_, i) => {
            const slot = sortedPallets[i];
            return (
              <div
                key={i}
                title={slot ? `${i + 1}. ${slot.products?.naam} · ${slot.pallet_types?.naam}` : `Plek ${i + 1} vrij`}
                className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold ${
                  slot ? catSlot[slot.products?.categorie] ?? "bg-primary text-primary-foreground border-primary" : "border-dashed border-muted-foreground/30 text-muted-foreground/40"
                }`}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {CATEGORIES.map((cat) => (
            <span key={cat} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 rounded ${catSlot[cat]}`} /> {catLabel[cat]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded border border-dashed border-muted-foreground/40" /> Vrij
          </span>
        </div>

        {lines.length > 0 ? (
          <>
            <ul className="mt-4 space-y-2">
              {lines.map((l) => (
                <li key={l.naam + l.type} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block size-3 rounded ${catSlot[l.categorie]}`} />
                    {l.ids.length}× {l.naam} · {l.type}
                  </span>
                  <button onClick={() => removeOne(l.ids[l.ids.length - 1])} disabled={working} className="text-muted-foreground hover:text-destructive" title="Eén verwijderen">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1 h-12" variant="success" onClick={onSubmit} disabled={busy || working}>
                <Check className="size-5" /> {busy ? "Bezig…" : "Retour indienen"}
              </Button>
              <Button className="h-12" variant="outline" onClick={onDiscard} disabled={busy || working}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-1 py-4 text-center text-sm text-muted-foreground">
            <Package className="size-6 opacity-50" />
            Nog geen pallets toegevoegd
          </div>
        )}
      </div>
    </div>
  );
}
