import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Warehouse, LayoutDashboard, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Districo Retour — Leeggoed retourbeheer" },
      { name: "description", content: "Demo van Districo Retour: klantenportaal, magazijnier-app en kantoor-dashboard op één gedeelde backend." },
    ],
  }),
  component: Home,
});

const tiles = [
  { to: "/klant", title: "Klantenportaal", desc: "Maak een nieuwe retour aan en print de QR-codes.", icon: Package },
  { to: "/magazijn", title: "Magazijnier-app", desc: "Scan pallets, bevestig en voeg foto's toe.", icon: Warehouse },
  { to: "/kantoor", title: "Kantoor-dashboard", desc: "Volg retours en ontvangsten realtime op.", icon: LayoutDashboard },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center gap-3">
          <div className="size-9 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold">D</div>
          <div>
            <p className="font-semibold leading-tight">Districo Retour</p>
            <p className="text-xs text-muted-foreground">Leeggoed retourbeheer</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Kies een view</h1>
        <p className="mt-2 text-muted-foreground">Drie rollen, één gedeelde database. Wat het magazijn opslaat verschijnt direct op kantoor.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {tiles.map((t) => (
            <Link key={t.to} to={t.to} className="group rounded-xl border bg-card p-6 transition-colors hover:border-primary hover:bg-accent/40">
              <div className="size-11 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <t.icon className="size-6" />
              </div>
              <h2 className="mt-4 font-semibold">{t.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
