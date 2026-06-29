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
