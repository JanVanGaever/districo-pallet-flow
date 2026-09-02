import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CUSTOMERS,
  EXPECTED_TODAY,
  PRODUCTS,
  declaredForPallet,
  eur,
  linesValue,
  nextPalletNumber,
  nextRetourNumber,
  palletValue,
  type Customer,
  type Pallet,
  type PalletLine,
  type PalletType,
  type PhotoSide,
  type Product,
  type Retour,
} from "@/lib/magazijn-v2/data";
import { QrScanner } from "@/lib/magazijn-v2/QrScanner";
import { SignaturePad } from "@/lib/magazijn-v2/SignaturePad";
import palletPhotoDemo from "@/assets/pallet-qr-demo.jpg";
import { Coach } from "@/lib/magazijn-v2/Coach";


export const Route = createFileRoute("/magazijn/v2")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Magazijn v2 (demo) — Districo Retour" },
      { name: "description", content: "iPad-app voor Districo-magazijniers om leeggoed-pallets snel te registreren aan de afhaalpoort." },
      { property: "og:title", content: "Districo — Leeggoed ontvangen" },
      { property: "og:description", content: "iPad-app voor Districo-magazijniers om leeggoed-pallets snel te registreren aan de afhaalpoort." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

type Screen =
  | { name: "start" }
  | { name: "search" }
  | { name: "retour" }
  | { name: "addPallet" }
  | { name: "batchQR" }
  | { name: "confirm" }
  | { name: "done"; retour: Retour };

const CUSTOMER_BY_ID = Object.fromEntries(CUSTOMERS.map((c) => [c.id, c])) as Record<string, Customer>;

function App() {
  const [screen, setScreen] = useState<Screen>({ name: "start" });
  const [retour, setRetour] = useState<Retour | null>(null);
  const [preGen, setPreGen] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(window.localStorage.getItem("districo-demo") === "1");
  }, []);

  const toggleDemo = () => {
    setDemo((d) => {
      window.localStorage.setItem("districo-demo", d ? "0" : "1");
      return !d;
    });
  };

  const startRetour = (customerId: string, order?: string) => {
    setRetour({
      retourNumber: nextRetourNumber(),
      customerId,
      order,
      pallets: [],
    });
    setPreGen([]);
    setScreen({ name: "retour" });
  };

  const addPallet = (p: Pallet) => {
    setRetour((r) => (r ? { ...r, pallets: [...r.pallets, p] } : r));
    setPreGen((list) => list.filter((n) => n !== p.palletNumber));
    setScreen({ name: "retour" });
  };

  const finish = () => {
    if (retour) setScreen({ name: "done", retour });
    setRetour(null);
  };

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <TopBar retour={retour} demo={demo} onToggleDemo={toggleDemo} />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-32 [font-variant-numeric:tabular-nums]">
        {screen.name === "start" && (
          <StartScreen onPick={startRetour} onSearch={() => setScreen({ name: "search" })} />
        )}
        {screen.name === "search" && (
          <SearchScreen onPick={(id) => startRetour(id)} onBack={() => setScreen({ name: "start" })} />
        )}
        {screen.name === "retour" && retour && (
          <RetourScreen
            retour={retour}
            preGen={preGen}
            onAdd={() => setScreen({ name: "addPallet" })}
            onBatch={() => setScreen({ name: "batchQR" })}
            onConfirm={() => setScreen({ name: "confirm" })}
          />
        )}
        {screen.name === "addPallet" && retour && (
          <AddPalletScreen
            preGen={preGen}
            onCancel={() => setScreen({ name: "retour" })}
            onAdd={addPallet}
          />
        )}
        {screen.name === "batchQR" && retour && (
          <BatchQRScreen
            onDone={(nums) => {
              setPreGen((list) => [...list, ...nums]);
              setScreen({ name: "retour" });
            }}
            onCancel={() => setScreen({ name: "retour" })}
          />
        )}
        {screen.name === "confirm" && retour && (
          <ConfirmScreen retour={retour} onBack={() => setScreen({ name: "retour" })} onDone={finish} />
        )}
        {screen.name === "done" && (
          <DoneScreen retour={screen.retour} onNew={() => setScreen({ name: "start" })} />
        )}
      </main>
      <Coach enabled={demo} />
    </div>
  );
}

