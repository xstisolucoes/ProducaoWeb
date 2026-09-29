import { ConnectionNotice, LoadingRows, SortableHeader, StatusPill, TablePagination, useGridSort } from "@/components/ProductionPrimitives";
import "./XPaperWorkspace.css";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  Archive,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ContactRound,
  FilePenLine,
  FileText,
  Factory,
  FolderKanban,
  Landmark,
  LayoutGrid,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UsersRound,
  X,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ParticipantType = "Todos" | "Cliente" | "Fornecedor" | "Outro Participante" | "Representante";
type ParticipantStatus = "Todos" | "Ativo" | "Inativo";

type ParticipantRow = {
  codigo: number;
  tipo: Exclude<ParticipantType, "Todos">;
  fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  status: string | null;
};

type ClientDialogState =
  | { mode: "create" }
  | { mode: "view"; participant: ParticipantRow };

type WorkspaceTab =
  | { id: "inicio"; kind: "home"; title: string; closable: false }
  | { id: "participantes"; kind: "participants"; title: string; closable: true }
  | { id: "novo-cliente"; kind: "new-client"; title: string; closable: true }
  | { id: `form:${string}`; kind: "form"; title: string; formId: string; closable: true }
  | { id: `cliente:${number}`; kind: "client"; title: string; codigo: number; fallback: ParticipantRow; closable: true }
  | { id: `participante:${number}`; kind: "participant"; title: string; participant: ParticipantRow; closable: true };

type ModuleId = "cadastros" | "almoxarifado" | "compras" | "desenvolvimento" | "emissor-nf" | "financeiro" | "fiscal" | "pcp" | "qualidade" | "vendas" | "relatorios" | "configuracoes" | "atualizacoes" | "producao";
type SidebarItem = { id: string; label: string; icon: LucideIcon };

const MODULES: { id: ModuleId; label: string; icon: LucideIcon }[] = [
  { id: "cadastros", label: "Cadastros", icon: Building2 },
  { id: "almoxarifado", label: "Almoxarifado", icon: Archive },
  { id: "compras", label: "Compras", icon: ShoppingCart },
  { id: "desenvolvimento", label: "Desenvolvimento", icon: Sparkles },
  { id: "emissor-nf", label: "Emissor NF", icon: ReceiptText },
  { id: "financeiro", label: "Financeiro", icon: BriefcaseBusiness },
  { id: "fiscal", label: "Fiscal", icon: FileText },
  { id: "pcp", label: "PCP", icon: ClipboardList },
  { id: "qualidade", label: "Qualidade", icon: ShieldCheck },
  { id: "vendas", label: "Vendas", icon: UsersRound },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "configuracoes", label: "Configurações", icon: Settings2 },
  { id: "atualizacoes", label: "Atualizações", icon: Wrench },
  { id: "producao", label: "Produção", icon: Factory },
];

const CADASTRO_FORMS: SidebarItem[] = [
  { id: "participantes", label: "Participantes", icon: UsersRound },
  { id: "clientes", label: "Clientes", icon: Building2 },
  { id: "fornecedores", label: "Fornecedores", icon: Archive },
  { id: "outros-participantes", label: "Outros Participantes", icon: ContactRound },
  { id: "representantes", label: "Representantes", icon: UsersRound },
  { id: "contabilistas", label: "Contabilistas", icon: BriefcaseBusiness },
  { id: "transportadoras", label: "Transportadoras", icon: Factory },
  { id: "condicoes-pagamento", label: "Condições de Pagamento", icon: Landmark },
];

const CONSULTATION_FORMS: SidebarItem[] = [
  { id: "consulta-geral", label: "Consulta Geral", icon: Search },
  { id: "relatorios", label: "Relatórios", icon: FileText },
];

const FORM_BLUEPRINTS: Record<string, { title: string; description: string; sections: string[] }> = {
  clientes: { title: "Cadastro de Clientes", description: "Estrutura Inicial Baseada no Formulário U_CadCliente do Legado.", sections: ["Dados Gerais", "Endereços", "Comercial", "Fiscal", "Regras de Produção", "Contatos"] },
  fornecedores: { title: "Cadastro de Fornecedores", description: "Estrutura Inicial Baseada no Formulário U_CadFornecedor do Legado.", sections: ["Dados Gerais", "Endereços", "Comercial", "Fiscal", "Qualificação", "Contatos"] },
  "outros-participantes": { title: "Cadastro de Outros Participantes", description: "Estrutura Inicial Baseada no Formulário U_CadOutros do Legado.", sections: ["Dados Gerais", "Endereços", "Contatos"] },
  representantes: { title: "Cadastro de Representantes", description: "Estrutura Preparada para os Dados Comerciais e Contatos do Participante.", sections: ["Dados Gerais", "Endereços", "Comercial", "Contatos"] },
  contabilistas: { title: "Cadastro de Contabilistas", description: "Estrutura Inicial Baseada no Formulário U_CadContabilista do Legado.", sections: ["Dados Gerais", "Endereços", "Dados Fiscais", "Contatos"] },
  transportadoras: { title: "Cadastro de Transportadoras", description: "Estrutura Inicial Baseada nos Formulários U_CadTransportadora e U_CadPlacaTransportadora do Legado.", sections: ["Dados Gerais", "Endereços", "Veículos", "Contatos"] },
  "condicoes-pagamento": { title: "Condições de Pagamento", description: "Estrutura Inicial Baseada no Formulário U_CadCondPagamento do Legado.", sections: ["Dados Gerais", "Parcelas", "Preferências", "Condições Especiais"] },
  "consulta-geral": { title: "Consulta Geral", description: "Aba Preparada para as Próximas Consultas do XPAPER.", sections: ["Filtros", "Resultados"] },
  relatorios: { title: "Relatórios", description: "Aba Preparada para os Relatórios Gerenciais e Operacionais.", sections: ["Parâmetros", "Resultados"] },
};

