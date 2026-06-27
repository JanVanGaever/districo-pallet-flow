import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  CartLine,
  Customer,
  Product,
  PalletType,
  bevestigRetour,
  fetchCustomers,
  fetchPalletTypes,
  fetchProducts,
} from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/klant")({
  ssr: false,
  head: () => ({ meta: [{ title: "Klantenportaal — Districo Retour" }] }),
  component: KlantPage,
});

const catLabel: Record<string, string> = { bier: "Bier", water: "Water", frisdrank: "Frisdrank" };

const MAX_PALLETS = 33;

const catSlot: Record<string, string> = {
  bier: "bg-warning text-warning-foreground border-warning",
  water: "bg-primary text-primary-foreground border-primary",
  frisdrank: "bg-success text-success-foreground border-success",
};

function KlantPage() {
  const navigate = useNavigate();
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: palletTypes } = useQuery({ queryKey: ["palletTypes"], queryFn: fetchPalletTypes });

  const [customerId, setCustomerId] = useState<string>("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);

  const customer = customers?.find((c) => c.id === customerId);

  async function confirm() {
    if (!customer || cart.length === 0) return;
    setBusy(true);
    try {
      const { retour } = await bevestigRetour(customer, cart);
      toast.success(`Retour ${retour.retournummer} aangemaakt`);
      navigate({ to: "/klant/print/$retourId", params: { retourId: retour.id } });
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Klantenportaal" />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-xl border bg-card p-5">
          <label className="text-sm font-medium">Kies klant</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">— Selecteer een klant —</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naam} (klantnr {c.klantnummer})
              </option>
            ))}
          </select>
          {customer && (
            <p className="mt-2 text-sm text-muted-foreground">
              {customer.naam} · klantnr {customer.klantnummer} · {customer.plaats}
            </p>
          )}
        </div>

        {customer && !wizardOpen && (
          <div className="mt-8 text-center">
            <Button size="lg" className="h-16 px-10 text-lg" onClick={() => { setWizardOpen(true); setCart([]); }}>
              <Plus className="mr-2 size-6" /> Nieuwe retour
            </Button>
          </div>
        )}

        {customer && wizardOpen && products && palletTypes && (
          <Wizard
            products={products}
            palletTypes={palletTypes}
            cart={cart}
            setCart={setCart}
            onClose={() => setWizardOpen(false)}
            onConfirm={confirm}
            busy={busy}
          />
        )}
      </main>
    </div>
  );
}

function Wizard({
  products,
  palletTypes,
  cart,
  setCart,
  onClose,
  onConfirm,
  busy,
}: {
  products: Product[];
  palletTypes: PalletType[];
  cart: CartLine[];
  setCart: (c: CartLine[]) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const defaultType = palletTypes.find((t) => t.naam === "Europallet") ?? palletTypes[0];
  const [palletType, setPalletType] = useState<PalletType>(defaultType);
  const [aantal, setAantal] = useState(1);

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      cat,
      items: products.filter((p) => p.categorie === cat && p.naam.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [products, search]);

  const totaal = cart.reduce((s, l) => s + l.aantal, 0);
  const resterend = MAX_PALLETS - totaal;
  const maxToevoegen = Math.max(0, resterend);

  function addLine() {
    if (!product) return;
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} pallets per retour`);
      return;
    }
    setCart([...cart, { product, palletType, aantal }]);
    setStep(1);
    setProduct(null);
    setPalletType(defaultType);
    setAantal(1);
    toast.success(`${aantal}× ${product.naam} toegevoegd`);
  }


  return (
    <div className="mt-6 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nieuwe retour</h2>
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
            <Button onClick={addLine} disabled={maxToevoegen === 0}><Plus className="size-4" /> Toevoegen aan retour</Button>
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
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(totaal / MAX_PALLETS) * 100}%` }}
          />
        </div>

        {/* Visueel rooster van 33 plekken */}
        <div className="mt-4 grid grid-cols-11 gap-1.5">
          {Array.from({ length: MAX_PALLETS }).map((_, i) => {
            const slot = slots[i];
            return (
              <div
                key={i}
                title={slot ? `${i + 1}. ${slot.product.naam} · ${slot.palletType.naam}` : `Plek ${i + 1} vrij`}
                className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold ${
                  slot ? catSlot[slot.product.categorie] ?? "bg-primary text-primary-foreground border-primary" : "border-dashed border-muted-foreground/30 text-muted-foreground/40"
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

        {cart.length > 0 ? (
          <>
            <ul className="mt-4 space-y-2">
              {cart.map((l, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block size-3 rounded ${catSlot[l.product.categorie]}`} />
                    {l.aantal}× {l.product.naam} · {l.palletType.naam}
                  </span>
                  <button onClick={() => setCart(cart.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button className="mt-4 w-full h-12" onClick={onConfirm} disabled={busy}>
              <Check className="size-5" /> {busy ? "Bezig…" : "Retour bevestigen"}
            </Button>
          </>
        ) : (
          <p className="mt-4 text-center text-sm text-muted-foreground">Nog geen pallets toegevoegd</p>
        )}
      </div>

    </div>
  );
}
