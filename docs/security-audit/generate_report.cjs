#!/usr/bin/env node
/**
 * Script gerador de relatório de auditoria de segurança
 * ProducaoWeb - Produz HTML que pode ser convertido para PDF
 */

const fs = require('fs');
const path = require('path');

// Dados da auditoria
const FINDINGS = [
  {
    category: 'CHAVES EXPOSTAS',
    name: 'Segredos Hardcoded no Arquivo de Configuração do Projeto',
    file: '.project-config.json',
    line: '24-41',
    code: 'secrets: {\n  "BUILT_IN_FORGE_API_KEY": "MtgjkV5FtDtUD4tfaCduZd",\n  "BUILT_IN_FORGE_API_URL": "https://forge.manus.ai",\n  "FIREBIRD_PROXY_TOKEN": "bikraft159753",\n  "FIREBIRD_PROXY_URL": "http://producao.bikraft.local",\n  "JWT_SECRET": "EGgZMMBX52nuMLDkiUE6ce",\n  "OAUTH_SERVER_URL": "https://api.manus.im",\n  "OWNER_OPEN_ID": "fmSSfapuVASX32eUY3tA9Q",\n  ...\n}',
    description: 'O arquivo .project-config.json contém 17 segredos hardcoded incluindo chaves de API, tokens de autenticação, segredo JWT e URLs de serviços internos. Este arquivo está versionado no repositório Git.',
    exploitability: 'Qualquer pessoa com acesso ao repositório Git (público ou interno) pode extrair estas credenciais e acessar serviços externos (Forge API, Firebird Proxy, OAuth Server). O JWT_SECRET permite forjar tokens de sessão válidos.',
    conditions: 'Acesso de leitura ao repositório Git. Nenhuma condição adicional necessária.',
    impact: 'Comprometimento total da autenticação (forja de tokens JWT), acesso ao Firebird Proxy (banco de dados de produção), acesso à API Forge (infraestrutura Manus), vazamento de identidade do proprietário (OWNER_OPEN_ID).',
    severity: 'Crítica'
  },
  {
    category: 'CHAVES EXPOSTAS',
    name: 'Credencial Padrão do Firebird em Arquivo .env',
    file: '.env',
    line: '9',
    code: 'FIREBIRD_PASSWORD="masterkey"',
    description: 'O arquivo .env contém a senha padrão "masterkey" do usuário SYSDBA do Firebird, que é a senha padrão conhecida publicamente.',
    exploitability: 'Se o Firebird estiver exposto na rede (porta 3050), qualquer atacante pode conectar-se com usuário SYSDBA e senha "masterkey" e ter acesso total ao banco de dados.',
    conditions: 'Firebird acessível na rede (porta 3050 aberta). Arquivo .env exposto ou commitado no repositório.',
    impact: 'Acesso total ao banco de dados Firebird (leitura/escrita/exclusão de todos os dados de produção, pedidos, estoque, usuários). Possível elevação de privilégios no sistema.',
    severity: 'Crítica'
  },
  {
    category: 'CHAVES EXPOSTAS',
    name: 'Token de Proxy Firebird Fraco/Placeholder',
    file: '.env',
    line: '3',
    code: 'FIREBIRD_PROXY_TOKEN="crie-um-token-longo"',
    description: 'O arquivo .env contém um token placeholder "crie-um-token-longo" em vez de um segredo criptograficamente seguro.',
    exploitability: 'Se o proxy Firebird estiver exposto, qualquer pessoa pode adivinhar ou brute-forçar este token e acessar o proxy, que por sua vez acessa o banco Firebird.',
    conditions: 'Proxy Firebird acessível na rede. Token não alterado para valor seguro.',
    impact: 'Bypass da autenticação do proxy Firebird, levando a acesso indireto ao banco de dados.',
    severity: 'Alta'
  },
  {
    category: 'PERMISSÃO DEFINIDA NO NAVEGADOR',
    name: 'Ausência de Middleware de Autorização Centralizado',
    file: 'server/_core/trpc.ts',
    line: '10-16',
    code: 'export const adminProcedure = t.procedure;\nexport const localProtectedProcedure = t.procedure;\nexport const operatorProcedure = t.procedure;\nexport const programmerProcedure = t.procedure;\n// Custom procedures with role-based access control\n// These are aliases for publicProcedure - the role checks are done in the procedure implementation',
    description: 'Os procedimentos tRPC para diferentes roles (admin, operator, programmer) são apenas aliases de publicProcedure sem validação de middleware. O comentário indica que "role checks are done in the procedure implementation", mas isso cria dependência de implementação manual em cada rota.',
    exploitability: 'Um desenvolvedor pode esquecer de adicionar a validação de permissão em uma nova rota, deixando-a exposta. Rotas administrativas como notifyOwner usam adminProcedure que não valida nada.',
    conditions: 'Nova rota criada sem validação manual. Ou rota existente modificada removendo validação acidentalmente.',
    impact: 'Escalonamento de privilégios: usuários comuns podem acessar funcionalidades de administrador, programador ou operador. Vazamento de dados sensíveis entre máquinas/operadores.',
    severity: 'Alta'
  },
  {
    category: 'PERMISSÃO DEFINIDA NO NAVEGADOR',
    name: 'Endpoint Administrativo sem Validação de Role',
    file: 'server/_core/systemRouter.ts',
    line: '16-28',
    code: 'notifyOwner: adminProcedure\n  .input(z.object({...}))\n  .mutation(async ({ input }) => {\n    const delivered = await notifyOwner(input);\n    return { success: delivered };\n  }),',
    description: 'O endpoint system.notifyOwner usa adminProcedure, que não implementa nenhuma validação de role de administrador. Qualquer usuário autenticado pode chamar este endpoint.',
    exploitability: 'Qualquer usuário com sessão válida (localProtectedProcedure) pode enviar notificações para o proprietário do projeto via API Forge.',
    conditions: 'Usuário autenticado no sistema. Conhecimento do endpoint tRPC.',
    impact: 'Spam de notificações para o proprietário, possencial DoS no serviço de notificação externo, vazamento de que o endpoint existe.',
    severity: 'Média'
  },
  {
    category: 'BANCO SEM TRANCA',
    name: 'Falta de Isolamento de Dados por Máquina/Tenant em Consultas Gerais',
    file: 'server/routers/production.ts',
    line: '77-79, 274-279',
    code: 'dashboard: localProtectedProcedure.query(() => getProductionDashboard()),\n...\nproducts: router({\n  list: localProtectedProcedure.input(pageInput).query(({ input }) => getProducts(input.page, input.limit, input.search)),\n}),\nstock: router({\n  list: localProtectedProcedure.input(pageInput).query(({ input }) => getStock(input.page, input.limit, input.search)),\n  ...\n})',
    description: 'Endpoints de listagem geral (dashboard, produtos, estoque, pedidos) não filtram dados por machineCode ou companyCode do usuário autenticado. Retornam dados globais para qualquer usuário autenticado.',
    exploitability: 'Qualquer operador autenticado pode visualizar todos os produtos, estoque, pedidos e dashboard de toda a fábrica, não apenas os da sua máquina.',
    conditions: 'Usuário autenticado com perfil "operator" ou superior. Acesso às rotas de listagem.',
    impact: 'Vazamento de informação sensível de produção: volumes de pedidos, estoque total, programação de outras máquinas, dados de clientes/fornecedores. Violação de princípio de menor privilégio.',
    severity: 'Média'
  },
  {
    category: 'BANCO SEM TRANCA',
    name: 'Consulta de Clientes/Participantes sem Filtro de Empresa',
    file: 'server/routers/participants.ts',
    line: '37-55',
    code: 'list: consultationProcedure\n  .input(z.object({...}))\n  .query(({ input }) =>\n    getParticipants(\n      input.page, input.limit, input.search, input.type, input.status\n    )\n  )',
    description: 'O endpoint participants.list retorna todos os participantes (clientes, fornecedores) sem filtrar por companyCode do usuário. O consultationProcedure valida apenas se o usuário tem perfil programmer ou canConfigureStation.',
    exploitability: 'Usuários com perfil programmer ou canConfigureStation=true podem listar todos os clientes/fornecedores de todas as empresas.',
    conditions: 'Usuário com perfil programmer ou canConfigureStation=true.',
    impact: 'Vazamento de base de clientes/fornecedores completa, incluindo CNPJ, contatos, endereços, condições comerciais.',
    severity: 'Média'
  },
  {
    category: 'IDOR',
    name: 'Endpoint de Detalhe de Cliente por ID sem Validação de Propriedade',
    file: 'server/firebirdProxy.ts, server/routers/participants.ts',
    line: '475, 56-58',
    code: '// firebirdProxy.ts\nexport const getClient = (codigo: number) => request<ClientRecord>(`/v1/clients/${codigo}`);\n\n// participants.ts\nclient: consultationProcedure\n  .input(z.object({ codigo: z.number().int().positive() }))\n  .query(({ input }) => getClient(input.codigo))',
    description: 'O endpoint participants.client permite buscar qualquer cliente pelo código numérico (codigo) sem verificar se o cliente pertence à empresa do usuário autenticado.',
    exploitability: 'Usuário com acesso ao consultationProcedure pode enumerar IDs de clientes (1, 2, 3...) e obter dados completos (CNPJ, endereço, contato, condições comerciais) de clientes de outras empresas.',
    conditions: 'Usuário com perfil programmer ou canConfigureStation=true. Conhecimento ou enumeração de códigos de cliente.',
    impact: 'Vazamento de dados sensíveis de clientes (PII, dados fiscais, condições comerciais) entre empresas/tenants.',
    severity: 'Média'
  },
  {
    category: 'IDOR',
    name: 'Atualização de Status de Pedido sem Validação de Propriedade da Máquina',
    file: 'server/routers/production.ts, server/firebirdProxy.ts',
    line: '80-85, 457-462',
    code: '// production.ts\nupdateStatus: programmerProcedure\n  .input(processInput.extend({...}))\n  .mutation(({ input }) => updateOrderStatus(input));\n\n// firebirdProxy.ts\nexport const updateOrderStatus = (input: { opCodigo: number; mpCodigo: number; status: string; fila?: number }) =>\n  request<{ success: true }>(`/v1/orders/${input.opCodigo}/${input.mpCodigo}/status`, {...})',
    description: 'O endpoint orders.updateStatus permite alterar o status de qualquer pedido (opCodigo/mpCodigo) sem verificar se o pedido pertence a uma máquina controlada pelo usuário programador.',
    exploitability: 'Um programador pode alterar status de pedidos de máquinas que não controla, desde que conheça opCodigo/mpCodigo.',
    conditions: 'Usuário com perfil programmer. Conhecimento de opCodigo/mpCodigo de outras máquinas.',
    impact: 'Manipulação indevida de status de produção de outras máquinas/equipes. Inconsistência de dados, relatórios incorretos.',
    severity: 'Média'
  },
  {
    category: 'CHAVES EXPOSTAS',
    name: 'Validação de Startup Ausente para Credenciais Padrão/Inseguras',
    file: 'server/firebirdProxy.ts',
    line: '406-422',
    code: 'export function getFirebirdProxyConfiguration(env: ProxyEnvironment = process.env as ProxyEnvironment) {\n  const rawUrl = env.FIREBIRD_PROXY_URL?.trim();\n  const token = env.FIREBIRD_PROXY_TOKEN?.trim();\n  if (!rawUrl) throw new Error("FIREBIRD_PROXY_URL não foi configurada.");\n  if (!token) throw new Error("FIREBIRD_PROXY_TOKEN não foi configurada.");\n  // ...\n}',
    description: 'A aplicação valida apenas se as variáveis de ambiente existem, mas não valida se são seguras (ex: token != "crie-um-token-longo", password != "masterkey"). Permite inicialização com credenciais padrão/inseguras.',
    exploitability: 'Deploy em produção com valores padrão do .env.example ou valores fracos. A aplicação inicia normalmente sem alertar sobre insegurança.',
    conditions: 'Variáveis de ambiente com valores padrão/fracos. Deploy sem revisão de segurança.',
    impact: 'Sistema roda em produção com credenciais conhecidas/publicamente expostas, facilitando ataques.',
    severity: 'Alta'
  },
  {
    category: 'CHAVES EXPOSTAS',
    name: 'Chaves de API Frontend Expostas no Bundle',
    file: '.project-config.json',
    line: '33-40',
    code: '"VITE_ANALYTICS_ENDPOINT": "https://manus-analytics.com",\n"VITE_ANALYTICS_WEBSITE_ID": "70809dbb-02a4-4add-a834-c9ff7de511a0",\n"VITE_APP_ID": "fUPJURoGTogtcLoydf5tmh",\n"VITE_FRONTEND_FORGE_API_KEY": "Qmm6bcczKbQKod5ubfLCZj",\n"VITE_FRONTEND_FORGE_API_URL": "https://forge.manus.ai",\n"VITE_OAUTH_PORTAL_URL": "https://manus.im"',
    description: 'Variáveis com prefixo VITE_ são embutidas no bundle do frontend (Vite) e expostas no navegador do usuário. A VITE_FRONTEND_FORGE_API_KEY é uma chave de API exposta publicamente.',
    exploitability: 'Qualquer usuário que acesse a aplicação pode inspecionar o bundle JavaScript e extrair estas chaves.',
    conditions: 'Acesso à aplicação web (pública ou autenticada). Inspeção de rede ou bundle JS.',
    impact: 'Uso indevido da API Forge no frontend, vazamento de ID da aplicação, endpoint de analytics. Risco menor pois são chaves "frontend" projetadas para exposição, mas ainda assim expõem superfície de ataque.',
    severity: 'Baixa'
  },
  {
    category: 'INPUTS SEM TRATAMENTO (XSS)',
    name: 'Uso de dangerouslySetInnerHTML para Estilos CSS Dinâmicos',
    file: 'client/src/components/ui/chart.tsx',
    line: '81-98',
    code: '<style\ndangerouslySetInnerHTML={{\n  __html: Object.entries(THEMES)\n    .map(([theme, prefix]) => `...\n${colorConfig.map(...).join("\\n")}\n}\n`)\n    .join("\\n")\n}}\n/>',
    description: 'O componente ChartStyle usa dangerouslySetInnerHTML para injetar variáveis CSS customizadas (--color-*) baseadas na configuração do tema. O conteúdo é gerado a partir de objeto de configuração interno, não de input de usuário.',
    exploitability: 'Não explorável atualmente - o conteúdo vem de configuração estática do tema (cores). Não há caminho para input de usuário chegar aqui.',
    conditions: 'Nenhuma - código seguro na implementação atual.',
    impact: 'Baixo risco atual. Porém, se no futuro a configuração de tema vier de input de usuário (ex: personalização), haveria risco de injeção CSS/JS.',
    severity: 'Informativa'
  },
];

