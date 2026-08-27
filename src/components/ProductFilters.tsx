import { Star } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, Product, setProductFavoriet } from "@/lib/districo";

export const FAV = "fav";

export const pickerCatLabel: Record<string, string> = {
  fav: "Favorieten",
  bier: "Bier",
  water: "Water",
  frisdrank: "Limonade",
  andere: "Andere",
};

export const pickerCatSlot: Record<string, string> = {
  fav: "bg-warning text-warning-foreground border-warning",
  bier: "bg-warning text-warning-foreground border-warning",
  water: "bg-primary text-primary-foreground border-primary",
  frisdrank: "bg-success text-success-foreground border-success",
  andere: "bg-muted text-muted-foreground border-border",
};

/** Chips: Favorieten + categorieën */
export function CatChips({
  catFilter,
  setCatFilter,
  favCount,
}: {
  catFilter: string | null;
  setCatFilter: (v: string | null) => void;
  favCount: number;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setCatFilter(catFilter === FAV ? null : FAV)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          catFilter === FAV ? pickerCatSlot.fav : "hover:border-primary"
        }`}
      >
        <Star className={`size-3.5 ${catFilter === FAV ? "fill-current" : "text-warning"}`} />
        Favorieten
        <span className="text-xs opacity-70">{favCount}</span>
      </button>
      {CATEGORIES.map((cat) => {
        const active = catFilter === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(active ? null : cat)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active ? pickerCatSlot[cat] : "hover:border-primary"
            }`}
          >
            <span className={`inline-block size-2.5 rounded-full ${active ? "bg-current opacity-80" : pickerCatSlot[cat]}`} />
            {pickerCatLabel[cat]}
          </button>
        );
      })}
    </div>
  );
}

/** Sterretje om een product in/uit favorieten te zetten */
export function FavStar({ product, onChange }: { product: Product; onChange: () => void }) {
  const fav = !!product.favoriet;
  return (
    <button
      type="button"
      aria-label={fav ? "Uit favorieten halen" : "Toevoegen aan favorieten"}
      title={fav ? "Uit favorieten halen" : "Toevoegen aan favorieten"}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await setProductFavoriet(product.id, !fav);
          onChange();
          toast.success(fav ? `${product.naam} uit favorieten` : `${product.naam} toegevoegd aan favorieten`);
        } catch (err: any) {
          toast.error(err.message ?? "Kon favoriet niet opslaan");
        }
      }}
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-warning"
    >
      <Star className={`size-4 ${fav ? "fill-warning text-warning" : ""}`} />
    </button>
  );
}

/** Groepeer producten voor de picker: favorieten als eigen groep */
export function groupProducts(products: Product[], search: string, catFilter: string | null) {
  const q = search.toLowerCase();
  const POPULAR: Record<string, string[]> = {
    bier: ["jupiler", "maes", "cristal", "leffe", "duvel", "liefmans"],
    water: ["spa reine", "spa bruisend", "san pelegrino", "chaudfontaine plat", "chaudfontaine bruisend", "eulala"],
  };
  const rank = (cat: string, naam: string) => {
    const list = POPULAR[cat];
    if (!list) return Infinity;
    const n = naam.toLowerCase();
    const idx = list.findIndex((k) => n.includes(k));
    return idx === -1 ? Infinity : idx;
  };
  const match = (p: Product) =>
    p.naam.toLowerCase().includes(q) || (p.code ?? "").toLowerCase().includes(q);

  if (catFilter === FAV) {
    const items = products.filter((p) => p.favoriet && match(p)).sort((a, b) => a.naam.localeCompare(b.naam));
    return items.length ? [{ cat: FAV, items }] : [];
  }

  const favGroup = products.filter((p) => p.favoriet && match(p)).sort((a, b) => a.naam.localeCompare(b.naam));
  const groups = CATEGORIES.map((cat) => ({
    cat: cat as string,
    items: products
      .filter((p) => p.categorie === cat && match(p))
      .sort((a, b) => {
        const ra = rank(cat, a.naam);
        const rb = rank(cat, b.naam);
        if (ra !== rb) return ra - rb;
        return a.naam.localeCompare(b.naam);
      }),
  })).filter((g) => g.items.length > 0 && (!catFilter || g.cat === catFilter));

  // Producten zonder herkende categorie ("andere") tonen we bij zoeken ook
  const others = products
    .filter((p) => !CATEGORIES.includes(p.categorie as any) && match(p))
    .sort((a, b) => a.naam.localeCompare(b.naam));
  if (!catFilter && others.length) groups.push({ cat: "andere", items: others });

  // Favorieten altijd bovenaan — ook wanneer er op een categorie gefilterd is
  const favInScope = catFilter ? favGroup.filter((p) => p.categorie === catFilter) : favGroup;
  return favInScope.length ? [{ cat: FAV, items: favInScope }, ...groups] : groups;
}
