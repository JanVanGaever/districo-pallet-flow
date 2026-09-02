export type Customer = { id: string; naam: string; plaats: string };
export type Expected = { id: string; order: string; tijd: string };
export type Product = {
  id: string;
  naam: string;
  cat: string;
  verp: string;
  bak: number;
  perPallet: number;
};

export let CUSTOMERS: Customer[] = [
  { id: "K-1012", naam: "Drankencentrale Decuypere", plaats: "Harelbeke" },
  { id: "K-1027", naam: "Drankenhandel Lezy", plaats: "Sint-Eloois-Winkel" },
  { id: "K-1034", naam: "Magazijn Drinxit David", plaats: "Nieuwkerke" },
  { id: "K-1039", naam: "Geerkens Drankenhal", plaats: "" },
  { id: "K-1041", naam: "Drinkmarket Ghekiere", plaats: "" },
  { id: "K-1050", naam: "Dranken Goossens", plaats: "" },
  { id: "K-1058", naam: "Drankenhal Vertessen", plaats: "" },
  { id: "K-1063", naam: "Biercentrale Van Dijck", plaats: "" },
  { id: "K-1071", naam: "Dranken Verslegers", plaats: "" },
  { id: "K-1078", naam: "Drankenhandel Verreydt", plaats: "" },
  { id: "K-1085", naam: "Drankenhandel Daems", plaats: "" },
  { id: "K-1090", naam: "'t Swinneke", plaats: "" },
];

export let EXPECTED_TODAY: Expected[] = [
  { id: "K-1012", order: "O-24881", tijd: "08:30" },
  { id: "K-1027", order: "O-24890", tijd: "09:15" },
  { id: "K-1085", order: "O-24893", tijd: "10:00" },
  { id: "K-1050", order: "O-24902", tijd: "11:00" },
  { id: "K-1071", order: "O-24915", tijd: "13:30" },
  { id: "K-1034", order: "O-24920", tijd: "14:15" },
  { id: "K-1041", order: "O-24931", tijd: "15:45" },
];

