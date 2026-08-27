import { supabase } from "@/integrations/supabase/client";

export type Customer = {
  id: string;
  naam: string;
  klantnummer: string;
  plaats: string;
};

export type Product = {
  id: string;
  naam: string;
  categorie: string;
  inhoud: string | null;
  verpakkingstype: string | null;
  leeggoedwaarde_per_bak: number;
  favoriet?: boolean | null;
};

export async function setProductFavoriet(id: string, favoriet: boolean) {
  const { error } = await supabase.from("products").update({ favoriet } as any).eq("id", id);
  if (error) throw error;
}

export type PalletType = {
  id: string;
  naam: string;
  standaard_bakken: number | null;
};

export type PalletStatus = "aangemaakt" | "klaar_voor_retour" | "ontvangen";

export type Pallet = {
  id: string;
  palletnummer: string;
  retour_id: string;
  product_id: string | null;
  pallet_type_id: string | null;
  soort: "vol" | "mixed" | "lege_bakken" | "lege_flesjes";
  status: PalletStatus;
  qr_payload: string | null;
  positie: number;
  totaal: number;
  inhoud: string | null;
  ontvangen_at: string | null;
  opgegeven_aantal: number | null;
  gecontroleerd_aantal: number | null;
  gewogen_gewicht: number | null;
  verwacht_gewicht: number | null;
  ontvangen_door: string | null;
  klant_handtekening: string | null;
  created_at: string;
};

export type AuditEvent = {
  id: string;
  pallet_id: string;
  type: "aangemaakt" | "ontvangen" | "foto_toegevoegd" | "product_gewijzigd" | "pallettype_gewijzigd";
  actor: string | null;
  detail: string | null;
  created_at: string;
};

export const CATEGORIES = ["bier", "water", "frisdrank"] as const;

export const STATUS_LABEL: Record<PalletStatus, string> = {
  aangemaakt: "Aangemaakt",
  klaar_voor_retour: "Klaar voor retour",
  ontvangen: "Ontvangen",
};

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("naam");
  if (error) throw error;
  return data as Customer[];
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("naam");
  if (error) throw error;
  return (data as Product[]).map((p) => ({ ...p, leeggoedwaarde_per_bak: Number(p.leeggoedwaarde_per_bak) }));
}

export async function fetchPalletTypes(): Promise<PalletType[]> {
  const { data, error } = await supabase.from("pallet_types").select("*").order("naam");
  if (error) throw error;
  const list = data as PalletType[];
  // Vaste volgorde: Europallet eerst, dan CHEP, dan de rest
  const ORDER = ["Europallet", "CHEP"];
  return [...list].sort((a, b) => {
    const ia = ORDER.indexOf(a.naam);
    const ib = ORDER.indexOf(b.naam);
    return (ia === -1 ? ORDER.length : ia) - (ib === -1 ? ORDER.length : ib);
  });
}

// Pallettypes waarvoor een standaard aantal bakken per volle pallet zinvol is
export const WEGWERP_NAAM = "Wegwerppallet";

export async function updatePalletTypeBakken(id: string, standaard_bakken: number | null) {
  const { error } = await supabase
    .from("pallet_types")
    .update({ standaard_bakken })
    .eq("id", id);
  if (error) throw error;
}

export type Voertuig = {
  id: string;
  merk: string;
  nummerplaat: string;
  aantal_palletplaatsen: number;
  created_at: string;
};

export async function fetchVoertuigen(): Promise<Voertuig[]> {
  const { data, error } = await supabase.from("voertuigen").select("*").order("created_at");
  if (error) throw error;
  return data as Voertuig[];
}

export async function addVoertuig(v: { merk: string; nummerplaat: string; aantal_palletplaatsen: number }) {
  const { error } = await supabase.from("voertuigen").insert(v);
  if (error) throw error;
}

export async function updateVoertuig(id: string, v: { merk: string; nummerplaat: string; aantal_palletplaatsen: number }) {
  const { error } = await supabase.from("voertuigen").update(v).eq("id", id);
  if (error) throw error;
}

export async function deleteVoertuig(id: string) {
  const { error } = await supabase.from("voertuigen").delete().eq("id", id);
  if (error) throw error;
}

// ---- Productconfigurator (flesjes per bak, bakken per europallet/cheppallet) ----
export type ProductConfig = {
  id: string;
  code: string | null;
  naam: string;
  categorie: string;
  verpakkingstype: string | null;
  inhoud: string | null;
  aantal_per_bak: number | null;
  bakken_per_europallet: number | null;
  bakken_per_cheppallet: number | null;
};