const SIDEBAR_SECTIONS: { label: string; items: SidebarItem[] }[] = [
  {
    label: "Cadastros",
    items: CADASTRO_FORMS,
  },
  {
    label: "Consultas",
    items: CONSULTATION_FORMS,
  },
] as const;

function participantTitle(participant: ParticipantRow) {
  return `${participant.tipo} ${participant.codigo}`;
}

function WorkspaceHome({ onOpenParticipants }: { onOpenParticipants: () => void }) {
  return (
    <section className="xpaper-workspace-home" aria-labelledby="xpaper-workspace-title">
      <div className="xpaper-workspace-home-icon"><LayoutGrid className="h-6 w-6" /></div>
      <p className="xpaper-eyebrow">XPAPER</p>
      <h1 id="xpaper-workspace-title">Área de Trabalho</h1>
      <p>
        Utilize a Sidebar para Abrir Consultas e Cadastros. As Abas Internas Preservam a Pesquisa e os Dados Já Consultados Enquanto Permanecerem Abertas.
      </p>
      <Button type="button" onClick={onOpenParticipants} className="xpaper-workspace-primary-action">
        <UsersRound className="h-4 w-4" />
        Consulta de Participantes
      </Button>
    </section>
  );
}

function ParticipantsTab({ onOpenParticipant, onCreateClient }: { onOpenParticipant: (participant: ParticipantRow) => void; onCreateClient: () => void }) {
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [type, setType] = useState<ParticipantType>("Todos");
  const [status, setStatus] = useState<ParticipantStatus>("Ativo");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setCommittedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = trpc.participants.list.useQuery({
    page,
    limit: 20,
    search: committedSearch,
    type,
    status,
  });
  const rows = (query.data?.items ?? []) as ParticipantRow[];
  const { sortedItems, sortKey, sortDirection, toggleSort } = useGridSort(rows);
  const handleSort = (column: string) => toggleSort(column as keyof ParticipantRow & string);

  const updateFilter = <T,>(setFilter: (value: T) => void, value: T) => {
    setFilter(value);
    setPage(1);
  };

  return (
    <section className="xpaper-participants-tab" aria-labelledby="participants-title">
      <header className="xpaper-content-heading">
        <div>
          <p className="xpaper-eyebrow">Cadastros / Participantes</p>
          <h1 id="participants-title">Consulta de Participantes</h1>
          <p>Consulte Clientes, Fornecedores, Outros Participantes e Representantes sem Perder os Filtros ao Alternar entre Abas.</p>
        </div>
        <Button type="button" className="xpaper-workspace-primary-action" onClick={onCreateClient}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </header>

      <div className="xpaper-participants-filters" aria-label="Filtros da Consulta de Participantes">
        <div className="xpaper-filter-control xpaper-participant-search">
          <Label htmlFor="participants-search">Pesquisa</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
            <Input id="participants-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por Código, Participante, Razão Social, CNPJ ou Contato" className="pl-9" />
          </div>
        </div>
        <div className="xpaper-filter-control">
          <Label htmlFor="participants-type">Tipo</Label>
          <div className="relative">
            <select id="participants-type" value={type} onChange={(event) => updateFilter(setType, event.target.value as ParticipantType)}>
              <option value="Todos">Todos</option>
              <option value="Cliente">Cliente</option>
              <option value="Fornecedor">Fornecedor</option>
              <option value="Outro Participante">Outro Participante</option>
              <option value="Representante">Representante</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
          </div>
        </div>
        <div className="xpaper-filter-control">
          <Label htmlFor="participants-status">Status</Label>
          <div className="relative">
            <select id="participants-status" value={status} onChange={(event) => updateFilter(setStatus, event.target.value as ParticipantStatus)}>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
              <option value="Todos">Todos</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
          </div>
        </div>
        <Button type="button" className="xpaper-participants-filter-submit" onClick={() => { setCommittedSearch(search); setPage(1); void query.refetch(); }}>
          <Search className="h-4 w-4" />
          Consultar
        </Button>
      </div>

      {query.error ? <ConnectionNotice error={query.error} title="Consulta de Participantes Indisponível" /> : null}

      <div className="xpaper-participants-grid">
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <SortableHeader label="Código" column="codigo" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} className="xpaper-cell-code" />
                <SortableHeader label="Tipo" column="tipo" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Participante" column="fantasia" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Razão Social" column="razao_social" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="CNPJ / CPF" column="cnpj" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Contato" column="contato" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Cidade / UF" column="cidade" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Status" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? <LoadingRows columns={8} rows={8} /> : null}
              {!query.isLoading && sortedItems.map((participant) => (
                <tr key={participant.codigo} tabIndex={0} onClick={() => onOpenParticipant(participant)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpenParticipant(participant); }} className="xpaper-participant-row">
                  <td className="xpaper-cell-code">{participant.codigo}</td>
                  <td><span className="xpaper-type-tag">{participant.tipo}</span></td>
                  <td className="font-bold">{participant.fantasia || "—"}</td>
                  <td>{participant.razao_social || "—"}</td>
                  <td>{participant.cnpj || "—"}</td>
                  <td><span className="block">{participant.contato || "—"}</span><small>{participant.telefone || ""}</small></td>
                  <td>{participant.cidade ? `${participant.cidade}${participant.uf ? ` / ${participant.uf}` : ""}` : "—"}</td>
                  <td><StatusPill status={participant.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && !query.error && !sortedItems.length ? <div className="xpaper-participants-empty"><ContactRound className="h-7 w-7" /><strong>Nenhum Participante Encontrado</strong><p>Ajuste os Filtros ou Informe Outro Termo de Pesquisa.</p></div> : null}
        <TablePagination page={page} total={query.data?.total ?? 0} limit={20} onChange={setPage} />
      </div>
    </section>
  );
}

function ParticipantDetailTab({ participant }: { participant: ParticipantRow }) {
  const [section, setSection] = useState<"general" | "contacts" | "payments" | "notes">("general");
  const sectionContent = {
    general: <div className="xpaper-detail-grid"><DetailField label="Código" value={participant.codigo} /><DetailField label="Tipo" value={participant.tipo} /><DetailField label="Participante" value={participant.fantasia} /><DetailField label="Razão Social" value={participant.razao_social} /><DetailField label="CNPJ / CPF" value={participant.cnpj} /><DetailField label="Contato" value={participant.contato} /><DetailField label="Telefone" value={participant.telefone} /><DetailField label="Cidade / UF" value={participant.cidade ? `${participant.cidade}${participant.uf ? ` / ${participant.uf}` : ""}` : null} /><DetailField label="Status" value={participant.status} /></div>,
    contacts: <EmptyDetail icon={<ContactRound className="h-6 w-6" />} title="Contatos" description="A Aba Está Preparada para Receber os Contatos Vinculados a Este Participante pelo Código do Cadastro." />,
    payments: <EmptyDetail icon={<Landmark className="h-6 w-6" />} title="Condições de Pagamento" description="As Condições de Pagamento Serão Carregadas para Este Participante Quando o Cadastro Detalhado For Incluído." />,
    notes: <EmptyDetail icon={<ClipboardList className="h-6 w-6" />} title="Observações" description="As Observações Serão Vinculadas a Pessoa, Preservando o Código do Participante e o Módulo Geral do Legado." />,
  };

  return (
    <section className="xpaper-participant-detail" aria-labelledby={`participant-${participant.codigo}-title`}>
      <header className="xpaper-content-heading">
        <div>
          <p className="xpaper-eyebrow">Participantes / {participant.tipo}</p>
          <h1 id={`participant-${participant.codigo}-title`}>{participant.fantasia || participant.razao_social || participantTitle(participant)}</h1>
          <p>{participant.razao_social || "Registro de Participante"} <span aria-hidden="true">•</span> Código {participant.codigo}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => toast.message("Edição do Cadastro Será Incluída na Próxima Etapa.", { description: "A Aba Foi Preparada para Receber os Campos Específicos de Cada Tipo de Participante." })}>
          <FilePenLine className="h-4 w-4" />
          Editar Cadastro
        </Button>
      </header>
      <div className="xpaper-detail-section-tabs" role="tablist" aria-label="Detalhes do Participante">
        <button type="button" role="tab" aria-selected={section === "general"} onClick={() => setSection("general")}>Dados Gerais</button>
        <button type="button" role="tab" aria-selected={section === "contacts"} onClick={() => setSection("contacts")}>Contatos</button>
        <button type="button" role="tab" aria-selected={section === "payments"} onClick={() => setSection("payments")}>Condições de Pagamento</button>
        <button type="button" role="tab" aria-selected={section === "notes"} onClick={() => setSection("notes")}>Observações</button>
      </div>
      <div className="xpaper-detail-card">{sectionContent[section]}</div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null }) {
  return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>;
}

