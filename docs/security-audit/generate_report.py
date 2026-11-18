#!/usr/bin/env python3
"""
Script gerador de relatório de auditoria de segurança
ProducaoWeb - Auditoria Completa de Segurança
"""

import os
import sys
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, ListFlowable, ListItem
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib import colors
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import io

# Configuração de cores por severidade
SEVERITY_COLORS = {
    'Crítica': HexColor('#B91C1C'),
    'Alta': HexColor('#EA580C'),
    'Média': HexColor('#D97706'),
    'Baixa': HexColor('#2563EB'),
    'Informativa': HexColor('#6B7280'),
    'Ponto Forte': HexColor('#059669')
}

SEVERITY_ORDER = ['Crítica', 'Alta', 'Média', 'Baixa', 'Informativa']

# Dados dos achados
FINDINGS = [
    {
        'category': 'CHAVES EXPOSTAS',
        'name': 'Segredos Hardcoded no Arquivo de Configuração do Projeto',
        'file': '.project-config.json',
        'line': '24-41',
        'code': 'secrets: {\n  "BUILT_IN_FORGE_API_KEY": "MtgjkV5FtDtUD4tfaCduZd",\n  "BUILT_IN_FORGE_API_URL": "https://forge.manus.ai",\n  "FIREBIRD_PROXY_TOKEN": "bikraft159753",\n  "FIREBIRD_PROXY_URL": "http://producao.bikraft.local",\n  "JWT_SECRET": "EGgZMMBX52nuMLDkiUE6ce",\n  "OAUTH_SERVER_URL": "https://api.manus.im",\n  "OWNER_OPEN_ID": "fmSSfapuVASX32eUY3tA9Q",\n  ...\n}',
        'description': 'O arquivo .project-config.json contém 17 segredos hardcoded incluindo chaves de API, tokens de autenticação, segredo JWT e URLs de serviços internos. Este arquivo está versionado no repositório Git.',
        'exploitability': 'Qualquer pessoa com acesso ao repositório Git (público ou interno) pode extrair estas credenciais e acessar serviços externos (Forge API, Firebird Proxy, OAuth Server). O JWT_SECRET permite forjar tokens de sessão válidos.',
        'conditions': 'Acesso de leitura ao repositório Git. Nenhuma condição adicional necessária.',
        'impact': 'Comprometimento total da autenticação (forja de tokens JWT), acesso ao Firebird Proxy (banco de dados de produção), acesso à API Forge (infraestrutura Manus), vazamento de identidade do proprietário (OWNER_OPEN_ID).',
        'severity': 'Crítica'
    },
    {
        'category': 'CHAVES EXPOSTAS',
        'name': 'Credencial Padrão do Firebird em Arquivo .env',
        'file': '.env',
        'line': '9',
        'code': 'FIREBIRD_PASSWORD="masterkey"',
        'description': 'O arquivo .env contém a senha padrão "masterkey" do usuário SYSDBA do Firebird, que é a senha padrão conhecida publicamente.',
        'exploitability': 'Se o Firebird estiver exposto na rede (porta 3050), qualquer atacante pode conectar-se com usuário SYSDBA e senha "masterkey" e ter acesso total ao banco de dados.',
        'conditions': 'Firebird acessível na rede (porta 3050 aberta). Arquivo .env exposto ou commitado no repositório.',
        'impact': 'Acesso total ao banco de dados Firebird (leitura/escrita/exclusão de todos os dados de produção, pedidos, estoque, usuários). Possível elevação de privilégios no sistema.',
        'severity': 'Crítica'
    },
    {
        'category': 'CHAVES EXPOSTAS',
        'name': 'Token de Proxy Firebird Fraco/Placeholder',
        'file': '.env',
        'line': '3',
        'code': 'FIREBIRD_PROXY_TOKEN="crie-um-token-longo"',
        'description': 'O arquivo .env contém um token placeholder "crie-um-token-longo" em vez de um segredo criptograficamente seguro.',
        'exploitability': 'Se o proxy Firebird estiver exposto, qualquer pessoa pode adivinhar ou brute-forçar este token e acessar o proxy, que por sua vez acessa o banco Firebird.',
        'conditions': 'Proxy Firebird acessível na rede. Token não alterado para valor seguro.',
        'impact': 'Bypass da autenticação do proxy Firebird, levando a acesso indireto ao banco de dados.',
        'severity': 'Alta'
    },
    {
        'category': 'PERMISSÃO DEFINIDA NO NAVEGADOR',
        'name': 'Ausência de Middleware de Autorização Centralizado',
        'file': 'server/_core/trpc.ts',
        'line': '10-16',
        'code': 'export const adminProcedure = t.procedure;\nexport const localProtectedProcedure = t.procedure;\nexport const operatorProcedure = t.procedure;\nexport const programmerProcedure = t.procedure;\n// Custom procedures with role-based access control\n// These are aliases for publicProcedure - the role checks are done in the procedure implementation',
        'description': 'Os procedimentos tRPC para diferentes roles (admin, operator, programmer) são apenas aliases de publicProcedure sem validação de middleware. O comentário indica que "role checks are done in the procedure implementation", mas isso cria dependência de implementação manual em cada rota.',
        'exploitability': 'Um desenvolvedor pode esquecer de adicionar a validação de permissão em uma nova rota, deixando-a exposta. Rotas administrativas como notifyOwner usam adminProcedure que não valida nada.',
        'conditions': 'Nova rota criada sem validação manual. Ou rota existente modificada removendo validação acidentalmente.',
        'impact': 'Escalonamento de privilégios: usuários comuns podem acessar funcionalidades de administrador, programador ou operador. Vazamento de dados sensíveis entre máquinas/operadores.',
        'severity': 'Alta'
    },
    {
        'category': 'PERMISSÃO DEFINIDA NO NAVEGADOR',
        'name': 'Endpoint Administrativo sem Validação de Role',
        'file': 'server/_core/systemRouter.ts',
        'line': '16-28',
        'code': 'notifyOwner: adminProcedure\n  .input(z.object({...}))\n  .mutation(async ({ input }) => {\n    const delivered = await notifyOwner(input);\n    return { success: delivered };\n  }),',
        'description': 'O endpoint system.notifyOwner usa adminProcedure, que não implementa nenhuma validação de role de administrador. Qualquer usuário autenticado pode chamar este endpoint.',
        'exploitability': 'Qualquer usuário com sessão válida (localProtectedProcedure) pode enviar notificações para o proprietário do projeto via API Forge.',
        'conditions': 'Usuário autenticado no sistema. Conhecimento do endpoint tRPC.',
        'impact': 'Spam de notificações para o proprietário, potencial DoS no serviço de notificação externo, vazamento de que o endpoint existe.',
        'severity': 'Média'
    },
    {
        'category': 'BANCO SEM TRANCA',
        'name': 'Falta de Isolamento de Dados por Máquina/Tenant em Consultas Gerais',
        'file': 'server/routers/production.ts',
        'line': '77-79, 274-279',
        'code': 'dashboard: localProtectedProcedure.query(() => getProductionDashboard()),\n...\nproducts: router({\n  list: localProtectedProcedure.input(pageInput).query(({ input }) => getProducts(input.page, input.limit, input.search)),\n}),\nstock: router({\n  list: localProtectedProcedure.input(pageInput).query(({ input }) => getStock(input.page, input.limit, input.search)),\n  ...\n})',
        'description': 'Endpoints de listagem geral (dashboard, produtos, estoque, pedidos) não filtram dados por machineCode ou companyCode do usuário autenticado. Retornam dados globais para qualquer usuário autenticado.',
        'exploitability': 'Qualquer operador autenticado pode visualizar todos os produtos, estoque, pedidos e dashboard de toda a fábrica, não apenas os da sua máquina.',
        'conditions': 'Usuário autenticado com perfil "operator" ou superior. Acesso às rotas de listagem.',
        'impact': 'Vazamento de informação sensível de produção: volumes de pedidos, estoque total, programação de outras máquinas, dados de clientes/fornecedores. Violação de princípio de menor privilégio.',
        'severity': 'Média'
    },
    {
        'category': 'BANCO SEM TRANCA',
        'name': 'Consulta de Clientes/Participantes sem Filtro de Empresa',
        'file': 'server/routers/participants.ts',
        'line': '37-55',
        'code': 'list: consultationProcedure\n  .input(z.object({...}))\n  .query(({ input }) =>\n    getParticipants(\n      input.page, input.limit, input.search, input.type, input.status\n    )\n  )',
        'description': 'O endpoint participants.list retorna todos os participantes (clientes, fornecedores) sem filtrar por companyCode do usuário. O consultationProcedure valida apenas se o usuário tem perfil programmer ou canConfigureStation.',
        'exploitability': 'Usuários com perfil programmer ou canConfigureStation=true podem listar todos os clientes/fornecedores de todas as empresas.',
        'conditions': 'Usuário com perfil programmer ou canConfigureStation=true.',
        'impact': 'Vazamento de base de clientes/fornecedores completa, incluindo CNPJ, contatos, endereços, condições comerciais.',
        'severity': 'Média'
    },
    {
        'category': 'IDOR',
        'name': 'Endpoint de Detalhe de Cliente por ID sem Validação de Propriedade',
        'file': 'server/firebirdProxy.ts',
        'line': '475',
        'code': 'export const getClient = (codigo: number) => request<ClientRecord>(`/v1/clients/${codigo}`);',
        'file2': 'server/routers/participants.ts',
        'line2': '56-58',
        'code2': 'client: consultationProcedure\n  .input(z.object({ codigo: z.number().int().positive() }))\n  .query(({ input }) => getClient(input.codigo))',
        'description': 'O endpoint participants.client permite buscar qualquer cliente pelo código numérico (codigo) sem verificar se o cliente pertence à empresa do usuário autenticado.',
        'exploitability': 'Usuário com acesso ao consultationProcedure pode enumerar IDs de clientes (1, 2, 3...) e obter dados completos (CNPJ, endereço, contato, condições comerciais) de clientes de outras empresas.',
        'conditions': 'Usuário com perfil programmer ou canConfigureStation=true. Conhecimento ou enumeração de códigos de cliente.',
        'impact': 'Vazamento de dados sensíveis de clientes (PII, dados fiscais, condições comerciais) entre empresas/tenants.',
        'severity': 'Média'
    },
    {
        'category': 'IDOR',
        'name': 'Atualização de Status de Pedido sem Validação de Propriedade da Máquina',
        'file': 'server/routers/production.ts',
        'line': '80-85',
        'code': 'updateStatus: programmerProcedure\n  .input(processInput.extend({\n    fila: z.number().int().positive().optional(),\n    status: z.enum([...]),\n  }))\n  .mutation(({ input }) => updateOrderStatus(input)),',
        'file2': 'server/firebirdProxy.ts',
        'line2': '457-462',
        'code2': 'export const updateOrderStatus = (input: { opCodigo: number; mpCodigo: number; status: string; fila?: number }) =>\n  request<{ success: true }>(`/v1/orders/${input.opCodigo}/${input.mpCodigo}/status`, {\n    method: "PATCH",\n    headers: { "content-type": "application/json" },\n    body: JSON.stringify(input),\n  });',
        'description': 'O endpoint orders.updateStatus permite alterar o status de qualquer pedido (opCodigo/mpCodigo) sem verificar se o pedido pertence a uma máquina controlada pelo usuário programador.',
        'exploitability': 'Um programador pode alterar status de pedidos de máquinas que não controla, desde que conheça opCodigo/mpCodigo.',
        'conditions': 'Usuário com perfil programmer. Conhecimento de opCodigo/mpCodigo de outras máquinas.',
        'impact': 'Manipulação indevida de status de produção de outras máquinas/equipes. Inconsistência de dados, relatórios incorretos.',
        'severity': 'Média'
    },
    {
        'category': 'CHAVES EXPOSTAS',
        'name': 'Validação de Startup Ausente para Credenciais Padrão/Inseguras',
        'file': 'server/firebirdProxy.ts',
        'line': '406-422',
        'code': 'export function getFirebirdProxyConfiguration(env: ProxyEnvironment = process.env as ProxyEnvironment) {\n  const rawUrl = env.FIREBIRD_PROXY_URL?.trim();\n  const token = env.FIREBIRD_PROXY_TOKEN?.trim();\n  if (!rawUrl) throw new Error("FIREBIRD_PROXY_URL não foi configurada.");\n  if (!token) throw new Error("FIREBIRD_PROXY_TOKEN não foi configurada.");\n  // ...\n}',
        'description': 'A aplicação valida apenas se as variáveis de ambiente existem, mas não valida se são seguras (ex: token != "crie-um-token-longo", password != "masterkey"). Permite inicialização com credenciais padrão/inseguras.',
        'exploitability': 'Deploy em produção com valores padrão do .env.example ou valores fracos. A aplicação inicia normalmente sem alertar sobre insegurança.',
        'conditions': 'Variáveis de ambiente com valores padrão/fracos. Deploy sem revisão de segurança.',
        'impact': 'Sistema roda em produção com credenciais conhecidas/publicamente expostas, facilitando ataques.',
        'severity': 'Alta'
    },
    {
        'category': 'CHAVES EXPOSTAS',
        'name': 'Chaves de API Frontend Expostas no Bundle',
        'file': '.project-config.json',
        'line': '33-40',
        'code': '"VITE_ANALYTICS_ENDPOINT": "https://manus-analytics.com",\n"VITE_ANALYTICS_WEBSITE_ID": "70809dbb-02a4-4add-a834-c9ff7de511a0",\n"VITE_APP_ID": "fUPJURoGTogtcLoydf5tmh",\n"VITE_FRONTEND_FORGE_API_KEY": "Qmm6bcczKbQKod5ubfLCZj",\n"VITE_FRONTEND_FORGE_API_URL": "https://forge.manus.ai",\n"VITE_OAUTH_PORTAL_URL": "https://manus.im"',
        'description': 'Variáveis com prefixo VITE_ são embutidas no bundle do frontend (Vite) e expostas no navegador do usuário. A VITE_FRONTEND_FORGE_API_KEY é uma chave de API exposta publicamente.',
        'exploitability': 'Qualquer usuário que acesse a aplicação pode inspecionar o bundle JavaScript e extrair estas chaves.',
        'conditions': 'Acesso à aplicação web (pública ou autenticada). Inspeção de rede ou bundle JS.',
        'impact': 'Uso indevido da API Forge no frontend, vazamento de ID da aplicação, endpoint de analytics. Risco menor pois são chaves "frontend" projetadas para exposição, mas ainda assim expõem superfície de ataque.',
        'severity': 'Baixa'
    },
    {
        'category': 'INPUTS SEM TRATAMENTO (XSS)',
        'name': 'Uso de dangerouslySetInnerHTML para Estilos CSS Dinâmicos',
        'file': 'client/src/components/ui/chart.tsx',
        'line': '81-98',
        'code': '<style\ndangerouslySetInnerHTML={{\n  __html: Object.entries(THEMES)\n    .map(([theme, prefix]) => `...\n${colorConfig.map(...).join("\\n")}\n}\n`)\n    .join("\\n")\n}}\n/>',
        'description': 'O componente ChartStyle usa dangerouslySetInnerHTML para injetar variáveis CSS customizadas (--color-*) baseadas na configuração do tema. O conteúdo é gerado a partir de objeto de configuração interno, não de input de usuário.',
        'exploitability': 'Não explorável atualmente - o conteúdo vem de configuração estática do tema (cores). Não há caminho para input de usuário chegar aqui.',
        'conditions': 'Nenhuma - código seguro na implementação atual.',
        'impact': 'Baixo risco atual. Porém, se no futuro a configuração de tema vier de input de usuário (ex: personalização), haveria risco de injeção CSS/JS.',
        'severity': 'Informativa'
    },
]