const STRENGTHS = [
  { name: 'Autenticação JWT Robusta com Rotação de Chaves', file: 'server/_core/sdk.ts', line: '180-197' },
  { name: 'Isolamento por Máquina (machineCode) nas Operações de Produção', file: 'server/routers/production.ts', line: '88-103' },
  { name: 'Validação de Entrada com Zod em Todos os Endpoints', file: 'server/routers/production.ts', line: '56-70' },
  { name: 'Senhas Não Armazenadas - Autenticação Via OAuth Externo', file: 'server/_core/sdk.ts', line: '258-320' },
  { name: 'Cookies Seguros (HttpOnly, Secure, SameSite=Lax)', file: 'server/localSession.ts', line: '29-37' },
  { name: 'Rate Limiting e Timeout no Proxy Firebird', file: 'server/firebirdProxy.ts', line: '424-441' },
  { name: 'Sanitização de Inputs Numéricos no Frontend', file: 'client/src/components/ProcessLabelDialog.tsx', line: '212-218' },
];

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[tag]));
}

function generateSeverityChart() {
  const counts = { 'Crítica': 0, 'Alta': 0, 'Média': 0, 'Baixa': 0, 'Informativa': 0 };
  findings.forEach(f => counts[f.severity]++);

  const data = Object.entries(counts).filter(([k, v]) => v > 0);
  const colors = { 'Crítica': '#B91C1C', 'Alta': '#EA580C', 'Média': '#D97706', 'Baixa': '#2563EB', 'Informativa': '#6B7280' };

  return data.map(([name, count]) =>
    `<div style="margin:0.5rem 0;"><span style="background:${colors[name]}; color:white; padding:4px 12px; border-radius:4px; display:inline-block; font-weight:600;">${name}: ${count}</span></div>`
  ).join('');
}

