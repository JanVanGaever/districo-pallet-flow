import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export type ParsedCustomer = {
  klantnummer: string;
  naam: string;
  plaats: string;
};

function getCol(row: Record<string, any>, ...needles: string[]): any {
  const keys = Object.keys(row);
  for (const needle of needles) {
    const hit = keys.find((k) => k.toLowerCase().trim().includes(needle));
    if (hit !== undefined) return row[hit];
  }
  return undefined;
}

export async function parseCustomerFile(file: File): Promise<ParsedCustomer[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: ParsedCustomer[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: "" });
    for (const row of rows) {
      const klantnummer = String(getCol(row, "lid", "klantnummer", "nummer", "nr") ?? "").trim();
      const naam = String(getCol(row, "naam", "klant") ?? "").trim();
      if (!klantnummer || !naam) continue;
      out.push({
        klantnummer,
        naam,
        plaats: String(getCol(row, "plaats", "gemeente", "stad") ?? "").trim(),
      });
    }
  }
  return out;
}

export type CustomerImportResult = { inserted: number; updated: number; total: number };

export async function importCustomers(list: ParsedCustomer[]): Promise<CustomerImportResult> {
  if (list.length === 0) return { inserted: 0, updated: 0, total: 0 };

  const byNummer = new Map<string, ParsedCustomer>();
  for (const c of list) byNummer.set(c.klantnummer, c);
  const items = [...byNummer.values()];

  const { data: existing, error: exErr } = await supabase
    .from("customers")
    .select("id, klantnummer")
    .in("klantnummer", items.map((c) => c.klantnummer));
  if (exErr) throw exErr;

  const idByNummer = new Map<string, string>();
  for (const r of existing ?? []) idByNummer.set((r as any).klantnummer, (r as any).id);

  const toInsert = items.filter((c) => !idByNummer.has(c.klantnummer));
  const toUpdate = items.filter((c) => idByNummer.has(c.klantnummer));

  if (toInsert.length) {
    const { error } = await supabase.from("customers").insert(toInsert as any);
    if (error) throw error;
  }
  for (const c of toUpdate) {
    const { error } = await supabase
      .from("customers")
      .update({ naam: c.naam, plaats: c.plaats } as any)
      .eq("id", idByNummer.get(c.klantnummer)!);
    if (error) throw error;
  }

  return { inserted: toInsert.length, updated: toUpdate.length, total: items.length };
}
