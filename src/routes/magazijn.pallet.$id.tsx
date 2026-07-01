import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, fetchPalletTypes, fetchProductConfigs, getSignedUrl, confirmPalletReceipt, CATEGORIES } from "@/lib/districo";
import { AppHeader } from "@/components/AppHeader";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Check, Camera, Pencil, PackageCheck, Scale, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/magazijn/pallet/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pallet — Districo Retour" }] }),
  component: PalletPage,
});

const catLabel: Record<string, string> = { bier: "Bier", water: "Water", frisdrank: "Frisdrank" };

async function fetchPallet(id: string) {
  const { data, error } = await supabase
    .from("pallets")
    .select("*, products(id,naam), pallet_types(id,naam), retours(retournummer, customers(naam, klantnummer))")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: photos } = await supabase.from("pallet_photos").select("*").eq("pallet_id", id).order("created_at");
  const signed = await Promise.all((photos ?? []).map((ph: any) => getSignedUrl(ph.storage_path)));
  return { pallet: data as any, photoUrls: signed.filter(Boolean) as string[], photoCount: (photos ?? []).length };
}

function PalletPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["pallet", id], queryFn: () => fetchPallet(id) });
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: palletTypes } = useQuery({ queryKey: ["palletTypes"], queryFn: fetchPalletTypes });
  const { data: productConfigs } = useQuery({ queryKey: ["productConfigs"], queryFn: fetchProductConfigs });

  const [editProduct, setEditProduct] = useState(false);
  const [editType, setEditType] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [geteld, setGeteld] = useState<string>("");
  const [gewogen, setGewogen] = useState<string>("");
  const [ontvangenDoor, setOntvangenDoor] = useState<string>("");
  const [handtekening, setHandtekening] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const p = data?.pallet;

  // Verwacht aantal bakken (opgegeven) afleiden uit palletconfiguratie
  const typeNaam: string = (p?.pallet_types?.naam ?? "").toLowerCase();
  const cfg = productConfigs?.find((c) => c.id === p?.product_id);
  const typeStd = palletTypes?.find((t) => t.id === p?.pallet_type_id)?.standaard_bakken ?? null;
  const opgegevenBakken =
    typeNaam.includes("chep")
      ? cfg?.bakken_per_cheppallet ?? typeStd
      : typeNaam.includes("euro")
        ? cfg?.bakken_per_europallet ?? typeStd
        : typeStd;

  useEffect(() => {
    if (opgegevenBakken != null && geteld === "") setGeteld(String(opgegevenBakken));
  }, [opgegevenBakken]);


  function refresh() {
    qc.invalidateQueries({ queryKey: ["pallet", id] });
  }

  async function audit(type: "aangemaakt" | "ontvangen" | "foto_toegevoegd" | "product_gewijzigd" | "pallettype_gewijzigd", detail?: string) {
    await supabase.from("audit_events").insert({ pallet_id: id, type, actor: "Magazijnier", detail });
  }

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Laden…</div>;
  if (error || !p) return <div className="p-10 text-center text-muted-foreground">Pallet niet gevonden.</div>;

  const klant = p.retours?.customers;

  async function changeProduct(productId: string, naam: string) {
    await supabase.from("pallets").update({ product_id: productId }).eq("id", id);
    await audit("product_gewijzigd", `Gewijzigd naar ${naam}`);
    setEditProduct(false);
    toast.success("Product gewijzigd");
    refresh();
  }

  async function changeType(typeId: string, naam: string) {
    await supabase.from("pallets").update({ pallet_type_id: typeId }).eq("id", id);
    await audit("pallettype_gewijzigd", `Gewijzigd naar ${naam}`);
    setEditType(false);
    toast.success("Pallettype gewijzigd");
    refresh();
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const path = `${id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("pallet-photos").upload(path, file);
        if (upErr) throw upErr;
        await supabase.from("pallet_photos").insert({ pallet_id: id, storage_path: path });
        await audit("foto_toegevoegd");
      }
      toast.success(`${files.length} foto('s) toegevoegd`);
      refresh();
    } catch (err: any) {
      toast.error("Upload mislukt: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmReceipt() {
    if (data!.photoCount < 2) {
      toast.error("Voeg minstens 2 foto's toe voor ontvangst.");
      return;
    }
    if (!handtekening) {
      toast.error("Laat de klant digitaal tekenen voor ontvangst.");
      return;
    }
    setConfirming(true);
    try {
      const geteldNum = geteld.trim() === "" ? null : Number(geteld);
      const gewogenNum = gewogen.trim() === "" ? null : Number(gewogen);
      await confirmPalletReceipt(id, {
        gecontroleerd_aantal: geteldNum,
        opgegeven_aantal: opgegevenBakken ?? null,
        gewogen_gewicht: gewogenNum,
        verwacht_gewicht: null,
        ontvangen_door: ontvangenDoor,
        klant_handtekening: handtekening,
      });
      const verschil =
        opgegevenBakken != null && geteldNum != null ? geteldNum - opgegevenBakken : null;
      await audit(
        "ontvangen",
        `${new Date().toLocaleString("nl-BE")}${ontvangenDoor ? ` · ${ontvangenDoor}` : ""}${
          verschil != null && verschil !== 0 ? ` · verschil ${verschil > 0 ? "+" : ""}${verschil} bak(ken)` : ""
        }`,
      );
      toast.success("Ontvangst bevestigd");
      navigate({ to: "/magazijn" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirming(false);

    }
  }

  if (p.status === "ontvangen") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Pallet" back="/magazijn" />
        <main className="mx-auto max-w-md px-5 py-16 text-center">
          <div className="mx-auto size-20 rounded-full bg-success/15 text-success grid place-items-center">
            <PackageCheck className="size-10" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Reeds ontvangen</h1>
          <p className="mt-1 text-muted-foreground">{p.palletnummer}</p>
          <Button className="mt-8 w-full h-12" onClick={() => navigate({ to: "/magazijn" })}>Terug naar scannen</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <AppHeader title="Pallet" back="/magazijn" />
      <main className="mx-auto max-w-md px-5 py-5 space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="font-semibold">{klant?.naam}</p>
          <p className="text-sm text-muted-foreground">Klantnr {klant?.klantnummer} · {p.retours?.retournummer}</p>
          <p className="mt-2 text-sm font-medium">Pallet {p.positie} van {p.totaal}</p>
        </div>

        {/* Product check */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Aangegeven product</p>
          <p className="text-lg font-semibold">{p.products?.naam ?? p.inhoud ?? "—"}</p>
          {!editProduct ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="success" onClick={() => toast.success("Product bevestigd")}><Check className="size-5" /> Ja</Button>
              <Button variant="outline" onClick={() => setEditProduct(true)}><Pencil className="size-4" /> Wijzigen</Button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{catLabel[cat]}</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {products?.filter((x) => x.categorie === cat).map((x) => (
                      <button key={x.id} onClick={() => changeProduct(x.id, x.naam)} className="rounded-lg border p-2 text-sm hover:border-primary">
                        {x.naam}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full" onClick={() => setEditProduct(false)}>Annuleren</Button>
            </div>
          )}
        </div>

        {/* Pallet type check */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Aangegeven pallettype</p>
          <p className="text-lg font-semibold">{p.pallet_types?.naam ?? "—"}</p>
          {!editType ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="success" onClick={() => toast.success("Pallettype bevestigd")}><Check className="size-5" /> Ja</Button>
              <Button variant="outline" onClick={() => setEditType(true)}><Pencil className="size-4" /> Wijzigen</Button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {palletTypes?.map((t) => (
                <button key={t.id} onClick={() => changeType(t.id, t.naam)} className="rounded-lg border p-2 text-sm hover:border-primary">
                  {t.naam}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">Foto's <span className="text-muted-foreground">({data.photoCount} toegevoegd, min. 2)</span></p>
          {data.photoUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {data.photoUrls.map((u, i) => (
                <img key={i} src={u} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFiles} />
          <Button variant="outline" className="mt-3 w-full h-12" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera className="size-5" /> {uploading ? "Uploaden…" : "Foto's toevoegen"}
          </Button>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur p-4">
        <div className="mx-auto max-w-md">
          <Button className="w-full h-14 text-lg" variant="success" onClick={confirmReceipt} disabled={confirming}>
            <PackageCheck className="size-6" /> Ontvangst bevestigen
          </Button>
        </div>
      </div>
    </div>
  );
}
