import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type ParsedProduct = {
  code: string;
  naam: string;
  categorie: string;
  subgroep: string | null;
  merk: string | null;
  verpakkingstype: string | null;
  inhoud: string | null;
  verkoopvorm: string | null;
  aantal_per_bak: number | null;
  leeggoed_per_stuk: number;
  leeggoedwaarde_per_bak: number;
  herbruikbaar: boolean;
};

// Map a sheet name to one of the app categories
function sheetToCategory(sheet: string): string {
  const s = sheet.toLowerCase();
  if (s.includes("bier")) return "bier";
  if (s.includes("water")) return "water";
  if (s.includes("limonade") || s.includes("frisdrank")) return "frisdrank";
  return "andere";
}

function getCol(row: Record<string, any>, ...needles: string[]): any {
  const keys = Object.keys(row);
  for (const needle of needles) {
    const hit = keys.find((k) => k.toLowerCase().trim().includes(needle));
    if (hit !== undefined) return row[hit];
  }
  return undefined;
}

function num(v: any): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// ---- Formaat 2: "Afdruk artikels" (Artikel | Benaming | Lg | Barcode stuk) ----

function guessCategorie(naam: string): string {
  const s = naam.toLowerCase();
  if (/(water|spa|evian|badoit|chaudfontaine|bru|perrier|vittel)/.test(s)) return "water";
  if (/(cola|fanta|sprite|limonade|ice tea|icetea|tonic|schweppes|looza|fruitsap|orangina|red bull|energy)/.test(s))
    return "frisdrank";
  if (/(melk|wijn|water)/.test(s)) return "andere";
  if (/(bier|pils|tripel|blond|dubbel|ipa|stout|vat |bak|33cl|25cl|kriek|wit)/.test(s)) return "bier";
  return "andere";
}

// "24X33CL", "6X4X33CL", "6X(4X33CL)", "VAT 20L", "12X1L"
function parseVerpakking(naam: string): { aantal: number | null; inhoud: string | null } {
  const s = naam.toUpperCase().replace(/[()]/g, "");
  const m = s.match(/(\d+)\s*X\s*(\d+)\s*X\s*(\d+(?:[.,]\d+)?)\s*(CL|L|ML)/);
  if (m) return { aantal: Number(m[1]) * Number(m[2]), inhoud: `${m[3].replace(",", ".")}${m[4].toLowerCase()}` };
  const m2 = s.match(/(\d+)\s*X\s*(\d+(?:[.,]\d+)?)\s*(CL|L|ML)/);
  if (m2) return { aantal: Number(m2[1]), inhoud: `${m2[2].replace(",", ".")}${m2[3].toLowerCase()}` };
  const m3 = s.match(/VAT\s*(\d+(?:[.,]\d+)?)\s*L|(\d+(?:[.,]\d+)?)\s*L\s*VAT/);
  if (m3) return { aantal: 1, inhoud: `vat ${(m3[1] ?? m3[2]).replace(",", ".")}l` };
  return { aantal: null, inhoud: null };
}

function parseAfdrukArtikels(wb: XLSX.WorkBook): ParsedProduct[] {
  const out: ParsedProduct[] = [];
  const seen = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetName], { header: 1, defval: "" });
    for (const row of rows) {
      const code = String(row?.[0] ?? "").trim();
      const naam = String(row?.[1] ?? "").trim();
      const lgRaw = String(row?.[2] ?? "").trim();
      if (!code || !naam) continue;
      if (/^artikel$/i.test(code)) continue;
      // Codes zoals 010.020, 107010, 070.990 S
      if (!/^\d[\d.]*\s*[A-Z]?$/i.test(code)) continue;
      if (lgRaw === "" || !Number.isFinite(Number(lgRaw.replace(",", ".")))) continue;
      if (seen.has(code)) continue;
      seen.add(code);

      const { aantal, inhoud } = parseVerpakking(naam);
      const waarde = num(lgRaw);
      out.push({
        code,
        naam,
        categorie: guessCategorie(naam),
        subgroep: null,
        merk: null,
        verpakkingstype: null,
        inhoud,
        verkoopvorm: null,
        aantal_per_bak: aantal,
        leeggoed_per_stuk: aantal && aantal > 0 ? Math.round((waarde / aantal) * 1000) / 1000 : 0,
        leeggoedwaarde_per_bak: waarde,
        herbruikbaar: true,
      });
    }
  }
  return out;
}

export async function parseProductFile(file: File): Promise<ParsedProduct[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: ParsedProduct[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    if (rows.length === 0) continue;

    // Skip sheets that don't have a product id / productnaam column
    const first = rows[0];
    const hasNaam = Object.keys(first).some((k) => k.toLowerCase().includes("productnaam"));
    if (!hasNaam) continue;

    const categorie = sheetToCategory(sheetName);

    for (const row of rows) {
      const code = String(getCol(row, "product id", "product-id", "id") ?? "").trim();
      const naam = String(getCol(row, "productnaam") ?? "").trim();
      if (!code || !naam) continue;

      const aantalRaw = getCol(row, "aantal per bak");
      const herbruik = String(getCol(row, "herbruikbaar") ?? "").trim().toLowerCase();

      out.push({
        code,
        naam,
        categorie,
        subgroep: String(getCol(row, "subgroep") ?? "").trim() || null,
        merk: String(getCol(row, "merk") ?? "").trim() || null,
        verpakkingstype: String(getCol(row, "verpakkingstype") ?? "").trim() || null,
        inhoud: String(getCol(row, "inhoud") ?? "").trim() || null,
        verkoopvorm: String(getCol(row, "verkoopvorm") ?? "").trim() || null,
        aantal_per_bak: aantalRaw === "" || aantalRaw === undefined ? null : Math.round(num(aantalRaw)),
        leeggoed_per_stuk: num(getCol(row, "leeggoed per stuk")),
        leeggoedwaarde_per_bak: num(getCol(row, "leeggoed per bak")),
        herbruikbaar: herbruik === "ja" || herbruik === "true" || herbruik === "1",
      });
    }
  }

  if (out.length === 0) return parseAfdrukArtikels(wb);
  return out;
}


export type ImportResult = { inserted: number; updated: number; total: number };

export async function importProducts(products: ParsedProduct[]): Promise<ImportResult> {
  if (products.length === 0) return { inserted: 0, updated: 0, total: 0 };

  // Deduplicate by code (last one wins)
  const byCode = new Map<string, ParsedProduct>();
  for (const p of products) byCode.set(p.code, p);
  const list = [...byCode.values()];
  const codes = list.map((p) => p.code);

  const { data: existing, error: exErr } = await supabase
    .from("products")
    .select("id, code")
    .in("code", codes);
  if (exErr) throw exErr;

  const idByCode = new Map<string, string>();
  for (const r of existing ?? []) {
    if ((r as any).code) idByCode.set((r as any).code, (r as any).id);
  }

  const toInsert = list.filter((p) => !idByCode.has(p.code));
  const toUpdate = list.filter((p) => idByCode.has(p.code));

  if (toInsert.length) {
    const { error } = await supabase.from("products").insert(toInsert as any);
    if (error) throw error;
  }

  for (const p of toUpdate) {
    const id = idByCode.get(p.code)!;
    const { error } = await supabase.from("products").update(p as any).eq("id", id);
    if (error) throw error;
  }

  return { inserted: toInsert.length, updated: toUpdate.length, total: list.length };
}