/* ------------ Top bar ------------ */

function totals(retour: Retour | null) {
  if (!retour) return { known: 0, pending: 0, count: 0, correct: 0, fout: 0 };
  let known = 0;
  let pending = 0;
  let correct = 0;
  let fout = 0;
  for (const p of retour.pallets) {
    if (p.status === "correct") {
      correct++;
      pending++;
    } else if (p.status === "fout") {
      fout++;
      if (p.lines && p.lines.length > 0) {
        known += linesValue(p.lines);
      } else if (p.productId && p.aantal) {
        const prod = PRODUCTS.find((x) => x.id === p.productId);
        if (prod) known += prod.bak * p.aantal;
      } else {
        pending++;
      }
    } else {
      pending++;
    }
  }
  return { known, pending, count: retour.pallets.length, correct, fout };
}


function TopBar({
  retour,
  demo,
  onToggleDemo,
}: {
  retour: Retour | null;
  demo: boolean;
  onToggleDemo: () => void;
}) {
  const t = totals(retour);
  const cust = retour ? CUSTOMER_BY_ID[retour.customerId] : null;
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 [font-variant-numeric:tabular-nums]">
        <Link
          to="/"
          aria-label="Terug naar hoofdmenu"
          title="Terug naar hoofdmenu"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="text-xl font-black tracking-tight text-red-700">DISTRICO</div>
        {retour && cust ? (
          <div className="flex flex-1 items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <div className="truncate font-semibold text-neutral-900">{cust.naam}</div>
              <div className="truncate text-xs text-neutral-500">
                {cust.id}
                {cust.plaats ? ` · ${cust.plaats}` : ""} · {retour.retourNumber}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-neutral-500">Pallets</div>
                <div className="text-base font-semibold">{t.count}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">Bekend</div>
                <div className="text-base font-semibold">{eur(t.known)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 text-sm text-neutral-500">Leeggoed ontvangen</div>
        )}
        <button
          onClick={onToggleDemo}
          aria-pressed={demo}
          title="Demo-/leermodus: toont een handje bij de volgende stap"
          className={`ml-2 flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${
            demo
              ? "border-red-700 bg-red-50 text-red-800"
              : "border-neutral-300 bg-white text-neutral-600"
          }`}
        >
          <span className="text-base">👆</span>
          <span className="hidden sm:inline">Demo-modus</span>
          <span
            className={`flex h-5 w-9 items-center rounded-full px-0.5 transition ${
              demo ? "bg-red-700" : "bg-neutral-300"
            }`}
          >
            <span className={`h-4 w-4 rounded-full bg-white transition ${demo ? "translate-x-4" : ""}`} />
          </span>
        </button>
      </div>
    </header>
  );
}

/* ------------ Start ------------ */

