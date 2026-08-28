import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";
import { ArrowLeft, Building2, ChevronDown, FileDown, FilePenLine, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CADASTRO_ENTITIES = [
  "Empresas", "Funcionários", "Clientes", "Fornecedores", "Produtos", "Setores da Empresa", "Máquinas/Processos", "Unidades de Medida", "Bancos", "Condições de Pagamento", "Contas Bancárias", "Transportadoras", "Tributações", "Papéis/Vinculados", "Participantes", "Ramos de Atividade", "Regiões",
];

export default function XPaperConsultation() {
  const [, setLocation] = useLocation();
  const { user } = useLocalAuth();
  const [entity, setEntity] = useState("Empresas");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ativo");

  const comingSoon = (action: string) => toast.message(`${action} será conectado ao Firebird nesta etapa do módulo.`, { description: "O padrão de consulta, filtros, ordenação e botões já está preparado." });

  return (
    <main className="xpaper-shell xpaper-consultation-shell">
      <header className="xpaper-header">
        <div className="xpaper-header-main">
          <button type="button" className="xpaper-brand" onClick={() => setLocation("/")} aria-label="Voltar ao XPAPER Central">
            <img src={XPAPER_LOGO_SRC} alt="XPAPER" />
            <span><strong>Cadastros</strong><small>Consulta Padrão</small></span>
          </button>
          <div className="xpaper-header-actions"><ThemeConfigurator compact /><div className="xpaper-user-summary"><span className="xpaper-user-avatar">{user?.name?.trim().charAt(0).toUpperCase() || "U"}</span><span className="hidden sm:grid"><strong>{user?.name ?? "Usuário XPAPER"}</strong><small>{user?.login ?? "Sessão local"}</small></span></div></div>
        </div>
      </header>

      <section className="xpaper-consultation-heading">
        <Button type="button" variant="outline" onClick={() => setLocation("/")} className="xpaper-back-button"><ArrowLeft className="h-4 w-4" />Central</Button>
        <div><p className="xpaper-eyebrow">Cadastros · Consulta Primeiro</p><h1>{entity}</h1><p>Todo cadastro inicia nesta tela de consulta. Depois de localizar ou selecionar um registro, as ações de manutenção ficam disponíveis.</p></div>
      </section>

      <section className="xpaper-consultation-card" aria-label="Consulta de cadastros">
        <div className="xpaper-consultation-filters">
          <div className="xpaper-filter-control"><Label htmlFor="xpaper-entity">Cadastro</Label><div className="relative"><select id="xpaper-entity" value={entity} onChange={(event) => setEntity(event.target.value)}>{CADASTRO_ENTITIES.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" /></div></div>
          <div className="xpaper-filter-control flex-1"><Label htmlFor="xpaper-search">Pesquisa</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><Input id="xpaper-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Pesquisar ${entity.toLowerCase()}...`} className="pl-9" /></div></div>
          <div className="xpaper-filter-control"><Label htmlFor="xpaper-status">Status</Label><select id="xpaper-status" value={status} onChange={(event) => setStatus(event.target.value)}><option>Ativo</option><option>Inativo</option><option>Todos</option></select></div>
          <Button type="button" onClick={() => comingSoon("Atualizar consulta")} className="xpaper-filter-submit"><Search className="h-4 w-4" />Consultar</Button>
        </div>

        <div className="xpaper-consultation-grid">
          <div className="xpaper-grid-header-row"><span>Descrição <small>↕</small></span><span>Código <small>↕</small></span><span>Situação <small>↕</small></span><span>Última Alteração <small>↕</small></span></div>
          <div className="xpaper-empty-consultation"><Building2 className="h-8 w-8" aria-hidden="true" /><strong>Consulta de {entity} Preparada</strong><p>Conectaremos esta grade à consulta equivalente do Firebird na próxima etapa. O padrão já preserva pesquisa, status, ordenação e os botões do cadastro.</p></div>
          <div className="xpaper-grid-counter">0 registros exibidos</div>
        </div>
      </section>

      <footer className="xpaper-consultation-toolbar">
        <div className="xpaper-toolbar-actions">
          <Button type="button" onClick={() => comingSoon("Novo cadastro")} className="xpaper-toolbar-primary"><Plus className="h-4 w-4" />Novo</Button>
          <Button type="button" variant="outline" onClick={() => comingSoon("Alterar cadastro")}><FilePenLine className="h-4 w-4" />Alterar</Button>
          <Button type="button" variant="outline" onClick={() => comingSoon("Excluir cadastro")}><Trash2 className="h-4 w-4" />Excluir</Button>
          <Button type="button" variant="outline" onClick={() => comingSoon("Imprimir consulta")}><FileDown className="h-4 w-4" />Imprimir</Button>
        </div>
        <Button type="button" onClick={() => setLocation("/")} className="xpaper-close-button"><X className="h-4 w-4" />Fechar</Button>
      </footer>
    </main>
  );
}
