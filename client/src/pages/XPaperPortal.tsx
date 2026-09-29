import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { XPaperWorkspace } from "@/components/XPaperWorkspace";
import { Button } from "@/components/ui/button";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";

export default function XPaperPortal() {
  const { user, logout } = useLocalAuth();
  const [, setLocation] = useLocation();

  const signOut = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <main className="xpaper-shell">
      <header className="xpaper-header">
        <div className="xpaper-header-main">
          <button
            type="button"
            className="xpaper-brand"
            onClick={() => setLocation("/")}
            aria-label="Abrir Menu XPAPER"
          >
            <img src={XPAPER_LOGO_SRC} alt="XPAPER" />
            <span>
              <strong>Central de Módulos</strong>
              <small>ERP Integrado</small>
            </span>
          </button>
          <div className="xpaper-header-actions">
            <ThemeConfigurator compact />
            <div
              className="xpaper-user-summary"
              aria-label={`Usuário Logado: ${user?.name ?? "Não Identificado"}`}
            >
              <span className="xpaper-user-avatar">
                {user?.name?.trim().charAt(0).toUpperCase() || "U"}
              </span>
              <span className="hidden min-w-0 sm:grid">
                <strong className="truncate">
                  {user?.name ?? "Usuário XPAPER"}
                </strong>
                <small className="truncate">
                  {user?.login ?? "Sessão Local"}
                </small>
              </span>
            </div>
            <Button
              type="button"
              onClick={() => void signOut()}
              variant="outline"
              className="xpaper-logout"
              title="Sair do XPAPER"
              aria-label="Sair do XPAPER"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <XPaperWorkspace onOpenProduction={() => setLocation("/producao")} />

      <footer className="xpaper-footer-status">
        <span>
          <span className="xpaper-status-dot" />
          Sessão Integrada Ativa
        </span>
        <span>
          Usuário: <strong>{user?.name ?? "Não Identificado"}</strong>
        </span>
        <span className="ml-auto">XPAPER</span>
      </footer>
    </main>
  );
}