# Pontos Fortes
STRENGTHS = [
    {
        'name': 'Autenticação JWT Robusta com Rotação de Chaves',
        'file': 'server/_core/sdk.ts',
        'line': '180-197',
        'description': 'Implementação de sessão JWT com HS256, expiração configurável, validação de issuer/audience, e rotação automática de usuários via sincronização com OAuth externo.'
    },
    {
        'name': 'Isolamento por Máquina (machineCode) nas Operações de Produção',
        'file': 'server/routers/production.ts',
        'line': '88-103, 128-170',
        'description': 'Todas as operações críticas de apontamento, setup, pausa, liberação de produto validam ctx.localUser.machine.code e lançam erro se não houver máquina vinculada. Impede IDOR direto em operações de escrita.'
    },
    {
        'name': 'Validação de Entrada com Zod em Todos os Endpoints',
        'file': 'server/routers/production.ts',
        'line': '56-70, 78-166',
        'description': 'Todos os inputs de rotas tRPC são validados com schemas Zod rigorosos (tipos, ranges, enums, tamanhos máximos). Previne injection e dados malformados.'
    },
    {
        'name': 'Senhas Não Armazenadas - Autenticação Via OAuth Externo',
        'file': 'server/_core/sdk.ts',
        'line': '258-320',
        'description': 'A aplicação não armazena senhas. Autenticação delegada para servidor OAuth externo (Manus). Sessão local usa JWT assinado com segredo do servidor.'
    },
    {
        'name': 'Cookies Seguros (HttpOnly, Secure, SameSite=Lax)',
        'file': 'server/localSession.ts',
        'line': '29-37',
        'description': 'Cookies de sessão configurados com httpOnly: true, secure: true (em HTTPS), sameSite: "lax", maxAge: 8h. Protege contra XSS e CSRF básico.'
    },
    {
        'name': 'Rate Limiting e Timeout no Proxy Firebird',
        'file': 'server/firebirdProxy.ts',
        'line': '424-441',
        'description': 'Requisições ao proxy Firebird têm timeout de 8s (AbortSignal.timeout) e headers de autorização Bearer token. Previne DoS por queries lentas.'
    },
    {
        'name': 'Sanitização de Inputs Numéricos no Frontend',
        'file': 'client/src/components/ProcessLabelDialog.tsx',
        'line': '212-218, 232-238',
        'description': 'Campos numéricos (quantidade, cópias) usam .replace(/\\D/g, "").slice(0, 5) para permitir apenas dígitos e limitar tamanho. Previne injection em inputs.'
    },
]

