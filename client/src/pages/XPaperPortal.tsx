import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { Button } from "@/components/ui/button";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import {
  Archive,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Factory,
  FileText,
  LogOut,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ModuleId =
  | "cadastros"
  | "almoxarifado"
  | "compras"
  | "desenvolvimento"
  | "emissor-nf"
  | "financeiro"
  | "fiscal"
  | "pcp"
  | "qualidade"
  | "vendas"
  | "relatorios"
  | "configuracoes"
  | "atualizacoes"
  | "producao";

type ModuleDefinition = {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

const MODULES: ModuleDefinition[] = [
  { id: "cadastros", label: "Cadastros", shortLabel: "Cadastros", icon: Building2 },
  { id: "almoxarifado", label: "Almoxarifado", shortLabel: "Almoxarifado", icon: Archive },
  { id: "compras", label: "Compras", shortLabel: "Compras", icon: ShoppingCart },
  { id: "desenvolvimento", label: "Desenvolvimento", shortLabel: "Desenvolvimento", icon: Sparkles },
  { id: "emissor-nf", label: "Emissor NF", shortLabel: "Emissor NF", icon: ReceiptText },
  { id: "financeiro", label: "Financeiro", shortLabel: "Financeiro", icon: BriefcaseBusiness },
  { id: "fiscal", label: "Fiscal", shortLabel: "Fiscal", icon: FileText },
  { id: "pcp", label: "PCP", shortLabel: "PCP", icon: ClipboardList },
  { id: "qualidade", label: "Qualidade", shortLabel: "Qualidade", icon: ShieldCheck },
  { id: "vendas", label: "Vendas", shortLabel: "Vendas", icon: UsersRound },
  { id: "relatorios", label: "Relatórios", shortLabel: "Relatórios", icon: BarChart3 },
  { id: "configuracoes", label: "Configurações", shortLabel: "Configurações", icon: Settings2 },
  { id: "atualizacoes", label: "Atualizações", shortLabel: "Atualizações", icon: Wrench },
  { id: "producao", label: "Produção", shortLabel: "Produção", icon: Factory },
];

export default function XPaperPortal() {
  const { user, logout } = useLocalAuth();
  const [, setLocation] = useLocation();
  const [activeId, setActiveId] = useState<ModuleId>("cadastros");

  const openModule = (module: ModuleDefinition) => {
    setActiveId(module.id);
    if (module.id === "producao") {
      setLocation("/producao");
      return;
    }
    if (module.id === "cadastros") {
      setLocation("/xpaper/cadastros");
      return;
    }
    toast.message(`${module.label}: Módulo Preparado para a Próxima Etapa.`, {
      description: "A Navegação, o Login e a Integração Comum já estão Definidos no XPAPER Central.",
    });
  };

  const signOut = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <main className="xpaper-shell">
      <header className="xpaper-header">
        <div className="xpaper-header-main">
          <button type="button" className="xpaper-brand" onClick={() => setLocation("/")} aria-label="Abrir Menu XPAPER">
            <img src={XPAPER_LOGO_SRC} alt="XPAPER" />
            <span>
              <strong>Central de Módulos</strong>
              <small>ERP Integrado</small>
            </span>
          </button>
          <div className="xpaper-header-actions">
            <ThemeConfigurator compact />
            <div className="xpaper-user-summary" aria-label={`Usuário Logado: ${user?.name ?? "Não Identificado"}`}>
              <span className="xpaper-user-avatar">{user?.name?.trim().charAt(0).toUpperCase() || "U"}</span>
              <span className="hidden min-w-0 sm:grid">
                <strong className="truncate">{user?.name ?? "Usuário XPAPER"}</strong>
                <small className="truncate">{user?.login ?? "Sessão Local"}</small>
              </span>
            </div>
            <Button type="button" onClick={() => void signOut()} variant="outline" className="xpaper-logout" title="Sair do XPAPER" aria-label="Sair do XPAPER"><LogOut className="h-4 w-4" /><span className="hidden lg:inline">Sair</span></Button>
          </div>
        </div>
        <nav className="xpaper-module-nav" aria-label="Módulos do XPAPER">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <button key={module.id} type="button" onClick={() => openModule(module)} className={activeId === module.id ? "xpaper-module-nav-item active" : "xpaper-module-nav-item"} aria-current={activeId === module.id ? "page" : undefined}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{module.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <section className="xpaper-menu-only-stage" aria-label="Área de Trabalho do XPAPER Central" />

      <footer className="xpaper-footer-status">
        <span><span className="xpaper-status-dot" />Sessão Integrada Ativa</span>
        <span>Usuário: <strong>{user?.name ?? "Não Identificado"}</strong></span>
        <span className="ml-auto">XPAPER Central</span>
      </footer>
    </main>
  );
}