export async function fetchProductConfigs(): Promise<ProductConfig[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, code, naam, categorie, verpakkingstype, inhoud, aantal_per_bak, bakken_per_europallet, bakken_per_cheppallet")
    .order("naam");
  if (error) throw error;
  return data as ProductConfig[];
}

export async function updateProductConfig(
  id: string,
  values: {
    aantal_per_bak: number | null;
    bakken_per_europallet: number | null;
    bakken_per_cheppallet: number | null;
  },
) {
  const { error } = await supabase.from("products").update(values).eq("id", id);
  if (error) throw error;
}

// Trek het aantal bakken per pallet door naar alle producten van dezelfde
// soort (zelfde verpakkingstype). Retourneert het aantal bijgewerkte producten.
export async function applyBakkenToVerpakkingstype(
  verpakkingstype: string,
  values: {
    bakken_per_europallet?: number | null;
    bakken_per_cheppallet?: number | null;
  },
): Promise<number> {
  const patch: { bakken_per_europallet?: number | null; bakken_per_cheppallet?: number | null } = {};
  if ("bakken_per_europallet" in values) patch.bakken_per_europallet = values.bakken_per_europallet ?? null;
  if ("bakken_per_cheppallet" in values) patch.bakken_per_cheppallet = values.bakken_per_cheppallet ?? null;
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("verpakkingstype", verpakkingstype)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

export type CartLine = { product: Product; palletType: PalletType; aantal: number };

export async function bevestigRetour(customer: Customer, lines: CartLine[]) {
  // generate retournummer
  const jaar = new Date().getFullYear();
  const retNum = Math.floor(Math.random() * 90000) + 10000;
  const retournummer = `RET-${jaar}-${pad(retNum, 5)}`;

  const { data: retour, error: rErr } = await supabase
    .from("retours")
    .insert({ retournummer, customer_id: customer.id, status: "open" })
    .select()
    .single();
  if (rErr) throw rErr;

  const totaal = lines.reduce((s, l) => s + l.aantal, 0);
  const palletRows: any[] = [];
  let pos = 0;
  for (const line of lines) {
    for (let i = 0; i < line.aantal; i++) {
      pos++;
      palletRows.push({
        palletnummer: `PAL-${jaar}-${customer.klantnummer}-${pad(Math.floor(Math.random() * 90000) + 10000, 5)}`,
        retour_id: retour.id,
        product_id: line.product.id,
        pallet_type_id: line.palletType.id,
        soort: "vol",
        status: "klaar_voor_retour",
        positie: pos,
        totaal,
      });
    }
  }

  const { data: inserted, error: pErr } = await supabase.from("pallets").insert(palletRows).select();
  if (pErr) throw pErr;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const updates = (inserted as Pallet[]).map((p) =>
    supabase.from("pallets").update({ qr_payload: `${origin}/magazijn/pallet/${p.id}` }).eq("id", p.id),
  );
  await Promise.all(updates);

  const audits = (inserted as Pallet[]).map((p) => ({
    pallet_id: p.id,
    type: "aangemaakt" as const,
    actor: customer.naam,
  }));
  await supabase.from("audit_events").insert(audits);

  return { retour, pallets: inserted as Pallet[] };
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("pallet-photos").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ---- Dashboard / draft (concept) retour helpers ----

export const DEFAULT_CUSTOMER_NAME = "Swinnen";

export type RetourWithPallets = {
  id: string;
  retournummer: string;
  status: string;
  created_at: string;
  pallets: any[];
};

export async function fetchDefaultCustomer(): Promise<Customer> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .ilike("naam", `%${DEFAULT_CUSTOMER_NAME}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Klant ${DEFAULT_CUSTOMER_NAME} niet gevonden`);
  return data as Customer;
}

export async function fetchRetoursForCustomer(customerId: string): Promise<RetourWithPallets[]> {
  const { data, error } = await supabase
    .from("retours")
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[] as RetourWithPallets[];
}

export async function getOrCreateConceptRetour(customer: Customer): Promise<RetourWithPallets> {
  const { data: existing } = await supabase
    .from("retours")
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .eq("customer_id", customer.id)
    .eq("status", "concept")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as any as RetourWithPallets;

  const jaar = new Date().getFullYear();
  const retNum = Math.floor(Math.random() * 90000) + 10000;
  const retournummer = `RET-${jaar}-${pad(retNum, 5)}`;
  const { data: retour, error } = await supabase
    .from("retours")
    .insert({ retournummer, customer_id: customer.id, status: "concept" })
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .single();
  if (error) throw error;
  return retour as any as RetourWithPallets;
}

async function recomputePositions(retourId: string) {
  const { data: pallets } = await supabase
    .from("pallets")
    .select("id")
    .eq("retour_id", retourId)
    .order("created_at", { ascending: true });
  const list = pallets ?? [];
  const totaal = list.length;
  await Promise.all(
    list.map((p: any, i: number) =>
      supabase.from("pallets").update({ positie: i + 1, totaal }).eq("id", p.id),
    ),
  );
}

export async function addLineToRetour(retourId: string, code: string, line: CartLine) {
  const jaar = new Date().getFullYear();
  const rows = Array.from({ length: line.aantal }, () => ({
    palletnummer: `PAL-${jaar}-${code}-${pad(Math.floor(Math.random() * 90000) + 10000, 5)}`,
    retour_id: retourId,
    product_id: line.product.id,
    pallet_type_id: line.palletType.id,
    soort: "vol" as const,
    status: "aangemaakt" as const,
    positie: 1,
    totaal: 1,
  }));
  const { error } = await supabase.from("pallets").insert(rows);
  if (error) throw error;
  await recomputePositions(retourId);
}

export async function addMixedPalletToRetour(
  retourId: string,
  code: string,
  opts: { palletType: PalletType; aantal: number; inhoud: string },
) {
  const jaar = new Date().getFullYear();
  const rows = Array.from({ length: opts.aantal }, () => ({
    palletnummer: `PAL-${jaar}-${code}-${pad(Math.floor(Math.random() * 90000) + 10000, 5)}`,
    retour_id: retourId,
    product_id: null,
    pallet_type_id: opts.palletType.id,
    soort: "mixed" as const,
    status: "aangemaakt" as const,
    positie: 1,
    totaal: 1,
    inhoud: opts.inhoud,
  }));
  const { error } = await supabase.from("pallets").insert(rows);
  if (error) throw error;
  await recomputePositions(retourId);
}

export async function addLeeggoedPalletToRetour(
  retourId: string,
  code: string,
  opts: { soort: "lege_bakken" | "lege_flesjes"; product: Product | null; palletType: PalletType; aantal: number },
) {
  const jaar = new Date().getFullYear();
  const label = opts.soort === "lege_bakken" ? "Lege bakken" : "Lege flesjes";
  const inhoud = opts.product ? `${label} — ${opts.product.naam}` : label;
  const rows = Array.from({ length: opts.aantal }, () => ({
    palletnummer: `PAL-${jaar}-${code}-${pad(Math.floor(Math.random() * 90000) + 10000, 5)}`,
    retour_id: retourId,
    product_id: opts.product?.id ?? null,
    pallet_type_id: opts.palletType.id,
    soort: opts.soort,
    status: "aangemaakt" as const,
    positie: 1,
    totaal: 1,
    inhoud,
  }));
  const { error } = await supabase.from("pallets").insert(rows);
  if (error) throw error;
  await recomputePositions(retourId);
}

export async function addLegePalletsToRetour(
  retourId: string,
  code: string,
  items: { palletType: PalletType; aantal: number }[],
) {
  const jaar = new Date().getFullYear();
  const rows = items
    .filter((it) => it.aantal > 0)
    .flatMap((it) =>
      Array.from({ length: it.aantal }, () => ({
        palletnummer: `PAL-${jaar}-${code}-${pad(Math.floor(Math.random() * 90000) + 10000, 5)}`,
        retour_id: retourId,
        product_id: null,
        pallet_type_id: it.palletType.id,
        soort: "lege_pallet" as const,
        status: "aangemaakt" as const,
        positie: 1,
        totaal: 1,
        inhoud: `Lege ${it.palletType.naam}`,
      })),
    );
  if (rows.length === 0) return;
  const { error } = await supabase.from("pallets").insert(rows);
  if (error) throw error;
  await recomputePositions(retourId);
}

export async function removePalletFromRetour(palletId: string, retourId: string) {
  await supabase.from("audit_events").delete().eq("pallet_id", palletId);
  await supabase.from("pallet_photos").delete().eq("pallet_id", palletId);
  const { error } = await supabase.from("pallets").delete().eq("id", palletId);
  if (error) throw error;
  await recomputePositions(retourId);
}

export async function deleteConceptRetour(retourId: string) {
  const { data: pallets } = await supabase.from("pallets").select("id").eq("retour_id", retourId);
  const ids = (pallets ?? []).map((p: any) => p.id);
  if (ids.length) {
    await supabase.from("audit_events").delete().in("pallet_id", ids);
    await supabase.from("pallet_photos").delete().in("pallet_id", ids);
    await supabase.from("pallets").delete().in("id", ids);
  }
  await supabase.from("retours").delete().eq("id", retourId);
}

export async function submitRetour(retour: RetourWithPallets, actorNaam: string) {
  const { data: pallets, error } = await supabase
    .from("pallets")
    .select("*")
    .eq("retour_id", retour.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const list = (pallets ?? []) as Pallet[];
  if (list.length === 0) throw new Error("Geen pallets in deze retour");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  await Promise.all(
    list.map((p) =>
      supabase
        .from("pallets")
        .update({ status: "klaar_voor_retour", qr_payload: `${origin}/magazijn/pallet/${p.id}` })
        .eq("id", p.id),
    ),
  );

  await supabase.from("audit_events").insert(
    list.map((p) => ({ pallet_id: p.id, type: "aangemaakt" as const, actor: actorNaam })),
  );

  await supabase.from("retours").update({ status: "ingediend" }).eq("id", retour.id);
}


// ---- Bewijs op innamemoment: ontvangst bevestigen met verificatiedata ----
export type OntvangstData = {
  gecontroleerd_aantal: number | null;
  opgegeven_aantal: number | null;
  gewogen_gewicht: number | null;
  verwacht_gewicht: number | null;
  ontvangen_door: string;
  klant_handtekening: string | null;
};

export async function confirmPalletReceipt(id: string, d: OntvangstData) {
  const { error } = await supabase
    .from("pallets")
    .update({
      status: "ontvangen",
      ontvangen_at: new Date().toISOString(),
      gecontroleerd_aantal: d.gecontroleerd_aantal,
      opgegeven_aantal: d.opgegeven_aantal,
      gewogen_gewicht: d.gewogen_gewicht,
      verwacht_gewicht: d.verwacht_gewicht,
      ontvangen_door: d.ontvangen_door || null,
      klant_handtekening: d.klant_handtekening,
    })
    .eq("id", id);
  if (error) throw error;
}

// ---- Waardecatalogus voor de magazijnier ----
export type CatalogusItem = {
  id: string;
  naam: string;
  categorie: string;
  merk: string | null;
  verpakkingstype: string | null;
  aantal_per_bak: number | null;
  leeggoedwaarde_per_bak: number;
  leeggoed_per_stuk: number;
};

export async function fetchCatalogus(): Promise<CatalogusItem[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, naam, categorie, merk, verpakkingstype, aantal_per_bak, leeggoedwaarde_per_bak, leeggoed_per_stuk")
    .order("categorie")
    .order("naam");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    ...p,
    leeggoedwaarde_per_bak: Number(p.leeggoedwaarde_per_bak ?? 0),
    leeggoed_per_stuk: Number(p.leeggoed_per_stuk ?? 0),
  })) as CatalogusItem[];
}