# Recomendações
RECOMMENDATIONS = [
    {
        'priority': 'P1',
        'title': 'Remover Imediatamente Todos os Segredos do Repositório Git',
        'findings': ['CHAVES EXPOSTAS #1', 'CHAVES EXPOSTAS #2', 'CHAVES EXPOSTAS #3'],
        'actions': [
            'Revogar e rotacionar TODAS as chaves expostas: JWT_SECRET, FIREBIRD_PROXY_TOKEN, FIREBIRD_PASSWORD, BUILT_IN_FORGE_API_KEY, OAUTH_SERVER_URL.',
            'Remover .project-config.json do histórico Git (git filter-repo ou BFG Repo-Cleaner).',
            'Remover .env do histórico Git e adicionar ao .gitignore.',
            'Configurar variáveis de ambiente no ambiente de deploy (não no código).',
            'Implementar pre-commit hooks (ex: husky + secretlint) para impedir commits futuros com segredos.'
        ]
    },
    {
        'priority': 'P1',
        'title': 'Implementar Middleware de Autorização Centralizado (RBAC)',
        'findings': ['PERMISSÃO DEFINIDA NO NAVEGADOR #1', 'PERMISSÃO DEFINIDA NO NAVEGADOR #2'],
        'actions': [
            'Criar procedimentos tRPC reais com middleware: adminProcedure, operatorProcedure, programmerProcedure que validam ctx.user.role e ctx.localUser.operationalProfile.',
            'Remover validações manuais (throw new Error) das rotas individuais.',
            'Implementar testes automatizados de autorização para cada role.',
            'Documentar matriz de permissões por role/endpoint.'
        ]
    },
    {
        'priority': 'P2',
        'title': 'Implementar Filtro de Tenant/Empresa em Consultas Gerais',
        'findings': ['BANCO SEM TRANCA #1', 'BANCO SEM TRANCA #2'],
        'actions': [
            'Adicionar companyCode/machineCode como filtro obrigatório em getOrders, getProducts, getStock, getProductionDashboard.',
            'Para usuários programmer/admin, permitir visualização global (opcional). Para operator, filtrar estritamente pela máquina.',
            'Aplicar mesmo filtro em participants.list (filtrar por companyCode do usuário).',
            'Considerar implementar Row Level Security (RLS) no banco Firebird/MySQL como camada adicional.'
        ]
    },
    {
        'priority': 'P2',
        'title': 'Corrigir IDOR em Endpoints de Detalhe e Atualização',
        'findings': ['IDOR #1', 'IDOR #2'],
        'actions': [
            'Em participants.client: validar se cliente.codigo pertence à companyCode do usuário antes de retornar.',
            'Em orders.updateStatus: validar se opCodigo/mpCodigo pertence a uma máquina controlada pelo usuário (via getControlledMachines ou similar).',
            'Adicionar logs de auditoria para operações de escrita sensíveis (mudança de status, criação de cliente).'
        ]
    },
    {
        'priority': 'P2',
        'title': 'Validar Segurança de Credenciais no Startup',
        'findings': ['CHAVES EXPOSTAS #5'],
        'actions': [
            'Em getFirebirdProxyConfiguration: rejeitar tokens que correspondam a placeholders conhecidos ("crie-um-token-longo", "changeme", "default").',
            'Validar que FIREBIRD_PASSWORD não seja "masterkey" ou outras senhas padrão conhecidas.',
            'Log de warning crítico se credenciais inseguras detectadas em produção (NODE_ENV=production).'
        ]
    },
    {
        'priority': 'P3',
        'title': 'Revisar Exposição de Variáveis VITE_ no Frontend',
        'findings': ['CHAVES EXPOSTAS #6'],
        'actions': [
            'Auditar cada VITE_* exposta: confirmar se é realmente necessária no frontend.',
            'Mover chaves sensíveis para backend (proxy) se possível.',
            'Para chaves que devem ficar no frontend, documentar que são públicas e garantir escopo mínimo no provedor (ex: API key somente leitura).'
        ]
    },
    {
        'priority': 'P3',
        'title': 'Hardening Adicional',
        'findings': ['INPUTS SEM TRATAMENTO (XSS) #1', 'Geral'],
        'actions': [
            'Adicionar Content Security Policy (CSP) headers no Express (helmet.js).',
            'Implementar rate limiting global no Express (express-rate-limit).',
            'Adicionar validação de origem (CORS) restritiva.',
            'Considerar migrar dangerouslySetInnerHTML no ChartStyle para CSS-in-JS ou style tags seguras.',
            'Implementar logging de auditoria estruturado (quem acessou o quê, quando).'
        ]
    },
]

