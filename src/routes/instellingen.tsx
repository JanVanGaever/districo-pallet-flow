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
