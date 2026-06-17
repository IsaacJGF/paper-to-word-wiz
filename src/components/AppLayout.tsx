import { Link, useRouterState } from "@tanstack/react-router";
import { ScanLine, Library, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Digitalizar", icon: ScanLine },
  { to: "/questoes", label: "Questões salvas", icon: Library },
  { to: "/documento", label: "Criar documento", icon: FileText },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card sticky top-0 z-30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <ScanLine className="size-5 text-primary" />
            <span>Digitalizador de Questões</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <nav className="sm:hidden flex border-t">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.to || (t.to !== "/" && pathname.startsWith(t.to));
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