def create_charts():
    """Gera gráficos de distribuição de severidade e categoria"""
    # Dados para gráficos
    severity_counts = {s: 0 for s in SEVERITY_ORDER}
    category_counts = {}

    for f in FINDINGS:
        severity_counts[f['severity']] += 1
        category_counts[f['category']] = category_counts.get(f['category'], 0) + 1

    # Gráfico de rosca - Severidade
    fig1, ax1 = plt.subplots(figsize=(6, 4))
    colors_list = [SEVERITY_COLORS[s].hexval() for s in SEVERITY_ORDER if severity_counts[s] > 0]
    labels = [s for s in SEVERITY_ORDER if severity_counts[s] > 0]
    values = [severity_counts[s] for s in SEVERITY_ORDER if severity_counts[s] > 0]

    wedges, texts, autotexts = ax1.pie(values, labels=labels, colors=colors_list, autopct='%1.0f%%',
                                        startangle=90, pctdistance=0.85,
                                        wedgeprops=dict(width=0.5, edgecolor='w'))
    centre_circle = plt.Circle((0,0), 0.70, fc='white')
    fig1.gca().add_artist(centre_circle)
    ax1.set_title('Distribuição por Severidade', fontsize=12, fontweight='bold', pad=20)
    plt.tight_layout()

    buf1 = io.BytesIO()
    plt.savefig(buf1, format='png', dpi=150, bbox_inches='tight', transparent=True)
    buf1.seek(0)
    plt.close()

    # Gráfico de barras - Categoria
    fig2, ax2 = plt.subplots(figsize=(6, 4))
    cats = list(category_counts.keys())
    vals = list(category_counts.values())
    cat_colors = [SEVERITY_COLORS['Crítica'], SEVERITY_COLORS['Alta'], SEVERITY_COLORS['Média'],
                  SEVERITY_COLORS['Baixa'], SEVERITY_COLORS['Informativa']][:len(cats)]

    bars = ax2.barh(cats, vals, color=cat_colors, edgecolor='white', height=0.6)
    ax2.set_xlabel('Quantidade de Achados')
    ax2.set_title('Distribuição por Categoria', fontsize=12, fontweight='bold', pad=15)
    ax2.invert_yaxis()

    # Adicionar valores nas barras
    for bar, val in zip(bars, vals):
        ax2.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height()/2, str(val),
                va='center', fontweight='bold')

    plt.tight_layout()

    buf2 = io.BytesIO()
    plt.savefig(buf2, format='png', dpi=150, bbox_inches='tight', transparent=True)
    buf2.seek(0)
    plt.close()

    return buf1, buf2

