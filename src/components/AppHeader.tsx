import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function AppHeader({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="mx-auto max-w-5xl px-6 py-4 flex items-center gap-3">
        <Link to={back} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold text-sm">D</div>
        <div className="flex-1">
          <p className="font-semibold leading-tight text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">Districo Retour</p>
        </div>
      </div>
    </header>
  );
}
