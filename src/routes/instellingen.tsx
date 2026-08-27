import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Warehouse,
  LayoutDashboard,
  FileSpreadsheet,
  QrCode,
  Camera,
  FileText,
  Settings2,
  BookOpen,
  Truck,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  fetchVoertuigen,
  addVoertuig,
  updateVoertuig,
  deleteVoertuig,
  type Voertuig,
} from "@/lib/districo";

export const Route = createFileRoute("/instellingen")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Instellingen & Handleiding — Districo Retour" },
      {
        name: "description",
        content:
          "Handleiding voor Districo Retour: hoe het klantenportaal, de magazijnier-app, het kantoor-dashboard en de productenconfigurator werken.",
      },
    ],
  }),
  component: Instellingen,
});

type Section = {
  icon: typeof Package;
  title: string;
  intro: string;
  steps: string[];
};

const sections: Section[] = [
  {
    icon: Package,
    title: "Klantenportaal",
    intro:
      "De klant (standaard: Swinnen) maakt hier een nieuwe retour aan en volgt de status van vorige retours.",
    steps: [
      "Bekijk het dashboard met een overzicht van ingediende, klaargezette en ontvangen retours.",
      "Onder \"Lopende retour\" ga je verder met een concept, of dien je die in. Een concept kan altijd aangepast of verwijderd worden.",
      "Voeg pallets toe: kies eerst het type — volle pallet (snelste), gemixte pallet, lege bakken of lege flesjes.",
      "Zoek een product en filter eventueel op categorie (Bier, Water, Limonade).",
      "Volg het overzicht van 33 slots: elk slot krijgt een kleur per categorie, met tooltip per pallet.",
      "Dien de retour in wanneer alle pallets ingegeven zijn (max. 33).",
    ],
  },
  {
    icon: QrCode,
    title: "QR-codes & documenten",
    intro: "Bij elke ingediende retour horen afdrukbare hulpmiddelen.",
    steps: [
      "\"QR-codes\" opent een afdrukbare pagina met een QR per pallet — die plakt de klant op de pallet.",
      "\"Document\" opent een afdrukbaar A4-retourdocument met klantgegevens, pallettabel (bakken × flesjes, waarde) en handtekeningvelden.",
      "Gebruik de knop \"Afdrukken\" om het afdrukvenster van de browser te openen.",
    ],
  },
  {
    icon: Warehouse,
    title: "Magazijnier-app",
    intro: "In het magazijn worden de pallets gescand, gecontroleerd en gefotografeerd.",
    steps: [
      "Scan de QR-code van een pallet met de ingebouwde scanner.",
      "Controleer de inhoud van de pallet ten opzichte van wat de klant ingaf.",
      "Voeg minstens 2 foto's toe als bewijs van de ontvangen pallet.",
      "Bevestig de pallet — de status verschijnt direct op het kantoor-dashboard.",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Kantoor-dashboard",
    intro: "Het kantoor volgt alle retours realtime op.",
    steps: [
      "Bekijk de kerncijfers en de tabel met één regel per retour, per klant.",
      "Klik op een retour om de details te openen: klantinfo, status, fotogalerij en volledige audit-trail.",
      "Concept-retours zijn verborgen; enkel ingediende retours verschijnen.",
    ],
  },
  {
    icon: FileSpreadsheet,
    title: "Producten importeren",
    intro: "De productenlijst wordt centraal in de database bewaard en gedeeld door alle apps.",
    steps: [
      "Upload een XLSX- of ODS-bestand met producten.",
      "Bekijk de preview, gegroepeerd per categorie, voordat je importeert.",
      "Her-importeren werkt bij op productcode in plaats van dubbels aan te maken.",
    ],
  },
  {
    icon: Settings2,
    title: "Configurator",
    intro:
      "Stel per product en pallettype in hoeveel bakken en flesjes op een pallet gaan.",
    steps: [
      "Stel flesjes per bak, bakken per europallet en bakken per cheppallet in per product.",
      "Gebruik \"Doortrekken\" om dezelfde palletinstellingen toe te passen op alle producten met hetzelfde verpakkingstype.",
      "Stel per pallettype (europallet, CHEP) het standaard aantal bakken per volle pallet in — voor wegwerppallet niet van toepassing.",
    ],
  },
];

function Instellingen() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Instellingen & Handleiding" />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Handleiding</h1>
            <p className="mt-1 text-muted-foreground">
              Een overzicht van hoe Districo Retour werkt, per rol en functie. Drie rollen delen
              één database: wat het magazijn opslaat verschijnt direct op kantoor.
            </p>
          </div>
        </div>

        <LedenlijstImport />

        <VoertuigenConfig />



        <div className="mt-8 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <s.icon className="size-5" />
                </div>
                <h2 className="font-semibold">{s.title}</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{s.intro}</p>
              <ol className="mt-3 space-y-2">
                {s.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="size-5 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Camera className="size-5" />
            </div>
            <h2 className="font-semibold">Tips</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Een retour bevat maximaal 33 pallets.</li>
            <li>Kleuren in het slot-rooster: geel = Bier, blauw = Water, groen = Frisdrank/Limonade, grijs = gemixt.</li>
            <li>Foto's in het magazijn zijn verplicht (minstens 2) voor bevestiging.</li>
            <li>Producten zonder leeggoedwaarde of zonder flesjes per bak horen niet in de lijst thuis.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

function VoertuigenConfig() {
  const qc = useQueryClient();
  const { data: voertuigen } = useQuery({ queryKey: ["voertuigen"], queryFn: fetchVoertuigen });

  const [merk, setMerk] = useState("");
  const [nummerplaat, setNummerplaat] = useState("");
  const [plaatsen, setPlaatsen] = useState("33");
  const [editId, setEditId] = useState<string | null>(null);
  const [editMerk, setEditMerk] = useState("");
  const [editPlaat, setEditPlaat] = useState("");
  const [editPlaatsen, setEditPlaatsen] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["voertuigen"] });
  }

  async function add() {
    if (!merk.trim() || !nummerplaat.trim()) {
      toast.error("Vul merk en nummerplaat in");
      return;
    }
    setBusy(true);
    try {
      await addVoertuig({
        merk: merk.trim(),
        nummerplaat: nummerplaat.trim(),
        aantal_palletplaatsen: Math.max(1, parseInt(plaatsen) || 0),
      });
      setMerk("");
      setNummerplaat("");
      setPlaatsen("33");
      invalidate();
      toast.success("Voertuig toegevoegd");
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(v: Voertuig) {
    setEditId(v.id);
    setEditMerk(v.merk);
    setEditPlaat(v.nummerplaat);
    setEditPlaatsen(String(v.aantal_palletplaatsen));
  }

  async function saveEdit(id: string) {
    if (!editMerk.trim() || !editPlaat.trim()) {
      toast.error("Vul merk en nummerplaat in");
      return;
    }
    setBusy(true);
    try {
      await updateVoertuig(id, {
        merk: editMerk.trim(),
        nummerplaat: editPlaat.trim(),
        aantal_palletplaatsen: Math.max(1, parseInt(editPlaatsen) || 0),
      });
      setEditId(null);
      invalidate();
      toast.success("Voertuig bijgewerkt");
    } catch (e: any) {
      toast.error("Er ging iets mis: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Voertuig verwijderen?")) return;
    await deleteVoertuig(id);
    invalidate();
    toast.success("Voertuig verwijderd");
  }

  return (
    <section className="mt-8 rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Truck className="size-5" />
        </div>
        <h2 className="font-semibold">Configuratie voertuigen</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Beheer de voertuigen die leeggoed ophalen. Elk voertuig heeft een merk, nummerplaat en een
        aantal palletplaatsen.
      </p>

      {/* Lijst */}
      <div className="mt-4 space-y-2">
        {(voertuigen ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen voertuigen geconfigureerd.</p>
        ) : (
          (voertuigen ?? []).map((v) =>
            editId === v.id ? (
              <div key={v.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
                <Input value={editMerk} onChange={(e) => setEditMerk(e.target.value)} placeholder="Merk" />
                <Input value={editPlaat} onChange={(e) => setEditPlaat(e.target.value)} placeholder="Nummerplaat" />
                <Input
                  type="number"
                  min={1}
                  value={editPlaatsen}
                  onChange={(e) => setEditPlaatsen(e.target.value)}
                  className="sm:w-24"
                  placeholder="Plaatsen"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="success" onClick={() => saveEdit(v.id)} disabled={busy}>
                    <Check className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{v.merk} · {v.nummerplaat}</p>
                  <p className="text-sm text-muted-foreground">{v.aantal_palletplaatsen} palletplaatsen</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => remove(v.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* Nieuw voertuig */}
      <div className="mt-4 border-t pt-4">
        <p className="text-sm font-medium">Nieuw voertuig</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <Input value={merk} onChange={(e) => setMerk(e.target.value)} placeholder="Merk (bv. Volvo)" />
          <Input value={nummerplaat} onChange={(e) => setNummerplaat(e.target.value)} placeholder="Nummerplaat (bv. 1-ABC-123)" />
          <Input
            type="number"
            min={1}
            value={plaatsen}
            onChange={(e) => setPlaatsen(e.target.value)}
            className="sm:w-24"
            placeholder="Plaatsen"
          />
          <Button onClick={add} disabled={busy}>
            <Plus className="size-4" /> Toevoegen
          </Button>
        </div>
      </div>
    </section>
  );
}