def build_pdf(output_path):
    """Constrói o relatório PDF completo"""
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2*cm,
        rightMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title="Relatório de Auditoria de Segurança - ProducaoWeb",
        author="Auditoria Automatizada"
    )

    styles = getSampleStyleSheet()

    # Estilos customizados
    styles.add(ParagraphStyle(
        name='CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        alignment=TA_CENTER,
        spaceAfter=12,
        textColor=HexColor('#1a3c2e')
    ))
    styles.add(ParagraphStyle(
        name='CoverSubtitle',
        fontName='Helvetica',
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        spaceAfter=6,
        textColor=HexColor('#476152')
    ))
    styles.add(ParagraphStyle(
        name='SectionTitle',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        spaceBefore=18,
        spaceAfter=10,
        textColor=HexColor('#1a3c2e'),
        borderWidth=0,
        borderPadding=0,
        borderColor=HexColor('#177458')
    ))
    styles.add(ParagraphStyle(
        name='SubSectionTitle',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        spaceBefore=12,
        spaceAfter=6,
        textColor=HexColor('#294438')
    ))
    styles.add(ParagraphStyle(
        name='FindingTitle',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=2,
        textColor=black
    ))
    styles.add(ParagraphStyle(
        name='BodyText2',
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        alignment=TA_JUSTIFY,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        name='CodeBlock',
        fontName='Courier',
        fontSize=7.5,
        leading=9.5,
        leftIndent=12,
        rightIndent=12,
        spaceBefore=4,
        spaceAfter=4,
        backColor=HexColor('#f5f8f5'),
        borderWidth=0.5,
        borderColor=HexColor('#d6e0d9'),
        borderPadding=6
    ))
    styles.add(ParagraphStyle(
        name='TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=white
    ))
    styles.add(ParagraphStyle(
        name='TableCell',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        name='SeverityChip',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=white
    ))
    styles.add(ParagraphStyle(
        name='StrengthTitle',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        spaceBefore=8,
        spaceAfter=2,
        textColor=SEVERITY_COLORS['Ponto Forte']
    ))

    story = []

    # ===== CAPA =====
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph("Relatório de Auditoria de Segurança", styles['CoverTitle']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("ProducaoWeb — Sistema de Gestão de Produção", styles['CoverSubtitle']))
    story.append(Spacer(1, 1.5*cm))
    story.append(HRFlowable(width="80%", thickness=2, color=HexColor('#177458')))
    story.append(Spacer(1, 1*cm))

    cover_info = [
        ["Data da Auditoria:", datetime.now().strftime("%d/%m/%Y %H:%M")],
        ["Escopo:", "Código-fonte completo (backend, frontend, configurações, infraestrutura)"],
        ["Metodologia:", "Análise estática de código (white-box) baseada em 5 categorias OWASP-like adaptadas à stack TypeScript/Express/tRPC/Firebird"],
        ["Stack Detectada:", "TypeScript, React 19, Vite, Express, tRPC, Drizzle ORM, Firebird (node-firebird), MySQL, JWT (jose), OAuth2"],
        ["Arquitetura de Isolamento:", "Baseada em machineCode (máquina vinculada ao operador) e operationalProfile (operator, programmer, manual-pointing, manual-production, quality-release). Não há RLS no banco."],
    ]

    cover_table = Table(cover_info, colWidths=[4.5*cm, 12*cm])
    cover_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('TEXTCOLOR', (0,0), (0,-1), HexColor('#40564a')),
        ('TEXTCOLOR', (1,0), (1,-1), HexColor('#214534')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LINEBELOW', (0,0), (-1,-2), 0.5, HexColor('#d6e0d9')),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # ===== RESUMO EXECUTIVO =====
    story.append(Paragraph("Resumo Executivo", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    # Estatísticas
    total_findings = len(FINDINGS)
    severity_counts = {s: 0 for s in SEVERITY_ORDER}
    for f in FINDINGS:
        severity_counts[f['severity']] += 1

    summary_text = f"""
    A auditoria identificou <b>{total_findings} achados de segurança</b> distribuídos em 5 categorias de risco.
    <br/><br/>
    <b>Distribuição por Severidade:</b>
    """
    for s in SEVERITY_ORDER:
        if severity_counts[s] > 0:
            summary_text += f" <font color='{SEVERITY_COLORS[s].hexval()}'><b>{severity_counts[s]} {s}</b></font>;"

    summary_text += f"""
    <br/><br/>
    <b>Principais Riscos Críticos:</b>
    <ul>
        <li><b>Exposição de segredos em repositório Git:</b> JWT_SECRET, chaves de API, tokens de banco, senhas padrão — permite comprometimento total da autenticação e acesso ao banco de dados.</li>
        <li><b>Ausência de middleware de autorização:</b> Roles (admin, programmer, operator) não são validadas centralmente; dependem de código manual em cada rota.</li>
    </ul>
    <br/>
    <b>Pontos Fortes Identificados:</b> {len(STRENGTHS)} mecanismos de segurança bem implementados (autenticação JWT, isolamento por máquina, validação Zod, cookies seguros, OAuth externo).
    """
    story.append(Paragraph(summary_text, styles['BodyText2']))
    story.append(Spacer(1, 0.5*cm))

    # Gráficos
    chart1_buf, chart2_buf = create_charts()

    from reportlab.platypus import Image
    img1 = Image(chart1_buf, width=7*cm, height=5*cm)
    img2 = Image(chart2_buf, width=7*cm, height=5*cm)

    chart_table = Table([[img1, img2]], colWidths=[8.5*cm, 8.5*cm])
    chart_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(chart_table)
    story.append(PageBreak())

    # ===== PONTOS FORTES E PONTOS FRACOS =====
    story.append(Paragraph("Pontos Fortes e Pontos Fracos", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    story.append(Paragraph("Pontos Fortes (Mecanismos Protegidos)", styles['SubSectionTitle']))
    for i, s in enumerate(STRENGTHS, 1):
        text = f"<b>{i}. {s['name']}</b> (<font face='Courier' size=8>{s['file']}:{s['line']}</font>)<br/>{s['description']}"
        story.append(Paragraph(text, styles['BodyText2']))

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("Pontos Fracos (Principais Riscos)", styles['SubSectionTitle']))

    weak_points = [
        "Segredos (JWT_SECRET, API Keys, DB passwords) commitados no repositório Git (.project-config.json, .env)",
        "Ausência de camada de autorização centralizada (RBAC) — validação manual propensa a erros",
        "Endpoints de listagem expõem dados globais sem filtro de tenant/máquina (dashboard, produtos, estoque, clientes)",
        "IDOR em consulta de cliente por ID e atualização de status de pedido sem validação de propriedade",
        "Validação de startup ausente para credenciais padrão/inseguras",
    ]
    for i, wp in enumerate(weak_points, 1):
        story.append(Paragraph(f"{i}. {wp}", styles['BodyText2']))

    story.append(PageBreak())

    # ===== ACHADOS DETALHADOS =====
    story.append(Paragraph("Achados Detalhados", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    # Agrupar por categoria
    categories = {}
    for f in FINDINGS:
        if f['category'] not in categories:
            categories[f['category']] = []
        categories[f['category']].append(f)

    for cat_name in ['CHAVES EXPOSTAS', 'PERMISSÃO DEFINIDA NO NAVEGADOR', 'BANCO SEM TRANCA', 'IDOR', 'INPUTS SEM TRATAMENTO (XSS)']:
        if cat_name not in categories:
            continue
        story.append(Paragraph(cat_name, styles['SubSectionTitle']))

        for f in categories[cat_name]:
            # Chip de severidade
            sev_color = SEVERITY_COLORS[f['severity']]
            sev_style = ParagraphStyle('sev', parent=styles['SeverityChip'],
                                       backColor=sev_color, borderColor=sev_color)

            # Dados do achado
            finding_data = [
                [Paragraph(f'<b>{f["name"]}</b>', styles['FindingTitle']),
                 Paragraph(f['severity'], sev_style)],
                [Paragraph(f'<b>Arquivo:</b> <font face="Courier" size=8>{f["file"]}</font>', styles['BodyText2']),
                 Paragraph(f'<b>Linha:</b> {f["line"]}', styles['BodyText2'])],
                [Paragraph(f'<b>Descrição:</b> {f["description"]}', styles['BodyText2']), ''],
                [Paragraph(f'<b>Explorabilidade:</b> {f["exploitability"]}', styles['BodyText2']), ''],
                [Paragraph(f'<b>Condições:</b> {f["conditions"]}', styles['BodyText2']), ''],
                [Paragraph(f'<b>Impacto:</b> {f["impact"]}', styles['BodyText2']), ''],
            ]

            # Código (se não for muito longo)
            code_text = f['code']
            if len(code_text) > 800:
                code_text = code_text[:800] + '\n... (truncado)'
            code_text = code_text.replace('\n', '<br/>').replace(' ', '&nbsp;')
            finding_data.append([Paragraph(f'<b>Código:</b><br/><font face="Courier" size=7>{code_text}</font>', styles['CodeBlock']), ''])

            t = Table(finding_data, colWidths=[15*cm, 2*cm])
            t.setStyle(TableStyle([
                ('SPAN', (0, 2), (1, 2)),
                ('SPAN', (0, 3), (1, 3)),
                ('SPAN', (0, 4), (1, 4)),
                ('SPAN', (0, 5), (1, 5)),
                ('SPAN', (0, 6), (1, 6)),
                ('SPAN', (0, 7), (1, 7)),
                ('BACKGROUND', (0, 0), (1, 0), HexColor('#f5f8f5')),
                ('BACKGROUND', (1, 0), (1, 0), sev_color),
                ('TEXTCOLOR', (1, 0), (1, 0), white),
                ('BOX', (0, 0), (-1, -1), 0.5, HexColor('#d6e0d9')),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, HexColor('#e2eae4')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.4*cm))

        story.append(Spacer(1, 0.3*cm))

    story.append(PageBreak())

    # ===== RECOMENDAÇÕES PRIORIZADAS =====
    story.append(Paragraph("Recomendações Priorizadas", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))

    for rec in RECOMMENDATIONS:
        priority_color = {
            'P1': SEVERITY_COLORS['Crítica'],
            'P2': SEVERITY_COLORS['Alta'],
            'P3': SEVERITY_COLORS['Média']
        }[rec['priority']]

        priority_style = ParagraphStyle('prio', parent=styles['SeverityChip'],
                                        backColor=priority_color, borderColor=priority_color,
                                        fontSize=9, leading=12)

        story.append(Paragraph(f"<b>{rec['title']}</b>  ", styles['SubSectionTitle']))
        story.append(Paragraph(f"Prioridade: {rec['priority']}", priority_style))
        story.append(Paragraph(f"<b>Achados Relacionados:</b> {', '.join(rec['findings'])}", styles['BodyText2']))
        story.append(Paragraph("<b>Ações:</b>", styles['BodyText2']))
        for action in rec['actions']:
            story.append(Paragraph(f"• {action}", styles['BodyText2'], bulletText='•'))
        story.append(Spacer(1, 0.4*cm))

    story.append(PageBreak())

    # ===== ISSUES PARA GITHUB =====
    story.append(Paragraph("Issues para GitHub", styles['SectionTitle']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("Cada issue abaixo está formatada para cópia direta no GitHub Issues. Use os delimitadores --- ISSUE N --- e --- FIM ISSUE N ---.", styles['BodyText2']))
    story.append(Spacer(1, 0.3*cm))

    for i, f in enumerate(FINDINGS, 1):
        issue_text = f"""--- ISSUE {i} ---
Título: [Segurança] {f['name']}
Labels sugeridas: security, {f['severity'].lower()}

Descrição do problema:
{f['description']}

Por que é explorável:
{f['exploitability']}

Condições necessárias:
{f['conditions']}

Evidência:
- Arquivo: {f['file']}
- Linha: {f['line']}
- Código:
```
{f['code']}
```

Impacto:
{f['impact']}

Sugestão de correção:
{'; '.join([a for r in RECOMMENDATIONS if f['name'] in ' '.join(r['findings']) for a in r['actions']][:3]) or 'Ver recomendações priorizadas no relatório.'}

Critérios de aceite:
- [ ] Segredo removido do repositório e rotacionado (se aplicável)
- [ ] Middleware de autorização implementado (se aplicável)
- [ ] Filtro de tenant/máquina adicionado à query (se aplicável)
- [ ] Validação de propriedade do objeto implementada (se aplicável)
- [ ] Testes de regressão de segurança passando
--- FIM ISSUE {i} ---"""

        # Usar Paragraph com estilo de código para preservar formatação
        issue_para = Paragraph(issue_text.replace('\n', '<br/>').replace(' ', '&nbsp;'),
                               ParagraphStyle('issue', parent=styles['CodeBlock'], fontSize=7, leading=9))
        story.append(issue_para)
        story.append(Spacer(1, 0.3*cm))

    # Build
    doc.build(story)
    print(f"PDF gerado com sucesso: {output_path}")

if __name__ == '__main__':
    output_dir = r'C:\ProducaoWeb\docs\security-audit'
    output_path = os.path.join(output_dir, 'relatorio-auditoria-seguranca.pdf')
    build_pdf(output_path)