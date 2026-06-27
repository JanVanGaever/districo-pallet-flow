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
  leeggoedwaarde_per_bak: number;
};

export type PalletType = {
  id: string;
  naam: string;
};

export type PalletStatus = "aangemaakt" | "klaar_voor_retour" | "ontvangen";

export type Pallet = {
  id: string;
  palletnummer: string;
  retour_id: string;
  product_id: string | null;
  pallet_type_id: string | null;
  soort: "vol" | "mixed";
  status: PalletStatus;
  qr_payload: string | null;
  positie: number;
  totaal: number;
  ontvangen_at: string | null;
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
  return data as PalletType[];
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