function generateCategoryChart() {
  const counts = {};
  findings.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });

  const entries = Object.entries(counts);
  const colors = ['#B91C1C', '#EA580C', '#D97706', '#2563EB', '#6B7280'];

  return entries.map(([name, count], i) =>
    `<div style="margin:0.5rem 0;"><div style="font-weight:600; margin-bottom:2px;">${escapeHtml(name)}</div><div style="background:#e2e8f0; border-radius:4px; overflow:hidden;"><div style="background:${colors[i % colors.length]}; height:8px; width:${Math.min(count * 15, 100)}%;"></div></div><div style="font-size:0.8rem; color:#64756b;">${count} achado(s)</div></div>`
  ).join('');
}

function generateFindings() {
  const grouped = {};
  findings.forEach(f => {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  });

  return Object.entries(grouped).map(([cat, findings]) =>
    `<h2>${escapeHtml(cat)}</h2>` +
    findings.map(f => `
<div style="border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin:1rem 0; background:#f8fafc;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
    <div style="font-weight:700; font-size:1rem; color:#0f172a;">${escapeHtml(f.name)}</div>
    <span style="background:${f.severity === 'Crítica' ? '#B91C1C' : f.severity === 'Alta' ? '#EA580C' : f.severity === 'Média' ? '#D97706' : '#2563EB'}; color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:600;">${escapeHtml(f.severity)}</span>
  </div>
  <div style="font-size:0.75rem; color:#64756b; margin:0.5rem 0;"><font face="monospace">${escapeHtml(f.file)}</font> Line <font face="monospace">${escapeHtml(f.line)}</font></div>
  <div style="margin:0.5rem 0;"><span style="font-weight:600; color:#294438;">Descrição:</span> <p style="margin:0;">${escapeHtml(f.description)}</p></div>
  <div style="margin:0.5rem 0;"><span style="font-weight:600; color:#294438;">Explorabilidade:</span> <p style="margin:0;">${escapeHtml(f.exploitability)}</p></div>
  <div style="margin:0.5rem 0;"><span style="font-weight:600; color:#294438;">Condições:</span> <p style="margin:0;">${escapeHtml(f.conditions)}</p></div>
  <div style="margin:0.5rem 0;"><span style="font-weight:600; color:#294438;">Impacto:</span> <p style="margin:0;">${escapeHtml(f.impact)}</p></div>
  <div style="background:#eef2ff; border-left:4px solid #3b82f6; padding:0.75rem; margin:0.5rem 0; font-family:monospace; font-size:0.7rem; overflow-x:auto; border-radius:0 4px 4px 0;"><pre>${escapeHtml(f.code).substring(0, 800)}${f.code.length > 800 ? '\n...' : ''}</pre></div>
</div>
    `).join('')
  ).join('');
}