function EmptyDetail({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="xpaper-detail-empty">{icon}<strong>{title}</strong><p>{description}</p></div>;
}

function ClientRegistrationTab({ codigo, fallback, onClose }: { codigo: number; fallback: ParticipantRow; onClose: () => void }) {
  const [section, setSection] = useState<"general" | "address" | "commercial" | "fiscal" | "rules" | "contacts">("general");
  const query = trpc.participants.client.useQuery({ codigo });
  const client = query.data;

  if (query.isLoading) return <section className="xpaper-participant-detail"><div className="xpaper-detail-card"><div className="xpaper-detail-empty"><strong>Carregando Cadastro de Cliente...</strong><p>Consultando os Dados no Firebird Pela Integração LAN.</p></div></div></section>;
  if (query.error || !client) return <section className="xpaper-participant-detail"><ConnectionNotice error={query.error ?? new Error("Cliente Não Encontrado.")} title="Cadastro de Cliente Indisponível" /></section>;

  const content = {
    general: <div className="xpaper-detail-grid"><DetailField label="Código" value={client.codigo} /><DetailField label="Participante" value={client.fantasia} /><DetailField label="Razão Social" value={client.razaoSocial} /><DetailField label="CNPJ" value={client.cnpj} /><DetailField label="CPF" value={client.cpf} /><DetailField label="RG" value={client.rg} /><DetailField label="Inscrição Estadual" value={client.inscricaoEstadual} /><DetailField label="Inscrição Municipal" value={client.inscricaoMunicipal} /><DetailField label="Status" value={client.status} /></div>,
    address: <div className="xpaper-detail-grid"><DetailField label="CEP" value={client.cep} /><DetailField label="Endereço" value={client.endereco} /><DetailField label="Número" value={client.numero} /><DetailField label="Complemento" value={client.complemento} /><DetailField label="Bairro" value={client.bairro} /><DetailField label="Cidade" value={client.cidade} /><DetailField label="UF" value={client.uf} /><DetailField label="Código da Cidade" value={client.cidadeCodigo} /><DetailField label="Contato" value={client.contato} /><DetailField label="Telefone" value={client.telefone} /><DetailField label="Celular" value={client.celular} /><DetailField label="E-mail" value={client.email} /></div>,
    commercial: <div className="xpaper-detail-grid"><DetailField label="Grupo Econômico" value={client.grupoEconomicoDescricao} /><DetailField label="Código do Grupo" value={client.grupoEconomicoCodigo} /><DetailField label="Região" value={client.regiaoDescricao} /><DetailField label="Código da Região" value={client.regiaoCodigo} /><DetailField label="Ramo de Atividade" value={client.ramoAtividadeDescricao} /><DetailField label="Código do Ramo" value={client.ramoAtividadeCodigo} /><DetailField label="Representante" value={client.representanteFantasia} /><DetailField label="Código do Representante" value={client.representanteCodigo} /><DetailField label="Comissão" value={client.comissao} /><DetailField label="Tipo de Frete" value={client.tipoFrete} /></div>,
    fiscal: <div className="xpaper-detail-grid"><DetailField label="Tributação" value={client.tributacaoDescricao} /><DetailField label="Código da Tributação" value={client.tributacaoCodigo} /><DetailField label="Natureza Fiscal" value={client.naturezaFiscalDescricao} /><DetailField label="SUFRAMA" value={client.suframa} /><DetailField label="Consumidor Final" value={client.consumidorFinal} /><DetailField label="Exige Laudo Técnico" value={client.exigirLaudoTecnico} /><DetailField label="Unidade de Medida" value={client.unidadeMedidaDescricao} /><DetailField label="Código da Unidade" value={client.unidadeMedida} /></div>,
    rules: <div className="xpaper-detail-grid"><DetailField label="Inspecionar Produto" value={client.inspecionarProduto} /><DetailField label="Amostragem" value={client.amostragem} /><DetailField label="Controlar Lote" value={client.controlarLote} /></div>,
    contacts: <EmptyDetail icon={<ContactRound className="h-6 w-6" />} title="Contatos do Cliente" description="A Estrutura de Contatos do Legado Está Mapeada. A Gravação de Contatos Será Liberada Após Validarmos as Regras da Tabela CONTATO_PESSOAS na LAN." />,
  };

  return <section className="xpaper-participant-detail" aria-labelledby={`client-${codigo}-title`}>
    <header className="xpaper-content-heading"><div><p className="xpaper-eyebrow">Cadastros / Clientes</p><h1 id={`client-${codigo}-title`}>Cliente {codigo} — {client.fantasia || client.razaoSocial || fallback.fantasia || "Sem Identificação"}</h1><p>{client.razaoSocial || fallback.razao_social || "Cadastro de Cliente"} <span aria-hidden="true">•</span> Consulta Integrada ao Firebird LAN</p></div><Button type="button" variant="outline" disabled title="A Edição Será Habilitada Após a Validação da Gravação no Firebird."><FilePenLine className="h-4 w-4" />Editar Cliente</Button></header>
    <div className="xpaper-detail-section-tabs" role="tablist" aria-label="Cadastro de Cliente"><button type="button" role="tab" aria-selected={section === "general"} onClick={() => setSection("general")}>Dados Gerais</button><button type="button" role="tab" aria-selected={section === "address"} onClick={() => setSection("address")}>Endereços</button><button type="button" role="tab" aria-selected={section === "commercial"} onClick={() => setSection("commercial")}>Comercial</button><button type="button" role="tab" aria-selected={section === "fiscal"} onClick={() => setSection("fiscal")}>Fiscal</button><button type="button" role="tab" aria-selected={section === "rules"} onClick={() => setSection("rules")}>Regras de Produção</button><button type="button" role="tab" aria-selected={section === "contacts"} onClick={() => setSection("contacts")}>Contatos</button></div>
    <div className="xpaper-detail-card">{content[section]}</div>
    <div className="xpaper-client-form-actions"><Button type="button" variant="destructive" onClick={onClose}>Fechar</Button></div>
  </section>;
}

type ClientDraft = {
  fantasia: string; razaoSocial: string; cnpj: string; cpf: string; rg: string; inscricaoEstadual: string; inscricaoMunicipal: string; cep: string; endereco: string; numero: string; complemento: string; bairro: string; cidadeCodigo: string; contato: string; telefone: string; celular: string; email: string; grupoEconomicoCodigo: string; regiaoCodigo: string; ramoAtividadeCodigo: string; representanteCodigo: string; comissao: string; tributacaoCodigo: string; variacaoProducaoMais: string; variacaoProducaoMenos: string; tipoFrete: string; suframa: string; consumidorFinal: "S" | "N"; exigeLaudoTecnico: "S" | "N"; unidadeMedida: string; inspecionarProduto: "S" | "N"; amostragem: "S" | "N"; controlarLote: "S" | "N"; tipoDocumentoCodigo: string; tipoOperacaoCodigo: string; status: "Ativo" | "Inativo";
};

const EMPTY_CLIENT_DRAFT: ClientDraft = { fantasia: "", razaoSocial: "", cnpj: "", cpf: "", rg: "", inscricaoEstadual: "", inscricaoMunicipal: "", cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidadeCodigo: "", contato: "", telefone: "", celular: "", email: "", grupoEconomicoCodigo: "", regiaoCodigo: "", ramoAtividadeCodigo: "", representanteCodigo: "", comissao: "", tributacaoCodigo: "", variacaoProducaoMais: "", variacaoProducaoMenos: "", tipoFrete: "", suframa: "", consumidorFinal: "N", exigeLaudoTecnico: "N", unidadeMedida: "", inspecionarProduto: "N", amostragem: "N", controlarLote: "N", tipoDocumentoCodigo: "", tipoOperacaoCodigo: "", status: "Ativo" };

function FormField({ label, required = false, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={`xpaper-client-form-field ${className}`}><Label>{label}{required ? <span aria-hidden="true"> *</span> : null}</Label>{children}</div>;
}

function ClientCreateTab({ onCreated, onClose }: { onCreated: (codigo: number, draft: ClientDraft) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_CLIENT_DRAFT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [area, setArea] = useState<"general" | "complementary" | "contacts" | "financial">("general");
  const mutation = trpc.participants.createClient.useMutation({ onSuccess: (result) => { toast.success(`Cliente ${result.codigo} Incluído com Sucesso.`); setConfirmOpen(false); onCreated(result.codigo, draft); }, onError: (error) => toast.error("Não Foi Possível Incluir o Cliente.", { description: error.message }) });
  const update = (field: keyof ClientDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const requestConfirmation = () => { if (draft.fantasia.trim().length < 2) return toast.error("Informe o Nome do Cliente."); if (draft.razaoSocial.trim().length < 2) return toast.error("Informe a Razão Social."); setConfirmOpen(true); };
  const save = () => {
    const integer = (value: string) => value.trim() ? Number(value) : null;
    const decimal = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
    mutation.mutate({ ...draft, cidadeCodigo: integer(draft.cidadeCodigo), grupoEconomicoCodigo: integer(draft.grupoEconomicoCodigo), regiaoCodigo: integer(draft.regiaoCodigo), ramoAtividadeCodigo: integer(draft.ramoAtividadeCodigo), representanteCodigo: integer(draft.representanteCodigo), comissao: decimal(draft.comissao), tributacaoCodigo: integer(draft.tributacaoCodigo), variacaoProducaoMais: decimal(draft.variacaoProducaoMais), variacaoProducaoMenos: decimal(draft.variacaoProducaoMenos), tipoFrete: integer(draft.tipoFrete), tipoDocumentoCodigo: integer(draft.tipoDocumentoCodigo), tipoOperacaoCodigo: integer(draft.tipoOperacaoCodigo) });
  };
  const general = <div className="xpaper-client-form-section"><h2>Dados do Cliente</h2><div className="xpaper-client-form-grid"><FormField label="Nome do Cliente" required><Input value={draft.fantasia} maxLength={30} onChange={(event) => update("fantasia", event.target.value)} placeholder="Nome ou Fantasia" /></FormField><FormField label="Razão Social" required className="xpaper-client-form-span-2"><Input value={draft.razaoSocial} maxLength={180} onChange={(event) => update("razaoSocial", event.target.value)} placeholder="Razão Social Completa" /></FormField><FormField label="Status"><select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select></FormField><FormField label="CNPJ"><Input value={draft.cnpj} maxLength={30} onChange={(event) => update("cnpj", event.target.value)} /></FormField><FormField label="CPF"><Input value={draft.cpf} maxLength={20} onChange={(event) => update("cpf", event.target.value)} /></FormField><FormField label="RG"><Input value={draft.rg} maxLength={30} onChange={(event) => update("rg", event.target.value)} /></FormField><FormField label="Inscrição Estadual"><Input value={draft.inscricaoEstadual} maxLength={30} onChange={(event) => update("inscricaoEstadual", event.target.value)} /></FormField><FormField label="Inscrição Municipal"><Input value={draft.inscricaoMunicipal} maxLength={30} onChange={(event) => update("inscricaoMunicipal", event.target.value)} /></FormField><FormField label="Contato"><Input value={draft.contato} maxLength={120} onChange={(event) => update("contato", event.target.value)} /></FormField><FormField label="Telefone"><Input value={draft.telefone} maxLength={30} onChange={(event) => update("telefone", event.target.value)} /></FormField><FormField label="Celular"><Input value={draft.celular} maxLength={30} onChange={(event) => update("celular", event.target.value)} /></FormField><FormField label="E-mail" className="xpaper-client-form-span-2"><Input type="email" value={draft.email} maxLength={180} onChange={(event) => update("email", event.target.value)} /></FormField></div></div>;
  const complementary = <><div className="xpaper-client-form-section"><h2>Endereço Principal</h2><div className="xpaper-client-form-grid"><FormField label="CEP"><Input value={draft.cep} maxLength={12} onChange={(event) => update("cep", event.target.value)} /></FormField><FormField label="Código da Cidade"><Input inputMode="numeric" value={draft.cidadeCodigo} onChange={(event) => update("cidadeCodigo", event.target.value.replace(/\D/g, ""))} /></FormField><FormField label="Endereço" className="xpaper-client-form-span-2"><Input value={draft.endereco} maxLength={180} onChange={(event) => update("endereco", event.target.value)} /></FormField><FormField label="Número"><Input value={draft.numero} maxLength={20} onChange={(event) => update("numero", event.target.value)} /></FormField><FormField label="Complemento"><Input value={draft.complemento} maxLength={100} onChange={(event) => update("complemento", event.target.value)} /></FormField><FormField label="Bairro"><Input value={draft.bairro} maxLength={100} onChange={(event) => update("bairro", event.target.value)} /></FormField></div></div><div className="xpaper-client-form-section"><div className="xpaper-client-section-heading"><h2>Endereços de Cobrança/Entrega</h2><Button type="button" variant="outline" disabled title="Inclua Primeiro o Cliente para Cadastrar Endereços Vinculados."><Plus className="h-4 w-4" />Inserir</Button></div><div className="xpaper-client-child-empty">Os Endereços Adicionais Serão Vinculados ao PES_CODIGO Após a Gravação do Cliente.</div></div></>;
  const contacts = <div className="xpaper-client-form-section"><div className="xpaper-client-section-heading"><h2>Contatos</h2><Button type="button" variant="outline" disabled title="Inclua Primeiro o Cliente para Cadastrar Contatos Vinculados."><Plus className="h-4 w-4" />Inserir</Button></div><div className="xpaper-client-child-empty">Os Contatos Serão Vinculados ao PES_CODIGO Após a Gravação do Cliente.</div></div>;
  const financial = <div className="xpaper-client-form-section"><h2>Informações Financeiras</h2><div className="xpaper-client-form-grid"><FormField label="Tipo de Documento"><Input inputMode="numeric" value={draft.tipoDocumentoCodigo} onChange={(event) => update("tipoDocumentoCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Tipo de Operação"><Input inputMode="numeric" value={draft.tipoOperacaoCodigo} onChange={(event) => update("tipoOperacaoCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField></div><div className="xpaper-client-child-empty">As Condições de Pagamento Serão Vinculadas ao PES_CODIGO Após a Gravação do Cliente.</div></div>;
  return <section className="xpaper-participant-detail xpaper-client-create" aria-labelledby="new-client-title">
    <header className="xpaper-content-heading"><div><p className="xpaper-eyebrow">Cadastros / Clientes</p><h1 id="new-client-title">Novo Cliente</h1><p>O Código <strong>PES_CODIGO</strong> Será Gerado Automaticamente Pela Sequência Compartilhada da Tabela PESSOA.</p></div></header>
    <div className="xpaper-detail-section-tabs" role="tablist" aria-label="Cadastro de Cliente"><button type="button" role="tab" aria-selected={area === "general"} onClick={() => setArea("general")}>Informações Gerais</button><button type="button" role="tab" aria-selected={area === "complementary"} onClick={() => setArea("complementary")}>Informações Complementares</button><button type="button" role="tab" aria-selected={area === "contacts"} onClick={() => setArea("contacts")}>Contatos</button><button type="button" role="tab" aria-selected={area === "financial"} onClick={() => setArea("financial")}>Informações Financeiras</button></div>
    {area === "general" ? <>{general}<div className="xpaper-client-form-section"><h2>Classificação Comercial</h2><div className="xpaper-client-form-grid"><FormField label="Grupo Econômico"><Input inputMode="numeric" value={draft.grupoEconomicoCodigo} onChange={(event) => update("grupoEconomicoCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Região"><Input inputMode="numeric" value={draft.regiaoCodigo} onChange={(event) => update("regiaoCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Ramo de Atividade"><Input inputMode="numeric" value={draft.ramoAtividadeCodigo} onChange={(event) => update("ramoAtividadeCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Representante"><Input inputMode="numeric" value={draft.representanteCodigo} onChange={(event) => update("representanteCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Comissão"><Input inputMode="decimal" value={draft.comissao} onChange={(event) => update("comissao", event.target.value)} placeholder="0,00" /></FormField><FormField label="Data de Cadastro"><Input value="Gerada Automaticamente" disabled /></FormField></div></div></> : null}
    {area === "complementary" ? <><div className="xpaper-client-form-section"><h2>Regras Fiscais e de Produção</h2><div className="xpaper-client-form-grid"><FormField label="Estrutura Tributária"><Input inputMode="numeric" value={draft.tributacaoCodigo} onChange={(event) => update("tributacaoCodigo", event.target.value.replace(/\D/g, ""))} placeholder="Código" /></FormField><FormField label="Tipo de Frete"><select value={draft.tipoFrete} onChange={(event) => update("tipoFrete", event.target.value)}><option value="">Selecione</option><option value="0">0 — Frete por Conta do Remetente (CIF)</option><option value="1">1 — Frete por Conta do Destinatário (FOB)</option><option value="2">2 — Frete por Conta de Terceiros</option><option value="3">3 — Transporte Próprio do Remetente</option><option value="4">4 — Transporte Próprio do Destinatário</option><option value="9">9 — Sem Ocorrência de Transporte</option></select></FormField><FormField label="Variação do Pedido + %"><Input inputMode="decimal" value={draft.variacaoProducaoMais} onChange={(event) => update("variacaoProducaoMais", event.target.value)} /></FormField><FormField label="Variação do Pedido - %"><Input inputMode="decimal" value={draft.variacaoProducaoMenos} onChange={(event) => update("variacaoProducaoMenos", event.target.value)} /></FormField><FormField label="Código SUFRAMA"><Input value={draft.suframa} onChange={(event) => update("suframa", event.target.value)} /></FormField><FormField label="Unidade de Medida"><Input value={draft.unidadeMedida} onChange={(event) => update("unidadeMedida", event.target.value)} placeholder="U.M." /></FormField><FormField label="Consumidor Final"><select value={draft.consumidorFinal} onChange={(event) => update("consumidorFinal", event.target.value as "S" | "N")}><option value="N">Não</option><option value="S">Sim</option></select></FormField><FormField label="Exige Certificado de Qualidade"><select value={draft.exigeLaudoTecnico} onChange={(event) => update("exigeLaudoTecnico", event.target.value as "S" | "N")}><option value="N">Não</option><option value="S">Sim</option></select></FormField><FormField label="Inspeção Final para Liberação"><select value={draft.inspecionarProduto} onChange={(event) => update("inspecionarProduto", event.target.value as "S" | "N")}><option value="N">Não</option><option value="S">Sim</option></select></FormField><FormField label="Lote de Amostragem"><select value={draft.amostragem} onChange={(event) => update("amostragem", event.target.value as "S" | "N")}><option value="N">Não</option><option value="S">Sim</option></select></FormField><FormField label="Controlar Lote"><select value={draft.controlarLote} onChange={(event) => update("controlarLote", event.target.value as "S" | "N")}><option value="N">Não</option><option value="S">Sim</option></select></FormField></div></div>{complementary}</> : null}
    {area === "contacts" ? contacts : null}{area === "financial" ? financial : null}
    <div className="xpaper-client-form-actions"><Button type="button" variant="destructive" onClick={onClose} disabled={mutation.isPending}>Fechar</Button><Button type="button" onClick={requestConfirmation} disabled={mutation.isPending} className="xpaper-workspace-primary-action"><Plus className="h-4 w-4" />{mutation.isPending ? "Gravando Cliente..." : "Gravar"}</Button></div>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Inclusão de Cliente</AlertDialogTitle><AlertDialogDescription>Será Criado um Novo Registro de Cliente na Tabela PESSOA com um PES_CODIGO Gerado Pela Sequência Central.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={save} disabled={mutation.isPending}>Confirmar Inclusão</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

function ClientModal({ state, onClose, onCreated }: { state: ClientDialogState | null; onClose: () => void; onCreated: (codigo: number, draft: ClientDraft) => void }) {
  if (!state) return null;
  const title = state.mode === "create" ? "Cadastro de Cliente" : `Cadastro de Cliente — ${state.participant.codigo}`;
  return <Dialog open={Boolean(state)}>
    <DialogContent className="xpaper-client-modal max-w-[min(1180px,calc(100%-1rem))]" onPointerDownOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
      <DialogHeader className="xpaper-client-modal-heading"><DialogTitle>{title}</DialogTitle><DialogDescription>Cadastro Integrado ao Firebird Pela Rede LAN.</DialogDescription></DialogHeader>
      <div className="xpaper-client-modal-content">{state.mode === "create" ? <ClientCreateTab onCreated={onCreated} onClose={onClose} /> : <ClientRegistrationTab codigo={state.participant.codigo} fallback={state.participant} onClose={onClose} />}</div>
    </DialogContent>
  </Dialog>;
}

function FormTab({ formId }: { formId: string }) {
  const blueprint = FORM_BLUEPRINTS[formId] ?? { title: "Cadastro", description: "Aba Preparada para a Próxima Etapa do XPAPER.", sections: ["Dados Gerais"] };
  return (
    <section className="xpaper-participant-detail" aria-labelledby={`form-${formId}-title`}>
      <header className="xpaper-content-heading"><div><p className="xpaper-eyebrow">Cadastros / Formulário</p><h1 id={`form-${formId}-title`}>{blueprint.title}</h1><p>{blueprint.description}</p></div></header>
      <div className="xpaper-detail-card"><div className="xpaper-form-blueprint">{blueprint.sections.map((section, index) => <div key={section}><span>{String(index + 1).padStart(2, "0")}</span><strong>{section}</strong><p>Seção Preparada para o Formulário Interno desta Aba.</p></div>)}</div></div>
    </section>
  );
}

export function XPaperWorkspace({ onOpenProduction }: { onOpenProduction: () => void }) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: "inicio", kind: "home", title: "Início", closable: false },
    { id: "participantes", kind: "participants", title: "Participantes", closable: true },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("participantes");
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>("cadastros");
  const [clientDialog, setClientDialog] = useState<ClientDialogState | null>(null);

  const openParticipants = () => {
    setTabs((current) => current.some((tab) => tab.id === "participantes") ? current : [...current, { id: "participantes", kind: "participants", title: "Participantes", closable: true }]);
    setActiveTabId("participantes");
  };
  const openNewClient = () => {
    setClientDialog({ mode: "create" });
  };
  const openParticipant = (participant: ParticipantRow) => {
    if (participant.tipo === "Cliente") return openClient(participant);
    const id = `participante:${participant.codigo}` as const;
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, { id, kind: "participant", title: participantTitle(participant), participant, closable: true }]);
    setActiveTabId(id);
  };
  const openClient = (participant: ParticipantRow) => {
    setClientDialog({ mode: "view", participant });
  };
  const openCreatedClient = (codigo: number, draft: ClientDraft) => setClientDialog({ mode: "view", participant: { codigo, tipo: "Cliente", fantasia: draft.fantasia, razao_social: draft.razaoSocial, cnpj: draft.cnpj || null, contato: draft.contato || null, telefone: draft.telefone || null, cidade: null, uf: null, status: draft.status } });
  const openForm = (formId: string, title: string) => {
    if (formId === "participantes") return openParticipants();
    if (formId === "clientes") return openNewClient();
    const id = `form:${formId}` as const;
    setTabs((current) => current.some((tab) => tab.id === id) ? current : [...current, { id, kind: "form", title, formId, closable: true }]);
    setActiveTabId(id);
  };
  const closeTab = (id: string) => {
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) setActiveTabId(next[Math.max(0, index - 1)]?.id ?? "inicio");
      return next;
    });
  };
  const openModule = (moduleId: ModuleId) => { if (moduleId === "producao") return onOpenProduction(); setActiveModuleId(moduleId); };
  const openSidebarItem = (id: string, label: string) => openForm(id, label);

  return (
    <section className="xpaper-workspace" aria-label="Área de Trabalho do XPAPER">
      <aside className="xpaper-sidebar" aria-label="Sidebar do XPAPER">
        <div className="xpaper-sidebar-title"><LayoutGrid className="h-4 w-4" /><span>Área de Trabalho</span></div>
        <div className="xpaper-sidebar-section xpaper-sidebar-modules"><p>Módulos</p>{MODULES.map((module) => { const Icon = module.icon; return <button key={module.id} type="button" className={activeModuleId === module.id ? "active" : ""} onClick={() => openModule(module.id)}><Icon className="h-4 w-4" /><span>{module.label}</span>{module.id === "cadastros" ? <ChevronRight className="ml-auto h-3.5 w-3.5" /> : null}</button>; })}</div>
        {activeModuleId === "cadastros" ? SIDEBAR_SECTIONS.map((section) => (
          <div className="xpaper-sidebar-section" key={section.label}>
            <p>{section.label}</p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = (item.id === "participantes" && activeTabId === "participantes") || activeTabId === `form:${item.id}`;
              return <button key={item.id} type="button" className={active ? "active" : ""} onClick={() => openSidebarItem(item.id, item.label)}><Icon className="h-4 w-4" /><span>{item.label}</span>{item.id === "participantes" ? <ChevronRight className="ml-auto h-3.5 w-3.5" /> : null}</button>;
            })}
          </div>
        )) : <div className="xpaper-sidebar-section"><p>{MODULES.find((module) => module.id === activeModuleId)?.label}</p><span className="xpaper-sidebar-module-note">Selecione uma Tela ou Cadastro Quando Este Módulo For Implantado.</span></div>}
      </aside>
      <div className="xpaper-tab-stage">
        <div className="xpaper-workspace-tabs" role="tablist" aria-label="Abas Internas">
          {tabs.map((tab) => <div key={tab.id} className={activeTabId === tab.id ? "xpaper-workspace-tab active" : "xpaper-workspace-tab"}>
            <button type="button" role="tab" aria-selected={activeTabId === tab.id} onClick={() => setActiveTabId(tab.id)}>{tab.title}</button>
            {tab.closable ? <button type="button" aria-label={`Fechar Aba ${tab.title}`} onClick={() => closeTab(tab.id)}><X className="h-3.5 w-3.5" /></button> : null}
          </div>)}
        </div>
        <div className="xpaper-tab-content">
          {tabs.map((tab) => <div key={tab.id} hidden={activeTabId !== tab.id} className="h-full">
            {tab.kind === "home" ? <WorkspaceHome onOpenParticipants={openParticipants} /> : null}
            {tab.kind === "participants" ? <ParticipantsTab onOpenParticipant={openParticipant} onCreateClient={openNewClient} /> : null}
            {tab.kind === "form" ? <FormTab formId={tab.formId} /> : null}
            {tab.kind === "participant" ? <ParticipantDetailTab participant={tab.participant} /> : null}
          </div>)}
        </div>
      </div>
      <ClientModal state={clientDialog} onClose={() => setClientDialog(null)} onCreated={openCreatedClient} />
    </section>
  );
}