export let PRODUCTS: Product[] = [
  { id: "p01", naam: "Jupiler", cat: "Pils", verp: "bak 24x25cl", bak: 3.72, perPallet: 40 },
  { id: "p02", naam: "Maes", cat: "Pils", verp: "bak 24x25cl", bak: 3.72, perPallet: 40 },
  { id: "p03", naam: "Stella Artois", cat: "Pils", verp: "bak 24x25cl", bak: 3.72, perPallet: 40 },
  { id: "p04", naam: "Carlsberg", cat: "Pils", verp: "bak 24x25cl", bak: 3.72, perPallet: 40 },
  { id: "p05", naam: "Coca-Cola", cat: "Frisdrank", verp: "bak 24x25cl glas", bak: 4.2, perPallet: 36 },
  { id: "p06", naam: "Coca-Cola Zero", cat: "Frisdrank", verp: "bak 24x25cl glas", bak: 4.2, perPallet: 36 },
  { id: "p07", naam: "Fanta Orange", cat: "Frisdrank", verp: "bak 24x25cl glas", bak: 4.2, perPallet: 36 },
  { id: "p08", naam: "Sprite", cat: "Frisdrank", verp: "bak 24x25cl glas", bak: 4.2, perPallet: 36 },
  { id: "p09", naam: "Spa Reine", cat: "Water", verp: "bak 24x25cl glas", bak: 4.8, perPallet: 36 },
  { id: "p10", naam: "Chaudfontaine", cat: "Water", verp: "bak 24x25cl glas", bak: 4.8, perPallet: 36 },
  { id: "p11", naam: "Duvel", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p12", naam: "Westmalle Tripel", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p13", naam: "Chimay Bleue", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p14", naam: "Tripel Karmeliet", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p15", naam: "La Chouffe", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p16", naam: "Omer", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p17", naam: "Kwaremont", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
  { id: "p18", naam: "Vedett Extra Blond", cat: "Speciaal", verp: "bak 24x33cl", bak: 4.56, perPallet: 32 },
];

export const palletValue = (p: Product) => p.bak * p.perPallet;

export const eur = (n: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);

export type PalletType = "vol" | "mixed" | "leeg";

export type PhotoSide = "zijde1" | "zijde2" | "zijde3" | "zijde4" | "boven";

export const PHOTO_SIDES: { id: PhotoSide; label: string }[] = [
  { id: "zijde1", label: "Zijde 1" },
  { id: "zijde2", label: "Zijde 2" },
  { id: "zijde3", label: "Zijde 3" },
  { id: "zijde4", label: "Zijde 4" },
  { id: "boven", label: "Boven" },
];

export type PalletStatus = "correct" | "fout";

export type Handling = "nu" | "later";

/** Eén aangemelde productlijn op een pallet. */
export type PalletLine = {
  productId: string;
  declaredAantal: number | null; // null = door magazijnier toegevoegd product
  aantal: number;
  changed: boolean; // bevestigd of gecorrigeerd door magazijnier
};

export type Pallet = {
  palletNumber: string;
  foto: boolean;
  photos: Partial<Record<PhotoSide, string>>;
  status: PalletStatus | null;
  type: PalletType | null;
  productId: string | null;
  aantal: number | null;
  handling: Handling | null;
  lines?: PalletLine[];
  declaredProductId?: string | null;
  declaredAantal?: number | null;
};

/** Wat de klant vooraf aangemeld heeft voor deze pallet (demo-data, deterministisch). */
export const declaredForPallet = (palletNumber: string): PalletLine[] => {
  let h = 0;
  for (let i = 0; i < palletNumber.length; i++) h = (h * 31 + palletNumber.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h / 4294967296;
  };
  const count = 4 + Math.floor(rand() * 3); // 4..6 producten
  const pool = [...PRODUCTS];
  const lines: PalletLine[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const [p] = pool.splice(Math.floor(rand() * pool.length), 1);
    const aantal = 4 + Math.floor(rand() * 30);
    lines.push({ productId: p.id, declaredAantal: aantal, aantal, changed: false });
  }
  return lines;
};

export const linesValue = (lines: PalletLine[]) =>
  lines.reduce((sum, l) => {
    const p = PRODUCTS.find((x) => x.id === l.productId);
    return sum + (p ? p.bak * l.aantal : 0);
  }, 0);


export type Retour = {
  retourNumber: string;
  customerId: string;
  order?: string;
  pallets: Pallet[];
};

let palletSeq = 1;
let retourSeq = 1;
const pad = (n: number) => String(n).padStart(5, "0");
export const nextPalletNumber = () => `PAL-2026-${pad(palletSeq++)}`;
export const nextRetourNumber = () => `RET-2026-${pad(retourSeq++)}`;

/* ---------- Live data uit de database ---------- */

export const customerById = (id: string): Customer | undefined =>
  CUSTOMERS.find((c) => c.id === id);

export const productCats = (): string[] => {
  const set = new Set<string>();
  for (const p of PRODUCTS) if (p.cat) set.add(p.cat);
  return ["Alle", ...[...set].sort()];
};

let loaded = false;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Andere");

/** Laadt klanten, producten en verwachte retours uit de database (eenmalig). */
export async function loadCatalog(): Promise<void> {
  if (loaded) return;
  const { supabase } = await import("@/integrations/supabase/client");

  const { data: custRows } = await supabase
    .from("customers")
    .select("id, naam, klantnummer, plaats")
    .order("naam");

  if (custRows?.length) {
    CUSTOMERS = custRows.map((c: any) => ({
      id: c.klantnummer || c.id,
      naam: c.naam,
      plaats: c.plaats ?? "",
    }));
  }

  const all: any[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, naam, categorie, verpakkingstype, inhoud, leeggoedwaarde_per_bak, bakken_per_europallet, favoriet",
      )
      .order("favoriet", { ascending: false })
      .order("naam")
      .range(from, from + PAGE - 1);
    if (error) break;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  if (all.length) {
    PRODUCTS = all.map((p) => ({
      id: p.id as string,
      naam: p.naam as string,
      cat: cap((p.categorie as string) || "andere"),
      verp: [p.verpakkingstype, p.inhoud].filter(Boolean).join(" ") || "—",
      bak: Number(p.leeggoedwaarde_per_bak ?? 0),
      perPallet: Number(p.bakken_per_europallet ?? 48),
    }));
  }

  const { data: retRows } = await supabase
    .from("retours")
    .select("retournummer, created_at, customers(klantnummer, naam)")
    .eq("status", "open")
    .eq("type", "klant")
    .order("created_at", { ascending: false })
    .limit(8);

  const expected = (retRows ?? [])
    .filter((r: any) => r.customers?.klantnummer)
    .map((r: any) => ({
      id: r.customers.klantnummer as string,
      order: r.retournummer as string,
      tijd: "",
    }));
  if (expected.length) EXPECTED_TODAY = expected;
  else if (CUSTOMERS.length)
    EXPECTED_TODAY = CUSTOMERS.slice(0, 6).map((c, i) => ({
      id: c.id,
      order: `O-${25000 + i}`,
      tijd: "",
    }));

  loaded = true;
}