function generateIssues() {
  return findings.map((f, i) => `
<div style="border:1px solid #cbd5e1; border-radius:8px; padding:1rem; margin:1rem 0; background:#f8fafc; font-family:monospace; font-size:0.75rem;">
  <div style="background:#eef2ff; padding:0.5rem 1rem; margin:-1rem -1rem 1rem -1rem; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
    <span style="font-weight:700; font-size:0.85rem;">--- ISSUE ${i+1} ---</span>
    <span style="background:${f.severity === 'Crítica' ? '#B91C1C' : f.severity === 'Alta' ? '#EA580C' : f.severity === 'Média' ? '#D97706' : '#2563EB'}; color:white; padding:2px 8px; border-radius:4px; font-size:0.7rem; font-weight:700;">${f.severity}</span>
  </div>
  <div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Título</span><br/><code>[Segurança] ${escapeHtml(f.name)}</code></div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Labels sugeridas</span><br/><code>security, ${f.severity.toLowerCase()}</code></div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Descrição do problema</span><br/>${escapeHtml(f.description).replace(/\n/g, '<br/>')}</div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Evidência</span><br/><code>Arquivo: ${escapeHtml(f.file)}, Linha: ${escapeHtml(f.line)}</code></div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Impacto</span><br/>${escapeHtml(f.impact)}</div>
    <div style="margin:0.5rem 0;"><span style="font-weight:600;">Critérios de aceite</span><br/><ol style="margin:0.25rem 0 0.5rem 1rem;"><li>Segredo removido do repositório</li><li>Middleware de autorização implementado</li><li>Validação de propriedade adicionada</li><li>Testes de segurança passando</li></ol></div>
    <div style="margin:0.5rem 0; text-align:right; font-weight:700;">--- FIM ISSUE ${i+1} ---</div>
  </div>
</div>
  `).join('');
}

