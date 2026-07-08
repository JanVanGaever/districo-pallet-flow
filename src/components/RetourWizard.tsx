import { useMemo, useState } from "react";
import {
  CATEGORIES,
  Product,
  PalletType,
  addLineToRetour,
  addMixedPalletToRetour,
  addLeeggoedPalletToRetour,
  addLegePalletsToRetour,
  removePalletFromRetour,
} from "@/lib/districo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Check, ArrowLeft, Package, Layers, Boxes, Beer, Box, Truck } from "lucide-react";
import { toast } from "sonner";

const catLabel: Record<string, string> = {
  bier: "Bier",
  water: "Water",
  frisdrank: "Limonade",
  mixed: "Gemixt",
  lege_bakken: "Lege bakken",
  lege_flesjes: "Lege flesjes",
  lege_pallet: "Lege pallets",
};

export const MAX_PALLETS = 33;

const catSlot: Record<string, string> = {
  bier: "bg-warning text-warning-foreground border-warning",
  water: "bg-primary text-primary-foreground border-primary",
  frisdrank: "bg-success text-success-foreground border-success",
  mixed: "bg-secondary text-secondary-foreground border-secondary",
  lege_bakken: "bg-muted-foreground text-background border-muted-foreground",
  lege_flesjes: "bg-accent-foreground text-accent border-accent-foreground",
  lege_pallet: "bg-foreground text-background border-foreground",
};