function StartScreen({
  onPick,
  onSearch,
}: {
  onPick: (id: string, order?: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Verwacht vandaag</h1>
      <ul className="space-y-2">
        {EXPECTED_TODAY.map((e, idx) => {
          const c = CUSTOMER_BY_ID[e.id];
          if (!c) return null;
          return (
            <li key={e.order}>
              <button
                onClick={() => onPick(e.id, e.order)}
                {...(idx === 0 ? { "data-coach": "Kies een klant", "data-coach-order": "0" } : {})}
                className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm transition active:bg-neutral-50"
              >
                
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{c.naam}</div>
                  <div className="truncate text-sm text-neutral-500">
                    {c.id} · {c.plaats || "—"} · {e.order}
                  </div>
                </div>
                <div className="text-neutral-400">›</div>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        onClick={onSearch}
        className="h-14 w-full rounded-xl border border-neutral-300 bg-white text-base font-medium text-neutral-800"
      >
        Andere klant zoeken
      </button>
    </div>
  );
}

/* ------------ Search ------------ */

function SearchScreen({ onPick, onBack }: { onPick: (id: string) => void; onBack: () => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CUSTOMERS;
    return CUSTOMERS.filter(
      (c) =>
        c.naam.toLowerCase().includes(s) ||
        c.plaats.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s),
    );
  }, [q]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Klant zoeken</h1>
        <button onClick={onBack} className="text-sm font-medium text-neutral-600">
          Terug
        </button>
      </div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Naam, plaats of klantnummer"
        className="h-14 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base"
      />
      <ul className="space-y-2">
        {list.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onPick(c.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-left active:bg-neutral-50"
            >
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{c.naam}</div>
                <div className="truncate text-sm text-neutral-500">
                  {c.id}
                  {c.plaats ? ` · ${c.plaats}` : ""}
                </div>
              </div>
              <div className="text-neutral-400">›</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------ Retour overview ------------ */

const STATUS_BADGE: Record<"correct" | "fout", string> = {
  correct: "bg-emerald-100 text-emerald-800",
  fout: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<"correct" | "fout", string> = {
  correct: "Correct ✓",
  fout: "Fout",
};


function RetourScreen({
  retour,
  preGen,
  onAdd,
  onBatch,
  onConfirm,
}: {
  retour: Retour;
  preGen: string[];
  onAdd: () => void;
  onBatch: () => void;
  onConfirm: () => void;
}) {
  const t = totals(retour);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pallets</h1>
        <button
          onClick={onBatch}
          className="h-12 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-medium"
        >
          QR-codes aanmaken{preGen.length > 0 ? ` (${preGen.length} klaar)` : ""}
        </button>
      </div>

      {retour.pallets.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">
          Nog geen pallets toegevoegd.
        </div>
      ) : (
        <ul className="space-y-2">
          {retour.pallets.map((p, i) => {
            const hasLines = !!p.lines && p.lines.length > 0;
            const label = hasLines
              ? p
                  .lines!.map((l) => {
                    const pr = PRODUCTS.find((x) => x.id === l.productId);
                    return `${pr?.naam ?? "?"} ${l.aantal}×`;
                  })
                  .join(" · ")
              : p.status === "fout"
                ? p.handling === "later"
                  ? "Fout — later behandelen"
                  : "Fout — na controle"
                : "Ontvangst correct";
            return (
              <li
                key={i}
                className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        p.status ? STATUS_BADGE[p.status] : ""
                      }`}
                    >
                      {p.status ? STATUS_LABEL[p.status] : "?"}
                    </span>
                    <span className="truncate font-semibold">{label}</span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.palletNumber} · Foto {p.foto ? "✓" : "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right font-semibold">
                  {hasLines ? (
                    eur(linesValue(p.lines!))
                  ) : (
                    <span className="text-neutral-500">na controle</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={onAdd}
        data-coach="Voeg een pallet toe"
        data-coach-order="1"
        className="h-16 w-full rounded-2xl bg-red-700 text-lg font-semibold text-white shadow active:bg-red-800"
      >
        + Pallet toevoegen
      </button>

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 [font-variant-numeric:tabular-nums]">
          <div className="text-sm">
            <div className="text-xs text-neutral-500">Bekend statiegeld</div>
            <div className="text-lg font-bold">{eur(t.known)}</div>
            {t.pending > 0 && (
              <div className="text-xs text-amber-700">{t.pending} pallet(s) na controle</div>
            )}
          </div>
          <button
            disabled={t.count === 0}
            onClick={onConfirm}
            data-coach="Rond de retour af"
            data-coach-order="5"
            className="h-14 rounded-xl bg-red-700 px-8 text-base font-semibold text-white disabled:bg-neutral-300"
          >
            Afronden
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------ Add pallet wizard ------------ */

function AddPalletScreen({
  preGen,
  onCancel,
  onAdd,
}: {
  preGen: string[];
  onCancel: () => void;
  onAdd: (p: Pallet) => void;
}) {
  const [palletNumber, setPalletNumber] = useState<string | null>(null);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<PhotoSide, string>>>({});
  const [photoConfirmed, setPhotoConfirmed] = useState(false);
  const [status, setStatus] = useState<"correct" | "fout" | null>(null);
  const [handling, setHandling] = useState<"nu" | "later" | null>(null);
  const [lines, setLines] = useState<PalletLine[]>([]);
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [newAantal, setNewAantal] = useState<number>(1);
  const [cat, setCat] = useState<string>("Alle");
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");

  const allPhotos = !!photos.zijde1 && photoConfirmed;

  const allLinesHandled = lines.length > 0 && lines.every((l) => l.changed);
  const firstUnhandled = lines.findIndex((l) => !l.changed);

  const canSave =
    !!palletNumber &&
    allPhotos &&
    (status === "correct" ||
      (status === "fout" && handling === "later") ||
      (status === "fout" && handling === "nu" && allLinesHandled));

  const submit = () => {
    if (!canSave || !palletNumber || !status) return;
    const corrigeren = status === "fout" && handling === "nu";
    onAdd({
      palletNumber,
      foto: true,
      photos,
      status,
      type: null,
      productId: null,
      aantal: null,
      handling: status === "fout" ? handling : null,
      lines: corrigeren ? lines : undefined,
    });
  };

  const setLine = (i: number, patch: Partial<PalletLine>) =>
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const products = PRODUCTS.filter((p) => cat === "Alle" || p.cat === cat);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pallet toevoegen</h1>
        <button onClick={onCancel} className="text-sm font-medium text-neutral-600">
          Annuleer
        </button>
      </div>

      {/* Step 1 — identity */}
      <Step n={1} title="Identiteit" done={!!palletNumber}>
        {palletNumber ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
            <div>
              <div className="text-xs text-emerald-800">Palletnummer</div>
              <div className="text-lg font-bold">{palletNumber}</div>
            </div>
            {generatedQR && (
              <div className="rounded-md bg-white p-2">
                <QRCodeSVG value={generatedQR} size={88} />
              </div>
            )}
            <button
              onClick={() => {
                setPalletNumber(null);
                setGeneratedQR(null);
              }}
              className="text-sm text-neutral-600"
            >
              Wijzig
            </button>
          </div>
        ) : scanning ? (
          <QrScanner
            onScan={(text) => {
              setPalletNumber(text);
              setScanning(false);
            }}
            onCancel={() => setScanning(false)}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled
                aria-disabled="true"
                className="h-16 cursor-not-allowed rounded-xl bg-neutral-900 text-base font-semibold text-white opacity-60"
              >
                Scan QR
              </button>

              <button
                onClick={() => {
                  const n = nextPalletNumber();
                  setPalletNumber(n);
                  setGeneratedQR(n);
                }}
                className="h-16 rounded-xl border-2 border-neutral-900 bg-white text-base font-semibold"
              >
                QR aanmaken
              </button>
            </div>
            <button
              onClick={() => {
                const fake = `PAL-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
                setPalletNumber(fake);
              }}
              data-coach="Scan de pallet (simulatie)"
              data-coach-order="0"
              className="h-14 w-full rounded-xl border-2 border-dashed border-amber-500 bg-amber-50 text-base font-semibold text-amber-900"
            >
              🧪 Simuleer scan (test)
            </button>
            {preGen.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium text-neutral-600">
                  Vooraf gegenereerd
                </div>
                <div className="flex flex-wrap gap-2">
                  {preGen.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPalletNumber(n)}
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <details className="rounded-xl border border-neutral-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                Simuleer scan / handmatig
              </summary>
              <div className="mt-3 flex gap-2">
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="PAL-2026-…"
                  className="h-12 flex-1 rounded-lg border border-neutral-300 px-3"
                />
                <button
                  onClick={() => {
                    if (manual.trim()) {
                      setPalletNumber(manual.trim());
                      setManual("");
                    }
                  }}
                  className="h-12 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white"
                >
                  Gebruik
                </button>
              </div>
            </details>
          </div>
        )}
      </Step>

      {/* Step 2 — photo */}
      <Step n={2} title="Foto" done={allPhotos} disabled={!palletNumber}>
        <div className="space-y-2">
          <div className="text-sm text-neutral-600">Neem één foto van de pallet</div>
          <div
            className={`relative mx-auto flex w-full max-w-md cursor-not-allowed flex-col items-center justify-center overflow-hidden rounded-xl border-2 text-center text-sm font-semibold ${
              photos.zijde1
                ? "aspect-[3/4] border-emerald-500 bg-neutral-900 text-emerald-800"
                : "h-48 border-dashed border-neutral-400 bg-white text-neutral-700"
            } ${!palletNumber ? "opacity-50" : ""}`}
          >
            {photos.zijde1 ? (
              <>
                <img src={photos.zijde1} alt="Pallet" className="absolute inset-0 h-full w-full object-contain" />
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-white">Foto ✓</span>
              </>
            ) : (
              <>
                <span className="text-4xl">📷</span>
                <span>Foto nemen</span>
              </>
            )}
          </div>


          <div className="flex gap-2">
            {photos.zijde1 ? (
              <>
                <button
                  onClick={() => {
                    setPhotos({});
                    setPhotoConfirmed(false);
                  }}
                  className="h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium"
                >
                  Wis foto
                </button>
                <button
                  onClick={() => setPhotoConfirmed(true)}
                  {...(!photoConfirmed
                    ? { "data-coach": "Bevestig de foto", "data-coach-order": "1" }
                    : {})}
                  className={`h-10 flex-1 rounded-lg px-3 text-sm font-semibold text-white ${
                    photoConfirmed ? "bg-emerald-700" : "bg-neutral-900"
                  }`}
                >
                  {photoConfirmed ? "Foto bevestigd ✓" : "Bevestig foto"}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setPhotos({ zijde1: palletPhotoDemo });
                  setPhotoConfirmed(false);
                }}
                data-coach="Neem een foto (simulatie)"
                data-coach-order="1"
                className="h-10 rounded-lg border-2 border-dashed border-amber-500 bg-amber-50 px-3 text-sm font-semibold text-amber-900"
              >
                🧪 Simuleer foto
              </button>
            )}
          </div>

        </div>
      </Step>


      {/* Step 3 — ontvangst */}
      <Step n={3} title="Ontvangst" done={!!status} disabled={!allPhotos}>
        <div
          className="grid grid-cols-2 gap-3"
          {...(allPhotos && !status
            ? {
                "data-coach": "Kies zelf: correct of fout",
                "data-coach-order": "2",
                "data-coach-soft": "true",
              }
            : {})}
        >
          <button
            onClick={() => {
              setStatus("correct");
              setLines([]);
              setHandling(null);
            }}
            disabled={!allPhotos}
            className={`flex h-28 flex-col items-center justify-center rounded-xl border-2 disabled:opacity-50 ${

              status === "correct"
                ? "border-emerald-600 bg-emerald-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <span className="text-4xl leading-none text-emerald-600">✓</span>
            <span className="mt-2 text-lg font-bold">Ontvangst correct</span>
          </button>
          <button
            onClick={() => setStatus("fout")}
            disabled={!allPhotos}
            className={`flex h-28 flex-col items-center justify-center rounded-xl border-2 disabled:opacity-50 ${
              status === "fout"
                ? "border-red-600 bg-red-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <span className="text-4xl leading-none text-red-600">✕</span>
            <span className="mt-2 text-lg font-bold">Fout</span>
          </button>
        </div>
      </Step>

      {/* Step 4 — afhandeling (only for fout) */}
      {status === "fout" && (
        <Step n={4} title="Afhandeling" done={!!handling}>
          <div
            className="grid grid-cols-2 gap-3"
            {...(!handling
              ? {
                  "data-coach": "Kies zelf: nu corrigeren of later behandelen",
                  "data-coach-order": "2.4",
                  "data-coach-soft": "true",
                }
              : {})}
          >
            <button
              onClick={() => {
                setHandling("nu");
                if (palletNumber) setLines(declaredForPallet(palletNumber));
              }}
              className={`flex h-24 flex-col items-center justify-center rounded-xl border-2 ${
                handling === "nu" ? "border-red-700 bg-red-50" : "border-neutral-200 bg-white"
              }`}
            >
              <span className="text-3xl leading-none">✎</span>
              <span className="mt-2 text-lg font-bold">Nu corrigeren</span>
            </button>
            <button
              onClick={() => {
                setHandling("later");
                setLines([]);
              }}
              className={`flex h-24 flex-col items-center justify-center rounded-xl border-2 ${
                handling === "later" ? "border-amber-600 bg-amber-50" : "border-neutral-200 bg-white"
              }`}
            >
              <span className="text-3xl leading-none">⏱</span>
              <span className="mt-2 text-lg font-bold">Later behandelen</span>
            </button>
          </div>
        </Step>
      )}

      {/* Step 5 — correctie (only when corrigeren nu) */}
      {status === "fout" && handling === "nu" && (
        <Step n={5} title="Correctie" done={allLinesHandled}>
          <div className="space-y-3">
            <div className="text-sm text-neutral-600">
              Aangemelde producten — bevestig of corrigeer elk product (
              {lines.filter((l) => l.changed).length}/{lines.length})
            </div>

            <ul className="space-y-2">
              {lines.map((l, i) => {
                const prod = PRODUCTS.find((x) => x.id === l.productId);
                const open = openLine === i;
                const afwijking = l.declaredAantal !== null && l.aantal !== l.declaredAantal;
                return (
                  <li
                    key={i}
                    className={`overflow-hidden rounded-xl border-2 ${
                      l.changed
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-neutral-200 bg-white"
                    }`}
                  >
                    <button
                      onClick={() => setOpenLine(open ? null : i)}
                      {...(!l.changed && openLine === null && i === firstUnhandled
                        ? {
                            "data-coach": "Open dit product",
                            "data-coach-order": "2.5",
                          }
                        : {})}
                      className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold">
                          {prod?.naam ?? "—"} {l.changed ? "✓" : ""}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {prod?.verp}
                          {l.declaredAantal === null ? " · toegevoegd" : ""}
                          {afwijking ? ` · aangemeld ${l.declaredAantal}×` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xl font-bold tabular-nums">{l.aantal}×</div>
                        <div className="text-xs text-neutral-500">
                          {prod ? eur(prod.bak * l.aantal) : ""}
                        </div>
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-neutral-200 bg-white/70 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLine(i, { aantal: Math.max(0, l.aantal - 1) })}
                            className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            value={l.aantal}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              setLine(i, { aantal: Number.isNaN(v) ? 0 : Math.max(0, v) });
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="h-14 flex-1 rounded-xl border border-neutral-300 text-center text-2xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => setLine(i, { aantal: l.aantal + 1 })}
                            className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div
                          className="grid grid-cols-2 gap-3"
                          data-coach="Kies zelf: bevestigen of corrigeren"
                          data-coach-bubble="below"
                          data-coach-order="2.5"
                          data-coach-soft="true"
                        >
                          <button
                            onClick={() => {
                              setLine(i, {
                                aantal: l.declaredAantal ?? l.aantal,
                                changed: true,
                              });
                              setOpenLine(null);
                            }}
                            className="h-14 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-base font-bold text-emerald-800"
                          >
                            ✓ Bevestigen
                          </button>
                          <button
                            onClick={() => {
                              setLine(i, { changed: true });
                              setOpenLine(null);
                            }}
                            className="h-14 rounded-xl bg-neutral-900 text-base font-bold text-white"
                          >
                            Corrigeren naar {l.aantal}×
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setLines((ls) => ls.filter((_, k) => k !== i));
                            setOpenLine(null);
                          }}
                          className="h-11 w-full rounded-xl border border-red-300 bg-white text-sm font-medium text-red-700"
                        >
                          Product verwijderen
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-medium text-neutral-600">Totaal statiegeld</span>
              <span className="text-lg font-bold tabular-nums">{eur(linesValue(lines))}</span>
            </div>

            {/* Product toevoegen */}
            {adding ? (
              <div className="space-y-3 rounded-xl border-2 border-neutral-300 bg-white p-4">
                <div className="text-sm font-semibold">Product toevoegen</div>
                <div className="flex flex-wrap gap-2">
                  {["Alle", "Pils", "Frisdrank", "Water", "Speciaal"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCat(c)}
                      className={`h-10 rounded-full px-4 text-sm font-medium ${
                        cat === c
                          ? "bg-neutral-900 text-white"
                          : "border border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setNewProductId(p.id)}
                      className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left ${
                        newProductId === p.id
                          ? "border-red-700 bg-red-50"
                          : "border-neutral-200 bg-white"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{p.naam}</div>
                        <div className="text-xs text-neutral-500">{p.verp}</div>
                      </div>
                      <div className="text-right font-semibold tabular-nums">{eur(p.bak)}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewAantal(Math.max(1, newAantal - 1))}
                    className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={newAantal}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setNewAantal(Number.isNaN(v) ? 1 : Math.max(1, v));
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    className="h-14 flex-1 rounded-xl border border-neutral-300 text-center text-2xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setNewAantal(newAantal + 1)}
                    className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
                  >
                    +
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setAdding(false);
                      setNewProductId(null);
                    }}
                    className="h-14 rounded-xl border border-neutral-300 bg-white text-base font-medium"
                  >
                    Annuleer
                  </button>
                  <button
                    disabled={!newProductId}
                    onClick={() => {
                      if (!newProductId) return;
                      setLines((ls) => [
                        ...ls,
                        {
                          productId: newProductId,
                          declaredAantal: null,
                          aantal: newAantal,
                          changed: true,
                        },
                      ]);
                      setAdding(false);
                      setNewProductId(null);
                      setNewAantal(1);
                    }}
                    className="h-14 rounded-xl bg-neutral-900 text-base font-bold text-white disabled:bg-neutral-300"
                  >
                    Toevoegen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="h-14 w-full rounded-xl border-2 border-neutral-900 bg-white text-base font-semibold"
              >
                + Product toevoegen
              </button>
            )}
          </div>
        </Step>
      )}

      <button
        disabled={!canSave}
        onClick={submit}
        data-coach="Bewaar deze pallet"
        data-coach-order="3"
        className="h-16 w-full rounded-2xl bg-red-700 text-lg font-semibold text-white shadow disabled:bg-neutral-300"
      >
        Pallet toevoegen
      </button>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  disabled,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-4 ${
        disabled ? "border-neutral-200 opacity-50" : "border-neutral-200"
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            done ? "bg-emerald-600 text-white" : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {done ? "✓" : n}
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className={disabled ? "pointer-events-none" : ""}>{children}</div>
    </section>
  );
}

function TypeButton({
  label,
  desc,
  color,
  active,
  disabled,
  onClick,
}: {
  label: string;
  desc: string;
  color: "emerald" | "amber" | "neutral";
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const palette = {
    emerald: active ? "border-emerald-600 bg-emerald-50" : "border-neutral-200 bg-white",
    amber: active ? "border-amber-500 bg-amber-50" : "border-neutral-200 bg-white",
    neutral: active ? "border-neutral-700 bg-neutral-100" : "border-neutral-200 bg-white",
  }[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-24 flex-col items-center justify-center rounded-xl border-2 ${palette} disabled:opacity-50`}
    >
      <span className="text-lg font-bold">{label}</span>
      <span className="mt-1 text-xs text-neutral-500">{desc}</span>
    </button>
  );
}

/* ------------ Batch QR ------------ */

function BatchQRScreen({ onDone, onCancel }: { onDone: (nums: string[]) => void; onCancel: () => void }) {
  const [count, setCount] = useState(5);
  const [nums, setNums] = useState<string[]>([]);
  const generate = () => {
    const arr = Array.from({ length: count }, () => nextPalletNumber());
    setNums(arr);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">QR-codes aanmaken</h1>
        <button onClick={onCancel} className="text-sm text-neutral-600">
          Terug
        </button>
      </div>
      {nums.length === 0 ? (
        <div className="space-y-4 rounded-2xl bg-white p-5">
          <label className="block text-sm font-medium">Aantal pallets</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCount(Math.max(1, count - 10))}
              className="h-14 w-14 rounded-xl border border-neutral-300 text-lg font-bold"
            >
              −10
            </button>
            <button
              onClick={() => setCount(Math.max(1, count - 1))}
              className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={count}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isNaN(v)) return setCount(1);
                setCount(Math.min(50, Math.max(1, v)));
              }}
              onFocus={(e) => e.currentTarget.select()}
              className="h-14 flex-1 rounded-xl border border-neutral-300 text-center text-2xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              onClick={() => setCount(Math.min(50, count + 1))}
              className="h-14 w-14 rounded-xl border border-neutral-300 text-2xl font-bold"
            >
              +
            </button>
            <button
              onClick={() => setCount(Math.min(50, count + 10))}
              className="h-14 w-14 rounded-xl border border-neutral-300 text-lg font-bold"
            >
              +10
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 10, 20, 33].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={`h-12 flex-1 min-w-[64px] rounded-xl border text-base font-semibold tabular-nums ${
                  count === n
                    ? "border-red-700 bg-red-50 text-red-700"
                    : "border-neutral-300 bg-white text-neutral-800"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            className="h-14 w-full rounded-xl bg-red-700 text-base font-semibold text-white"
          >
            Genereer {count} QR-{count === 1 ? "code" : "codes"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="h-12 flex-1 rounded-xl bg-neutral-900 text-sm font-semibold text-white"
            >
              Afdrukken
            </button>
            <button
              onClick={() => onDone(nums)}
              className="h-12 flex-1 rounded-xl bg-red-700 text-sm font-semibold text-white"
            >
              Klaar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {nums.map((n) => (
              <div key={n} className="flex flex-col items-center rounded-xl bg-white p-4">
                <QRCodeSVG value={n} size={140} />
                <div className="mt-2 text-sm font-semibold tabular-nums">{n}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------ Confirm ------------ */

function ConfirmScreen({
  retour,
  onBack,
  onDone,
}: {
  retour: Retour;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = totals(retour);
  const [hasSig, setHasSig] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ontvangst bevestigen</h1>
        <button onClick={onBack} className="text-sm text-neutral-600">
          Terug
        </button>
      </div>

      <div className="rounded-2xl bg-white p-5">
        <div className="grid grid-cols-2 gap-3 text-center">
          <Stat label="Correct" value={t.correct} color="emerald" />
          <Stat label="Fout" value={t.fout} color="amber" />
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4">
          <div className="flex justify-between">
            <span className="text-neutral-600">Bekend statiegeld</span>
            <span className="text-lg font-bold tabular-nums">{eur(t.known)}</span>
          </div>
          {t.pending > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              {t.pending} pallet(s) worden na controle in het magazijn geteld en gecrediteerd.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5">
        <h2 className="mb-2 text-lg font-semibold">Handtekening klant</h2>
        <p className="mb-3 text-sm text-neutral-600">
          De klant tekent voor de <strong>ontvangst van de pallets</strong>, niet voor een eindbedrag.
        </p>
        <SignaturePad onChange={setHasSig} />
      </div>

      <button
        disabled={!hasSig}
        onClick={onDone}
        data-coach="Laat de klant aftekenen en bevestig"
        data-coach-order="4"
        className="h-16 w-full rounded-2xl bg-red-700 text-lg font-semibold text-white shadow disabled:bg-neutral-300"
      >
        Bevestig ontvangst
      </button>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: "emerald" | "amber" | "neutral" }) {
  const c = {
    emerald: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    neutral: "bg-neutral-100 text-neutral-700",
  }[color];
  return (
    <div className={`rounded-xl ${c} p-3`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs font-medium">{label}</div>
    </div>
  );
}

/* ------------ Done ------------ */

function DoneScreen({ retour, onNew }: { retour: Retour; onNew: () => void }) {
  const t = totals(retour);
  const cust = CUSTOMER_BY_ID[retour.customerId];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-emerald-50 p-6 text-center">
        <div className="text-5xl">✓</div>
        <h1 className="mt-2 text-2xl font-bold text-emerald-900">Ontvangen</h1>
        <div className="mt-1 text-sm text-emerald-800">{retour.retourNumber}</div>
      </div>

      <div className="space-y-2 rounded-2xl bg-white p-5">
        <Row label="Klant" value={cust?.naam ?? "—"} />
        <Row label="Klantnummer" value={cust?.id ?? "—"} />
        <Row label="Pallets" value={String(t.count)} />
        <Row label="Bekend statiegeld" value={eur(t.known)} strong />
        {t.pending > 0 && <Row label="Na controle" value={`${t.pending} pallet(s)`} />}
      </div>

      <button
        onClick={onNew}
        className="h-16 w-full rounded-2xl bg-red-700 text-lg font-semibold text-white shadow"
      >
        Nieuwe retour
      </button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-600">{label}</span>
      <span className={`tabular-nums ${strong ? "text-lg font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