// ---- Leveranciers (leeggoed-afhaling richting producent) ----

export type Leverancier = {
  id: string;
  naam: string;
  plaats: string | null;
};

// Kort palletnummer-prefix afgeleid van de leveranciernaam (bv. "AB InBev" -> "ABI")
export function leverancierCode(naam: string): string {
  const clean = naam.replace(/[^A-Za-z0-9 ]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const code = parts.length >= 2 ? parts.map((p) => p[0]).join("") : clean.slice(0, 3);
  return (code || "LEV").toUpperCase();
}

export async function fetchLeveranciers(): Promise<Leverancier[]> {
  const { data, error } = await supabase.from("leveranciers").select("*").order("naam");
  if (error) throw error;
  return (data ?? []) as Leverancier[];
}

export async function fetchProductsForLeverancier(leverancier: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("leverancier", leverancier)
    .order("naam");
  if (error) throw error;
  return (data as Product[]).map((p) => ({ ...p, leeggoedwaarde_per_bak: Number(p.leeggoedwaarde_per_bak) }));
}

export async function fetchRetoursForLeverancier(leverancierId: string): Promise<RetourWithPallets[]> {
  const { data, error } = await supabase
    .from("retours")
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .eq("leverancier_id", leverancierId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[] as RetourWithPallets[];
}

export async function getOrCreateConceptRetourLeverancier(
  leverancier: Leverancier,
): Promise<RetourWithPallets> {
  const { data: existing } = await supabase
    .from("retours")
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .eq("leverancier_id", leverancier.id)
    .eq("status", "concept")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing as any as RetourWithPallets;

  const jaar = new Date().getFullYear();
  const retNum = Math.floor(Math.random() * 90000) + 10000;
  const retournummer = `LEV-${jaar}-${pad(retNum, 5)}`;
  const { data: retour, error } = await supabase
    .from("retours")
    .insert({ retournummer, leverancier_id: leverancier.id, type: "leverancier", status: "concept" })
    .select("*, pallets(*, products(naam, categorie), pallet_types(naam), pallet_photos(id))")
    .single();
  if (error) throw error;
  return retour as any as RetourWithPallets;
}
