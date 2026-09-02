import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Minus, Plus, Trash2, Check, ArrowLeft, Package, Layers, Boxes, Box, Truck } from "lucide-react";
import { toast } from "sonner";
import { CatChips, FavStar, groupProducts, pickerCatLabel } from "@/components/ProductFilters";

const catLabel: Record<string, string> = {
  fav: "Favorieten",
  bier: "Bier",
  water: "Water",
  frisdrank: "Limonade",
  mixed: "Gemixt",
  lege_bakken: "Lege bakken",
  lege_flesjes: "Lege flesjes",
  lege_pallet: "Lege pallets",
};

export const MAX_PALLETS = 33;
// Lege pallets worden gestapeld: max 20 lege pallets op één plaats
export const LEGE_PER_PLAATS = 20;

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
  const [soort, setSoort] = useState<"vol" | "mixed" | "lege_bakken" | "lege_flesjes" | "lege_pallet" | null>(null);
  const isLeeg = soort === "lege_bakken" || soort === "lege_flesjes";
  const soortLabel = soort === "vol" ? "Volle pallet" : soort === "mixed" ? "Gemixte pallet" : soort === "lege_bakken" ? "Lege bakken" : soort === "lege_pallet" ? "Lege pallets" : "Lege flesjes";
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [mixSelected, setMixSelected] = useState<Product[]>([]);
  const [mixQty, setMixQty] = useState<Record<string, number>>({});
  const defaultType = palletTypes.find((t) => t.naam === "Europallet") ?? palletTypes[0];
  const [palletType, setPalletType] = useState<PalletType>(defaultType);
  const [aantal, setAantal] = useState(1);
  const [legeCounts, setLegeCounts] = useState<Record<string, number>>({});
  const [working, setWorking] = useState(false);

  function resetWizard() {
    setSoort(null);
    setStep(1);
    setProduct(null);
    setMixSelected([]);
    setMixQty({});
    setPalletType(defaultType);
    setAantal(1);
    setLegeCounts({});
    setSearch("");
    setCatFilter(null);
  }

  const favQc = useQueryClient();
  const onProductsChanged = () => favQc.invalidateQueries({ queryKey: ["products"] });
  const grouped = useMemo(() => groupProducts(products, search, catFilter), [products, search, catFilter]);
  const favCount = useMemo(() => products.filter((p) => p.favoriet).length, [products]);

  const sortedPallets = pallets.slice().sort((a, b) => (a.positie ?? 0) - (b.positie ?? 0));

  // Lege pallets worden gestapeld: max 20 per plaats op de vrachtwagen
  const legePerType = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of sortedPallets as any[]) {
      if (p.soort === "lege_pallet") {
        const k = p.pallet_type_id ?? "?";
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return m;
  }, [sortedPallets]);

  const legePlaatsen = Array.from(legePerType.values()).reduce((s, n) => s + Math.ceil(n / LEGE_PER_PLAATS), 0);
  const totaal = (sortedPallets as any[]).filter((p) => p.soort !== "lege_pallet").length + legePlaatsen;
  const resterend = Math.max(0, MAX_PALLETS - totaal);
  const restInStapel = (() => {
    const n = legePerType.get(palletType?.id ?? "") ?? 0;
    const rest = n % LEGE_PER_PLAATS;
    return rest === 0 ? 0 : LEGE_PER_PLAATS - rest;
  })();
  const maxToevoegen =
    soort === "lege_pallet" ? restInStapel + resterend * LEGE_PER_PLAATS : resterend;

  const slots = useMemo(() => {
    const res: { cat: string; title: string; badge?: string }[] = [];
    const legeGroups = new Map<string, { naam: string; count: number }>();
    for (const p of sortedPallets as any[]) {
      if (p.soort === "lege_pallet") {
        const k = p.pallet_type_id ?? "?";
        const g = legeGroups.get(k) ?? { naam: p.pallet_types?.naam ?? "Pallet", count: 0 };
        g.count += 1;
        legeGroups.set(k, g);
        continue;
      }
      const isLeeg = p.soort === "lege_bakken" || p.soort === "lege_flesjes";
      res.push({
        cat: p.soort === "mixed" ? "mixed" : isLeeg ? p.soort : p.products?.categorie ?? "",
        title:
          p.soort === "mixed"
            ? `Gemixte pallet (${p.inhoud ?? "—"}) · ${p.pallet_types?.naam}`
            : isLeeg
              ? `${p.inhoud ?? catLabel[p.soort]} · ${p.pallet_types?.naam}`
              : `${p.products?.naam} · ${p.pallet_types?.naam}`,
      });
    }
    for (const g of legeGroups.values()) {
      const stapels = Math.ceil(g.count / LEGE_PER_PLAATS);
      for (let s = 0; s < stapels; s++) {
        const n = Math.min(LEGE_PER_PLAATS, g.count - s * LEGE_PER_PLAATS);
        res.push({
          cat: "lege_pallet",
          title: `Stapel van ${n} lege ${g.naam} (max ${LEGE_PER_PLAATS} per plaats)`,
          badge: `×${n}`,
        });
      }
    }
    return res;
  }, [sortedPallets]);


  const lines = useMemo(() => {
    const map = new Map<string, { naam: string; categorie: string; type: string; soort: string; inhoud: string | null; ids: string[] }>();
    for (const p of sortedPallets) {
      const isMixed = p.soort === "mixed";
      const isLegePal = p.soort === "lege_pallet";
      const isLeegP = p.soort === "lege_bakken" || p.soort === "lege_flesjes";
      const key = isMixed
        ? `mixed|${p.inhoud}|${p.pallet_type_id}`
        : isLegePal
          ? `lege_pallet|${p.pallet_type_id}`
          : isLeegP
            ? `${p.soort}|${p.product_id}|${p.pallet_type_id}`
            : `${p.product_id}|${p.pallet_type_id}`;
      let g = map.get(key);
      if (!g) {
        const leegNaam = p.soort === "lege_bakken" ? "Lege bakken" : "Lege flesjes";
        g = {
          naam: isMixed ? "Gemixte pallet" : isLegePal ? "Lege pallet" : isLeegP ? leegNaam : p.products?.naam ?? "?",
          categorie: isMixed ? "mixed" : isLegePal ? "lege_pallet" : isLeegP ? p.soort : p.products?.categorie ?? "",
          type: p.pallet_types?.naam ?? "",
          soort: p.soort ?? "vol",
          inhoud: isLeegP && p.products?.naam ? p.products.naam : isLegePal ? null : p.inhoud ?? null,
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
      toast.error(`Maximaal ${MAX_PALLETS} plaatsen per vrachtwagen`);
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
    setMixSelected((prev) => {
      const has = prev.some((x) => x.id === p.id);
      if (has) {
        setMixQty((q) => {
          const { [p.id]: _drop, ...rest } = q;
          return rest;
        });
        return prev.filter((x) => x.id !== p.id);
      }
      setMixQty((q) => ({ ...q, [p.id]: q[p.id] ?? 1 }));
      return [...prev, p];
    });
  }

  function setMixBakken(p: Product, n: number, removeAtZero = true) {
    const val = Math.max(0, Math.min(99, Math.round(n || 0)));
    if (val === 0 && removeAtZero) {

      setMixSelected((prev) => prev.filter((x) => x.id !== p.id));
      setMixQty((q) => {
        const { [p.id]: _drop, ...rest } = q;
        return rest;
      });
      return;
    }
    setMixQty((q) => ({ ...q, [p.id]: val }));
  }

  const mixTotaalBakken = mixSelected.reduce((s, p) => s + (mixQty[p.id] ?? 0), 0);
  const mixOmschrijving = mixSelected.map((p) => `${mixQty[p.id] ?? 0}× ${p.naam}`).join(", ");
  const mixWaarde = mixSelected.reduce((s, p) => s + (mixQty[p.id] ?? 0) * (p.leeggoedwaarde_per_bak ?? 0), 0);

  async function addMixed() {
    if (mixSelected.length < 2) {
      toast.error("Kies minstens 2 producten voor een gemixte pallet");
      return;
    }
    if (mixTotaalBakken === 0) {
      toast.error("Geef het aantal bakken per product in");
      return;
    }
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} plaatsen per vrachtwagen`);
      return;
    }
    setWorking(true);
    try {
      const inhoud = mixOmschrijving;
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
      toast.error(`Maximaal ${MAX_PALLETS} plaatsen per vrachtwagen`);
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


  async function addLegePallets() {
    if (aantal > maxToevoegen) {
      toast.error(`Maximaal ${MAX_PALLETS} plaatsen per vrachtwagen`);
      return;
    }
    setWorking(true);
    try {
      await addLegePalletsToRetour(retourId, code, [{ palletType, aantal }]);
      onChange();
      toast.success(`${aantal}× lege ${palletType.naam} toegevoegd`);
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Lopende retour bewerken</h2>
        <div className="flex items-center gap-3">
          {soort === "mixed" && (
            <Button size="sm" onClick={addMixed} disabled={mixSelected.length < 2 || mixTotaalBakken === 0 || working}>
              Toevoegen aan retour
            </Button>
          )}
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Sluiten</button>
        </div>
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
              </>
            )}
            <button
              onClick={() => { setSoort("lege_pallet"); setProduct(null); setLegeCounts({}); setStep(2); }}
              className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent/30"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Truck className="size-5" /></span>
              <span className="font-semibold">Lege pallets</span>
              <span className="text-xs text-muted-foreground">Enkel lege pallets — kies type en aantal.</span>
            </button>
          </div>
        </div>
      )}

      {/* VOLLE PALLET — stap 1: product kiezen */}
      {soort === "vol" && step === 1 && (
        <div className="mt-5">
          <Input placeholder="Zoek product…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <CatChips catFilter={catFilter} setCatFilter={setCatFilter} favCount={favCount} />
          {grouped.map((g) => (
            <div key={g.cat} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pickerCatLabel[g.cat] ?? catLabel[g.cat]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.items.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-start gap-1 rounded-lg border p-3 transition-colors hover:border-primary ${product?.id === p.id ? "border-primary bg-accent/40" : ""}`}
                  >
                    <button onClick={() => { setProduct(p); setStep(2); }} className="min-w-0 flex-1 text-left">
                      <p className="font-medium text-sm">{p.naam}{p.inhoud ? ` · ${p.inhoud}` : ""}</p>
                      <p className="text-xs text-muted-foreground">€{p.leeggoedwaarde_per_bak.toFixed(2)}/bak</p>
                    </button>
                    <FavStar product={p} onChange={onProductsChanged} />
                  </div>
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
          <CatChips catFilter={catFilter} setCatFilter={setCatFilter} favCount={favCount} />
          {grouped.map((g) => (
            <div key={g.cat} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pickerCatLabel[g.cat] ?? catLabel[g.cat]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.items.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-start gap-1 rounded-lg border p-3 transition-colors hover:border-primary ${product?.id === p.id ? "border-primary bg-accent/40" : ""}`}
                  >
                    <button onClick={() => { setProduct(p); setStep(2); }} className="min-w-0 flex-1 text-left">
                      <p className="font-medium text-sm">{p.naam}</p>
                    </button>
                    <FavStar product={p} onChange={onProductsChanged} />
                  </div>
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
          <CatChips catFilter={catFilter} setCatFilter={setCatFilter} favCount={favCount} />
          {grouped.map((g) => (
            <div key={g.cat} className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{pickerCatLabel[g.cat] ?? catLabel[g.cat]}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {g.items.map((p) => {
                  const sel = mixSelected.some((x) => x.id === p.id);
                  const n = mixQty[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 transition-colors ${sel ? "border-primary bg-accent/40" : "hover:border-primary"}`}
                    >
                      <div className="flex items-start gap-1">
                        <button type="button" onClick={() => toggleMix(p)} className="min-w-0 flex-1 text-left">
                          <span className="block font-medium text-sm">{p.naam}</span>
                          <span className="block text-xs text-muted-foreground">€{p.leeggoedwaarde_per_bak.toFixed(2)}/bak</span>
                        </button>
                        <FavStar product={p} onChange={onProductsChanged} />
                      </div>
                      {sel ? (
                        <div className="mt-2 flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMixBakken(p, n - 1)}>−</Button>
                          <Input
                            className="h-7 w-14 text-center"
                            inputMode="numeric"
                            value={n === 0 ? "" : String(n)}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setMixBakken(p, Number(e.target.value.replace(/\D/g, "")), false)}
                            onBlur={() => { if ((mixQty[p.id] ?? 0) === 0) setMixBakken(p, 1, false); }}
                          />

                          <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMixBakken(p, n + 1)}>+</Button>
                          <span className="ml-1 text-xs text-muted-foreground">bakken</span>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">Tik om toe te voegen</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {mixSelected.length > 0 && (
            <div className="sticky bottom-0 mt-4 rounded-lg border bg-card p-3 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Op deze pallet</p>
              <ul className="mt-2 space-y-1.5">
                {mixSelected.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      <span className="font-medium tabular-nums">{mixQty[p.id] ?? 0}×</span> {p.naam}
                    </span>
                    <span className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMixBakken(p, (mixQty[p.id] ?? 0) - 1)}>−</Button>
                      <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => setMixBakken(p, (mixQty[p.id] ?? 0) + 1)}>+</Button>
                      <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => toggleMix(p)}>×</Button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                <span>{mixSelected.length} product(en) · {mixTotaalBakken} bakken</span>
                <span>≈ €{mixWaarde.toFixed(2)} leeggoedwaarde</span>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{mixSelected.length} product(en) gekozen</p>
            <Button onClick={addMixed} disabled={mixSelected.length < 2 || mixTotaalBakken === 0 || working}>Toevoegen aan retour</Button>
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
                ? <>Gemixte pallet: <span className="font-medium text-foreground">{mixOmschrijving}</span> · {mixTotaalBakken} bakken</>
                : soort === "lege_pallet"
                  ? <>Lege pallets: <span className="font-medium text-foreground">kies type en aantal</span></>
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
              {(soort === "lege_pallet" ? [5, 10, 20, 40] : [1, 2, 5, 10]).filter((n) => n <= maxToevoegen).map((n) => (
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
          {soort === "lege_pallet" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Lege pallets worden gestapeld: max {LEGE_PER_PLAATS} per plaats op de vrachtwagen. Deze {aantal} pallets nemen{" "}
              {Math.max(0, Math.ceil((aantal - restInStapel) / LEGE_PER_PLAATS))} extra plaats(en) in — nog {resterend} van {MAX_PALLETS} plaatsen vrij.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nog {maxToevoegen} van {MAX_PALLETS} plaatsen beschikbaar</p>
          )}
          {soort === "vol" && palletType.standaard_bakken != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              ≈ {aantal * palletType.standaard_bakken} bakken ({palletType.standaard_bakken}/pallet × {aantal})
            </p>
          )}


          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => (soort === "lege_pallet" ? resetWizard() : setStep(1))}><ArrowLeft className="size-4" /> Terug</Button>
            <Button onClick={soort === "vol" ? addLine : soort === "mixed" ? addMixed : soort === "lege_pallet" ? addLegePallets : addLeeg} disabled={maxToevoegen === 0 || working}>
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
            <span className="text-muted-foreground"> / {MAX_PALLETS} plaatsen</span>
          </p>
        </div>

        {/* Voortgangsbalk */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(totaal / MAX_PALLETS) * 100}%` }} />
        </div>

        {/* Visueel rooster van 33 plaatsen op de vrachtwagen */}
        <div className="mt-4 grid grid-cols-11 gap-1.5">
          {Array.from({ length: MAX_PALLETS }).map((_, i) => {
            const slot = slots[i];
            return (
              <div
                key={i}
                title={slot ? `${i + 1}. ${slot.title}` : `Plek ${i + 1} vrij`}
                className={`flex aspect-square flex-col items-center justify-center rounded-md border text-[10px] font-semibold leading-tight ${
                  slot ? catSlot[slot.cat] ?? "bg-primary text-primary-foreground border-primary" : "border-dashed border-muted-foreground/30 text-muted-foreground/40"
                }`}
              >
                {i + 1}
                {slot?.badge && <span className="text-[9px] font-normal opacity-80">{slot.badge}</span>}
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
            </>
          )}
          <span className="flex items-center gap-1.5">
            <span className={`inline-block size-3 rounded ${catSlot.lege_pallet}`} /> Lege pallets
          </span>
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