// Build HTML
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Relatório de Auditoria de Segurança - ProducaoWeb</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

        :root {
            --color-critica: #B91C1C;
            --color-alta: #EA580C;
            --color-media: #D97706;
            --color-baixa: #2563EB;
            --color-informativa: #6B7280;
            --color-ponto-forte: #059669;
            --color-bg: #ffffff;
            --color-text: #1e293b;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--color-text);
            background: var(--color-bg);
            line-height: 1.6;
            margin: 0;
            padding: 2cm;
            max-width: 21cm;
        }

        .cover { text-align: center; margin-top: 4cm; }
        .cover h1 { font-size: 2.5rem; font-weight: 800; color: #1a3c2e; margin-bottom: 0.5rem; }
        .cover h2 { font-size: 1.2rem; font-weight: 600; color: #476152; margin: 0 auto 1rem auto; max-width: 600px; }

        .section { margin: 2rem 0; }
        .section h1 { font-size: 1.8rem; font-weight: 700; color: #1a3c2e; border-bottom: 2px solid #177458; padding-bottom: 0.5rem; margin-bottom: 1rem; }
        .section h2 { font-size: 1.2rem; font-weight: 600; color: #294438; margin: 1.5rem 0 0.5rem 0; }

        .severity-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; color: white; }
        .severity-Crítica { background: var(--color-critica); }
        .severity-Alta { background: var(--color-alta); }
        .severity-Média { background: var(--color-media); }
        .severity-Baixa { background: var(--color-baixa); }

        .finding { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin: 1rem 0; background: #f8fafc; }
        .finding-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .finding-title { font-weight: 700; font-size: 1rem; color: #0f172a; }

        .recommendation { background: #f0f8f2; border-left: 4px solid var(--color-ponto-forte); padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; }
        .recommendation h3 { display: flex; align-items: center; gap: 0.5rem; margin-top: 0; margin-bottom: 0.5rem; }
        .priority-badge { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; color: white; }
        .priority-p1 { background: var(--color-critica); }
        .priority-p2 { background: var(--color-alta); }
        .priority-p3 { background: var(--color-media); }

        .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; color: #64756b; font-size: 0.85rem; }

        hr { border: none; border-top: 2px solid #177458; margin: 2rem 0; }
        ol { padding-left: 1.5rem; margin: 0.25rem 0; }
        li { margin: 0.25rem 0; }

        pre { background: #f1f5f9; padding: 0.5rem; border-radius: 4px; overflow-x: auto; font-size: 0.7rem; }
    </style>
</head>
<body>
    <div class="cover">
        <h1>Relatório de Auditoria de Segurança</h1>
        <h2>ProducaoWeb — Sistema de Gestão de Produção</h2>
    </div>

    <hr/>
    <hr/>

    <div style="background:#f0f8f2; border:1px solid #d6e0d9; border-radius:8px; padding:1.5rem; margin:1.5rem 0;">
        <dt style="font-weight:600; color:#294438; margin-top:0.5rem;">Data da Auditoria:</dt>
        <dd style="margin:0 0 0.5rem 0; color:#0f172a;">${new Date().toISOString().split('T')[0]}</dd>
        <hr/>
        <hr/>
        <dt style="font-weight:600; color:#294438; margin-top:0.5rem;">Escopo Auditado:</dt>
        <dd style="margin:0 0 0.5rem 0; color:#0f172a;">Código-fonte completo (backend, frontend, configurações, infraestrutura)</dd>
        <hr/>
        <hr/>
        <dt style="font-weight:600; color:#294438; margin-top:0.5rem;">Nota Metodológica:</dt>
        <dd style="margin:0 0 0.5rem 0; color:#0f172a;">
            Análise estática de código (white-box) baseada em 5 categorias de vulnerabilidade adaptadas à stack:
            <ol>
                <li><b>Chaves Expostas:</b> Procurar credenciais, tokens e segredos no código e configurações.</li>
                <li><b>Permissão Definida no Navegador:</b> Verificar autorização apenas no frontend.</li>
                <li><b>IDOR:</b> Acesso indevido a objetos por manipulação de identificadores.</li>
                <li><b>Banco Sem Tranca (RLS):</b> Verificar isolamento de inquilinos/tenant.</li>
                <li><b>Inputs Sem Tratamento (XSS):</b> Entrada e renderização insegura de conteúdo.</li>
            </ol>
            Stack detectada: TypeScript, React 19, Vite, Express, tRPC, Drizzle ORM, Firebird, MySQL, JWT (jose), OAuth2.
        </dd>
    </div>

    <div class="section">
        <h1>Resumo Executivo</h1>
        <p>A auditoria identificou <strong>${FINDINGS.length} achados de segurança</strong> distribuídos em 5 categorias.</p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin:1rem 0;">
            <div style="font-weight:700; margin-bottom:0.5rem;">Distribuição por Severidade:</div>
            <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                ${Object.entries({'Crítica': 0, 'Alta': 0, 'Média': 0, 'Baixa': 0, 'Informativa': 0}).map(([k,v]) => {
                  const count = FINDINGS.filter(f => f.severity === k).length;
                  return count > 0 ? `<span style="background:${k === 'Crítica' ? '#B91C1C' : k === 'Alta' ? '#EA580C' : k === 'Média' ? '#D97706' : '#2563EB'}; color:white; padding:4px 10px; border-radius:4px; font-size:0.8rem;">${k}: ${count}</span>` : '';
                }).join('')}
            </div>
        </div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem; margin:1rem 0;">
            <div style="font-weight:700; margin-bottom:0.5rem;">Distribuição por Categoria:</div>
            ${Object.entries(FINDINGS.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {})).map(([cat, count]) =>
                `<div style="margin:0.3rem 0;"><span style="font-weight:600;">${escapeHtml(cat)}</span> <span style="background:#3b82f6; color:white; padding:2px 6px; border-radius:3px; font-size:0.7rem;">${count}</span></div>`
            ).join('')}
        </div>

        <p><strong>Principais Riscos Críticos:</strong></p>
        <ul>
            <li><b>Exposição de segredos em repositório Git:</b> JWT_SECRET, chaves de API, tokens de banco, senhas padrão — permite comprometimento total da autenticação e acesso ao banco de dados.</li>
            <li><b>Ausência de middleware de autorização:</b> Roles (admin, programmer, operator) não são validadas centralmente; dependem de código manual em cada rota.</li>
        </ul>
        <p><b>Pontos Fortes:</b> ${STRENGTHS.length} mecanismos de segurança bem implementados (autenticação JWT, isolamento por máquina, validação Zod, cookies seguros, OAuth externo).</p>
    </div>

    <div class="section">
        <h1>Pontos Fortes e Pontos Fracos</h1>

        <h2>Pontos Fortes (Mecanismos Protegidos)</h2>
        ${STRENGTHS.map(s => `<div style="display:flex; gap:0.5rem; margin:0.5rem 0;"><span style="background:#059669; color:white; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700;">✓</span><div><strong>${escapeHtml(s.name)}</strong><br/><small><font face="monospace">${escapeHtml(s.file)}:${escapeHtml(s.line)}</font></small></div></div>`).join('')}</div>

        <h2>Pontos Fracos (Principais Riscos)</h2>
        <ol>
            <li>Segredos (JWT_SECRET, API Keys, DB passwords) commitados no repositório Git (.project-config.json, .env)</li>
            <li>Ausência de camada de autorização centralizada (RBAC) — validação manual propensa a erros</li>
            <li>Endpoints de listagem expõem dados globais sem filtro de tenant/máquina (dashboard, produtos, estoque, clientes)</li>
            <li>IDOR em consulta de cliente por ID e atualização de status de pedido sem validação de propriedade</li>
            <li>Validação de startup ausente para credenciais padrão/inseguras</li>
        </ol>
    </div>

    <div class="section">
        <h1>Achados Detalhados</h1>
        ${generateFindings()}
    </div>

    <div class="section">
        <h1>Recomendações Priorizadas</h1>

        <div class="recommendation">
            <h3><span class="priority-badge priority-p1">P1 - Crítica</span> Remover Imediatamente Todos os Segredos do Repositório Git</h3>
            <ul>
                <li>Revogar e rotacionar TODAS as chaves expostas: JWT_SECRET, FIREBIRD_PROXY_TOKEN, FIREBIRD_PASSWORD, BUILT_IN_FORGE_API_KEY, OAUTH_SERVER_URL.</li>
                <li>Remover .project-config.json do histórico Git (git filter-repo ou BFG Repo-Cleaner).</li>
                <li>Remover .env do histórico Git e adicionar ao .gitignore.</li>
                <li>Configurar variáveis de ambiente no ambiente de deploy.</li>
                <li>Implementar pre-commit hooks para impedrir commits futuros com segredos.</li>
            </ul>
        </div>

        <div class="recommendation">
            <h3><span class="priority-badge priority-p1">P1 - Crítica</span> Implementar Middleware de Autorização Centralizado (RBAC)</h3>
            <ul>
                <li>Criar procedimentos tRPC reais com middleware que validem ctx.user.role e ctx.localUser.operationalProfile.</li>
                <li>Remover validações manuais (throw new Error) das rotas individuais.</li>
                <li>Implementar testes automatizados de autorização para cada role.</li>
                <li>Documentar matriz de permissões por role/endpoint.</li>
            </ul>
        </div>

        <div class="recommendation">
            <h3><span class="priority-badge priority-p2">P2 - Alta</span> Validar Segurança de Credenciais no Startup</h3>
            <ul>
                <li>Em getFirebirdProxyConfiguration: rejeitar tokens que correspondam a placeholders conhecidos.</li>
                <li>Validar que FIREBIRD_PASSWORD não seja &quot;masterkey&quot; ou outras senhas padrão.</li>
                <li>Log de warning crítico se credenciais inseguras detectadas em produção.</li>
            </ul>
        </div>

        <div class="recommendation">
            <h3><span class="priority-badge priority-p2">P2 - Alta</span> Implementar Filtro de Tenant/Empresa nas Consultas</h3>
            <ul>
                <li>Adicionar companyCode/machineCode como filtro obrigatório em getOrders, getProducts, getStock, getProductionDashboard.</li>
                <li>Para usuários programmer/admin, permitir visualização global (opcional). Para operator, filtrar estritamente.</li>
                <li>Aplicar mesmo filtro em participants.list.</li>
            </ul>
        </div>
    </div>

    <div class="section">
        <h1>Issues para GitHub</h1>
        <p>Cada issue abaixo está formatada para cópia direta no GitHub Issues. Use os delimitadores --- ISSUE N --- e --- FIM ISSUE N ---.</p>
        ${generateIssues()}
    </div>

    <div class="footer">
        <hr/>
        <p><strong>Relatório de Auditoria de Segurança</strong><br/>
        Gerado: ${new Date().toISOString()}<br/>
        ProducaoWeb v1.0.0</p>
    </div>
</body>
</html>`;

// Write files
const outputDir = 'docs/security-audit';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const htmlPath = path.join(outputDir, 'relatorio-auditoria-seguranca.html');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`HTML report generated: ${htmlPath}`);

// Try to create PDF using wkhtmltopdf or similar if available
const { execSync } = require('child_process');
try {
  execSync(`wkhtmltopdf "${htmlPath}" "${path.join(outputDir, 'relatorio-auditoria-seguranca.pdf')}"`, { stdio: 'pipe' });
  console.log(`PDF report generated: ${path.join(outputDir, 'relatorio-auditoria-seguranca.pdf')}`);
} catch (e) {
  console.log('PDF generation skipped (wkhtmltopdf not available). HTML report is ready.');
}