export function RetourWizard({
  code,
  actorNaam,
  retourId,
  pallets,
  products,
  palletTypes,
  onChange,
  onClose,
  onSubmit,
  onDiscard,
  busy,
  allowLeeg = true,
}: {
  code: string;
  actorNaam: string;
  retourId: string;
  pallets: any[];
  products: Product[];
  palletTypes: PalletType[];
  onChange: () => void;
  onClose: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  busy: boolean;
  allowLeeg?: boolean;
}) {
  const [soort, setSoort] = useState<"vol" | "mixed" | "lege_bakken" | "lege_flesjes" | null>(null);
  const isLeeg = soort === "lege_bakken" || soort === "lege_flesjes";
  const soortLabel = soort === "vol" ? "Volle pallet" : soort === "mixed" ? "Gemixte pallet" : soort === "lege_bakken" ? "Lege bakken" : "Lege flesjes";
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
    const POPULAR: Record<string, string[]> = {
      bier: ["jupiler", "maes", "cristal", "leffe", "duvel", "liefmans"],
      water: ["spa reine", "spa bruisend", "san pelegrino", "chaudfontaine plat", "chaudfontaine bruisend", "eulala"],
    };
    const rank = (cat: string, naam: string) => {
      const list = POPULAR[cat];
      if (!list) return Infinity;
      const n = naam.toLowerCase();
      const idx = list.findIndex((k) => n.includes(k));
      return idx === -1 ? Infinity : idx;
    };
    return CATEGORIES.map((cat) => ({
      cat,
      items: products
        .filter((p) => p.categorie === cat && p.naam.toLowerCase().includes(q))
        .sort((a, b) => {
          const ra = rank(cat, a.naam);
          const rb = rank(cat, b.naam);
          if (ra !== rb) return ra - rb;
          return a.naam.localeCompare(b.naam);
        }),
    })).filter((g) => g.items.length > 0 && (!catFilter || g.cat === catFilter));
  }, [products, search, catFilter]);

  const totaal = pallets.length;
  const resterend = MAX_PALLETS - totaal;
  const maxToevoegen = Math.max(0, resterend);

  const sortedPallets = pallets.slice().sort((a, b) => (a.positie ?? 0) - (b.positie ?? 0));

  const lines = useMemo(() => {
    const map = new Map<string, { naam: string; categorie: string; type: string; soort: string; inhoud: string | null; ids: string[] }>();
    for (const p of sortedPallets) {
      const isMixed = p.soort === "mixed";
      const isLeegP = p.soort === "lege_bakken" || p.soort === "lege_flesjes";
      const key = isMixed
        ? `mixed|${p.inhoud}|${p.pallet_type_id}`
        : isLeegP
          ? `${p.soort}|${p.product_id}|${p.pallet_type_id}`
          : `${p.product_id}|${p.pallet_type_id}`;
      let g = map.get(key);
      if (!g) {
        const leegNaam = p.soort === "lege_bakken" ? "Lege bakken" : "Lege flesjes";
        g = {
          naam: isMixed ? "Gemixte pallet" : isLeegP ? leegNaam : p.products?.naam ?? "?",
          categorie: isMixed ? "mixed" : isLeegP ? p.soort : p.products?.categorie ?? "",
          type: p.pallet_types?.naam ?? "",
          soort: p.soort ?? "vol",
          inhoud: isLeegP && p.products?.naam ? p.products.naam : p.inhoud ?? null,
          ids: [],
        };
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
      await addLineToRetour(retourId, code, { product, palletType, aantal });
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
      await addMixedPalletToRetour(retourId, code, { palletType, aantal, inhoud });
      onChange();
      toast.success(`${aantal}× gemixte pallet toegevoegd`);
      resetWizard();
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setWorking(false);
    }
  }

  async function addLeeg() {
    if (!isLeeg) return;
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} pallets per retour`);
      return;
    }
    setWorking(true);
    try {
      await addLeeggoedPalletToRetour(retourId, code, {
        soort: soort as "lege_bakken" | "lege_flesjes",
        product,
        palletType,
        aantal,
      });
      onChange();
      toast.success(`${aantal}× ${soortLabel} toegevoegd`);
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

      {soort && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <button onClick={resetWizard} className="rounded-full bg-accent px-3 py-1 font-medium text-accent-foreground hover:bg-accent/70">
            {soortLabel} ✕
          </button>
          {[1, 2].map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              Stap {s}
            </span>
          ))}
        </div>
      )}

      {/* Eerste keuze: volle of gemixte pallet */}
      {!soort && (
        <div className="mt-5">
          <p className="text-sm font-medium">Nieuwe pallet — wat wil je ingeven?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => { setSoort("vol"); setStep(1); }}
              className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent/30"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Boxes className="size-5" /></span>
              <span className="font-semibold">Volle pallet</span>
              <span className="text-xs text-muted-foreground">Eén product per pallet — supersnel (bv. 1 volle pallet Jupiler).</span>
            </button>
            <button
              onClick={() => { setSoort("mixed"); setStep(1); }}
              className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent/30"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Layers className="size-5" /></span>
              <span className="font-semibold">Gemixte pallet</span>
              <span className="text-xs text-muted-foreground">Meerdere producten samen op één pallet.</span>
            </button>
            {allowLeeg && (
              <>
                <button
                  onClick={() => { setSoort("lege_bakken"); setStep(1); setProduct(null); }}
                  className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Box className="size-5" /></span>
                  <span className="font-semibold">Lege bakken</span>
                  <span className="text-xs text-muted-foreground">Bakken zonder flesjes — optioneel per merk.</span>
                </button>
                <button
                  onClick={() => { setSoort("lege_flesjes"); setStep(1); setProduct(null); }}
                  className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent/30"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Beer className="size-5" /></span>
                  <span className="font-semibold">Lege flesjes</span>
                  <span className="text-xs text-muted-foreground">Flesjes zonder bak — optioneel per merk.</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* VOLLE PALLET — stap 1: product kiezen */}
      {soort === "vol" && step === 1 && (
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
                    <p className="font-medium text-sm">{p.naam}{p.inhoud ? ` · ${p.inhoud}` : ""}</p>
                    <p className="text-xs text-muted-foreground">€{p.leeggoedwaarde_per_bak.toFixed(2)}/bak</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LEGE BAKKEN / FLESJES — stap 1: optioneel een merk kiezen */}
      {isLeeg && step === 1 && (
        <div className="mt-5">
          <p className="text-sm font-medium">{soortLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kies optioneel een merk/product, of ga meteen verder zonder specifiek merk.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => { setProduct(null); setStep(2); }}>
              Zonder specifiek merk
            </Button>
          </div>
          <Input className="mt-4" placeholder="Zoek merk/product…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GEMIXTE PALLET — stap 1: producten kiezen */}
      {soort === "mixed" && step === 1 && (
        <div className="mt-5">
          <p className="text-sm font-medium">Kies de producten op deze pallet</p>
          <Input className="mt-2" placeholder="Zoek product…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                {g.items.map((p) => {
                  const sel = mixSelected.some((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleMix(p)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-primary ${sel ? "border-primary bg-accent/40" : ""}`}
                    >
                      <span>
                        <span className="block font-medium text-sm">{p.naam}</span>
                        <span className="block text-xs text-muted-foreground">€{p.leeggoedwaarde_per_bak.toFixed(2)}/bak</span>
                      </span>
                      {sel && <Check className="size-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{mixSelected.length} product(en) gekozen</p>
            <Button onClick={() => setStep(2)} disabled={mixSelected.length < 2}>Verder</Button>
          </div>
        </div>
      )}

      {/* Stap 2: pallettype + aantal + toevoegen (beide soorten) */}
      {step === 2 && (soort === "vol" ? !!product : soort === "mixed" ? mixSelected.length >= 2 : true) && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground mb-3">
            {soort === "vol"
              ? <>Gekozen: <span className="font-medium text-foreground">{product?.naam}</span></>
              : soort === "mixed"
                ? <>Gemixte pallet: <span className="font-medium text-foreground">{mixSelected.map((p) => p.naam).join(", ")}</span></>
                : <>{soortLabel}: <span className="font-medium text-foreground">{product?.naam ?? "geen specifiek merk"}</span></>}
          </p>
          <p className="text-sm font-medium">Pallettype</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {palletTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => setPalletType(t)}
                className={`rounded-lg border p-3 text-sm transition-colors hover:border-primary ${palletType.id === t.id ? "border-primary bg-accent/40 font-medium" : ""}`}
              >
                {t.naam}
                {t.standaard_bakken != null && (
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.standaard_bakken} bakken/pallet</span>
                )}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium">Aantal pallets</p>
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
            <div className="ml-1 flex flex-wrap gap-1.5">
              {[1, 2, 5, 10].filter((n) => n <= maxToevoegen).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAantal(n)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors hover:border-primary ${aantal === n ? "border-primary bg-accent/40 font-medium" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Nog {maxToevoegen} van {MAX_PALLETS} pallets beschikbaar</p>
          {soort === "vol" && palletType.standaard_bakken != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              ≈ {aantal * palletType.standaard_bakken} bakken ({palletType.standaard_bakken}/pallet × {aantal})
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Terug</Button>
            <Button onClick={soort === "vol" ? addLine : soort === "mixed" ? addMixed : addLeeg} disabled={maxToevoegen === 0 || working}>
              <Plus className="size-4" /> {aantal}× toevoegen aan retour
            </Button>
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
            const slotLeeg = slot && (slot.soort === "lege_bakken" || slot.soort === "lege_flesjes");
            const slotCat = slot ? (slot.soort === "mixed" ? "mixed" : slotLeeg ? slot.soort : slot.products?.categorie) : null;
            const slotTitle = slot
              ? slot.soort === "mixed"
                ? `${i + 1}. Gemixte pallet (${slot.inhoud ?? "—"}) · ${slot.pallet_types?.naam}`
                : slotLeeg
                  ? `${i + 1}. ${slot.inhoud ?? catLabel[slot.soort]} · ${slot.pallet_types?.naam}`
                  : `${i + 1}. ${slot.products?.naam} · ${slot.pallet_types?.naam}`
              : `Plek ${i + 1} vrij`;
            return (
              <div
                key={i}
                title={slotTitle}
                className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold ${
                  slot ? catSlot[slotCat] ?? "bg-primary text-primary-foreground border-primary" : "border-dashed border-muted-foreground/30 text-muted-foreground/40"
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
            <span className={`inline-block size-3 rounded ${catSlot.mixed}`} /> Gemixt
          </span>
          {allowLeeg && (
            <>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block size-3 rounded ${catSlot.lege_bakken}`} /> Lege bakken
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`inline-block size-3 rounded ${catSlot.lege_flesjes}`} /> Lege flesjes
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded border border-dashed border-muted-foreground/40" /> Vrij
          </span>
        </div>

        {lines.length > 0 ? (
          <>
            <ul className="mt-4 space-y-2">
              {lines.map((l) => (
                <li key={l.naam + l.type + (l.inhoud ?? "")} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block size-3 shrink-0 rounded ${catSlot[l.categorie] ?? catSlot.mixed}`} />
                    <span>
                      {l.ids.length}× {l.naam} · {l.type}
                      {(l.soort === "mixed" || l.soort === "lege_bakken" || l.soort === "lege_flesjes") && l.inhoud && (
                        <span className="block text-xs text-muted-foreground">{l.inhoud}</span>
                      )}
                    </span>
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
