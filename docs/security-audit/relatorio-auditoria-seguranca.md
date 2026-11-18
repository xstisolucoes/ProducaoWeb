# Relatório de Auditoria de Segurança — ProducaoWeb

**Data da Auditoria:** 2026-11-18  
**Escopo Auditado:** Código-fonte completo (backend, frontend, configurações, infraestrutura)  
**Stack Detectada:** TypeScript, React 19, Vite, Express, tRPC, Drizzle ORM, Firebird (node-firebird), MySQL, JWT (jose), OAuth2  
**Arquitetura de Isolamento:** Baseada em `machineCode` (máquina vinculada ao operador) e `operationalProfile` (operator, programmer, manual-pointing, manual-production, quality-release). Não há RLS no banco.

---

## Resumo Executivo

A auditoria identificou **10 achados de segurança** distribuídos em 5 categorias.

### Distribuição por Severidade
- **Crítica:** 2 achados
- **Alta:** 4 achados
- **Média:** 4 achados
- **Baixa:** 1 achado

### Distribuição por Categoria
- **CHAVES EXPOSTAS:** 5 achados
- **PERMISSÃO DEFINIDA NO NAVEGADOR:** 2 achados
- **IDOR:** 2 achados
- **BANCO SEM TRANCA:** 2 achados
- **INPUTS SEM TRATAMENTO (XSS):** 1 achado

### Principais Riscos Críticos

1. **Exposição de segredos em repositório Git:** JWT_SECRET, chaves de API, tokens de banco, senhas padrão — permite comprometimento total da autenticação e acesso ao banco de dados.
2. **Ausência de middleware de autorização:** Roles (admin, programmer, operator) não são validadas centralmente; dependem de código manual em cada rota.

### Pontos Fortes
- 7 mecanismos de segurança bem implementados: autenticação JWT, isolamento por máquina, validação Zod, cookies seguros, OAuth externo, rate limiting no proxy, sanitização de inputs.

---

## Pontos Fortes e Pontos Fracos

### Pontos Fortes (Mecanismos Protegidos)

| # | Mecanismo | Arquivo:Linha |
|---|-----------|---------------|
| 1 | Autenticação JWT Robusta com Rotação de Chaves | `server/_core/sdk.ts:180-197` |
| 2 | Isolamento por Máquina (machineCode) nas Operações de Produção | `server/routers/production.ts:88-103` |
| 3 | Validação de Entrada com Zod em Todos os Endpoints | `server/routers/production.ts:56-70` |
| 4 | Senhas Não Armazenadas - Autenticação Via OAuth Externo | `server/_core/sdk.ts:258-320` |
| 5 | Cookies Seguros (HttpOnly, Secure, SameSite=Lax) | `server/localSession.ts:29-37` |
| 6 | Rate Limiting e Timeout no Proxy Firebird | `server/firebirdProxy.ts:424-441` |
| 7 | Sanitização de Inputs Numéricos no Frontend | `client/src/components/ProcessLabelDialog.tsx:212-218` |

### Pontos Fracos (Principais Riscos)

1. Segredos (JWT_SECRET, API Keys, DB passwords) commitados no repositório Git (.project-config.json, .env)
2. Ausência de camada de autorização centralizada (RBAC) — validação manual propensa a erros
3. Endpoints de listagem expõem dados globais sem filtro de tenant/máquina (dashboard, produtos, estoque, clientes)
4. IDOR em consulta de cliente por ID e atualização de status de pedido sem validação de propriedade
5. Validação de startup ausente para credenciais padrão/inseguras

---

## Achados Detalhados

### CHAVES EXPOSTAS

#### 1. Segredos Hardcoded no Arquivo de Configuração do Projeto
- **Severidade:** Crítica
- **Arquivo:** `.project-config.json:24-41`
- **Código:**
```json
secrets: {
  "BUILT_IN_FORGE_API_KEY": "MtgjkV5FtDtUD4tfaCduZd",
  "BUILT_IN_FORGE_API_URL": "https://forge.manus.ai",
  "FIREBIRD_PROXY_TOKEN": "bikraft159753",
  "JWT_SECRET": "EGgZMMBX52nuMLDkiUE6ce",
  "OAUTH_SERVER_URL": "https://api.manus.im",
  "OWNER_OPEN_ID": "fmSSfapuVASX32eUY3tA9Q",
  "VITE_FRONTEND_FORGE_API_KEY": "Qmm6bcczKbQKod5ubfLCZj",
  ...
}
```
- **Descrição:** O arquivo `.project-config.json` contém 17 segredos hardcoded incluindo chaves de API, tokens de autenticação, segredo JWT e URLs de serviços internos. Este arquivo está versionado no repositório Git.
- **Explorabilidade:** Qualquer pessoa com acesso ao repositório Git pode extrair estas credenciais e acessar serviços externos (Forge API, Firebird Proxy, OAuth Server). O JWT_SECRET permite forjar tokens de sessão válidos.
- **Condições:** Acesso de leitura ao repositório Git. Nenhuma condição adicional necessária.
- **Impacto:** Comprometimento total da autenticação (forja de tokens JWT), acesso ao Firebird Proxy (banco de dados de produção), acesso à API Forge (infraestrutura Manus), vazamento de identidade do proprietário (OWNER_OPEN_ID).

#### 2. Credencial Padrão do Firebird em Arquivo .env
- **Severidade:** Crítica
- **Arquivo:** `.env:9`
- **Código:** `FIREBIRD_PASSWORD="masterkey"`
- **Descrição:** O arquivo .env contém a senha padrão "masterkey" do usuário SYSDBA do Firebird, que é a senha padrão conhecida publicamente.
- **Explorabilidade:** Se o Firebird estiver exposto na rede (porta 3050), qualquer atacante pode conectar-se com usuário SYSDBA e senha "masterkey" e ter acesso total ao banco de dados.
- **Condições:** Firebird acessível na rede (porta 3050 aberta). Arquivo .env exposto ou commitado no repositório.
- **Impacto:** Acesso total ao banco de dados Firebird (leitura/escrita/exclusão de todos os dados de produção, pedidos, estoque, usuários). Possível elevação de privilégios no sistema.

#### 3. Token de Proxy Firebird Fraco/Placeholder
- **Severidade:** Alta
- **Arquivo:** `.env:3`
- **Código:** `FIREBIRD_PROXY_TOKEN="crie-um-token-longo"`
- **Descrição:** O arquivo .env contém um token placeholder "crie-um-token-longo" em vez de um segredo criptograficamente seguro.
- **Explorabilidade:** Se o proxy Firebird estiver exposto, qualquer pessoa pode adivinhar ou brute-forçar este token e acessar o proxy, que por sua vez acessa o banco Firebird.
- **Condições:** Proxy Firebird acessível na rede. Token não alterado para valor seguro.
- **Impacto:** Bypass da autenticação do proxy Firebird, levando a acesso indireto ao banco de dados.

#### 4. Validação de Startup Ausente para Credenciais Padrão/Inseguras
- **Severidade:** Alta
- **Arquivo:** `server/firebirdProxy.ts:406-422`
- **Código:**
```typescript
export function getFirebirdProxyConfiguration(env: ProxyEnvironment = process.env as ProxyEnvironment) {
  const rawUrl = env.FIREBIRD_PROXY_URL?.trim();
  const token = env.FIREBIRD_PROXY_TOKEN?.trim();
  if (!rawUrl) throw new Error("FIREBIRD_PROXY_URL não foi configurada.");
  if (!token) throw new Error("FIREBIRD_PROXY_TOKEN não foi configurada.");
  // Não valida se token é "crie-um-token-longo" ou "masterkey"
}
```
- **Descrição:** A aplicação valida apenas se as variáveis de ambiente existem, mas não valida se são seguras. Permite inicialização com credenciais padrão/inseguras.
- **Explorabilidade:** Deploy em produção com valores padrão do .env.example ou valores fracos. A aplicação inicia normalmente sem alertar sobre insegurança.
- **Condições:** Variáveis de ambiente com valores padrão/fracos. Deploy sem revisão de segurança.
- **Impacto:** Sistema roda em produção com credenciais conhecidas/publicamente expostas, facilitando ataques.

#### 5. Chaves de API Frontend Expostas no Bundle
- **Severidade:** Baixa
- **Arquivo:** `.project-config.json:33-40`
- **Código:**
```json
"VITE_ANALYTICS_ENDPOINT": "https://manus-analytics.com",
"VITE_ANALYTICS_WEBSITE_ID": "70809dbb-02a4-4add-a834-c9ff7de511a0",
"VITE_APP_ID": "fUPJURoGTogtcLoydf5tmh",
"VITE_FRONTEND_FORGE_API_KEY": "Qmm6bcczKbQKod5ubfLCZj",
"VITE_FRONTEND_FORGE_API_URL": "https://forge.manus.ai",
"VITE_OAUTH_PORTAL_URL": "https://manus.im"
```
- **Descrição:** Variáveis com prefixo VITE_ são embutidas no bundle do frontend (Vite) e expostas no navegador do usuário. A VITE_FRONTEND_FORGE_API_KEY é uma chave de API exposta publicamente.
- **Explorabilidade:** Qualquer usuário que acesse a aplicação pode inspecionar o bundle JavaScript e extrair estas chaves.
- **Condições:** Acesso à aplicação web (pública ou autenticada). Inspeção de rede ou bundle JS.
- **Impacto:** Uso indevido da API Forge no frontend, vazamento de ID da aplicação, endpoint de analytics. Risco menor pois são chaves "frontend" projetadas para exposição, mas ainda assim expõem superfície de ataque.

### PERMISSÃO DEFINIDA NO NAVEGADOR

#### 6. Ausência de Middleware de Autorização Centralizado
- **Severidade:** Alta
- **Arquivo:** `server/_core/trpc.ts:10-16`
- **Código:**
```typescript
export const adminProcedure = t.procedure;
export const localProtectedProcedure = t.procedure;
export const operatorProcedure = t.procedure;
export const programmerProcedure = t.procedure;
// Custom procedures with role-based access control
// These are aliases for publicProcedure - the role checks are done in the procedure implementation
```
- **Descrição:** Os procedimentos tRPC para diferentes roles (admin, operator, programmer) são apenas aliases de publicProcedure sem validação de middleware. O comentário indica que "role checks are done in the procedure implementation", mas isso cria dependência de implementação manual em cada rota.
- **Explorabilidade:** Um desenvolvedor pode esquecer de adicionar a validação de permissão em uma nova rota, deixando-a exposta. Rotas administrativas como notifyOwner usam adminProcedure que não valida nada.
- **Condições:** Nova rota criada sem validação manual. Ou rota existente modificada removendo validação acidentalmente.
- **Impacto:** Escalonamento de privilégios: usuários comuns podem acessar funcionalidades de administrador, programador ou operador. Vazamento de dados sensíveis entre máquinas/operadores.

#### 7. Endpoint Administrativo sem Validação de Role
- **Severidade:** Média
- **Arquivo:** `server/_core/systemRouter.ts:16-28`
- **Código:**
```typescript
notifyOwner: adminProcedure
  .input(z.object({...}))
  .mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return { success: delivered };
  }),
```
- **Descrição:** O endpoint system.notifyOwner usa adminProcedure, que não implementa nenhuma validação de role de administrador. Qualquer usuário autenticado pode chamar este endpoint.
- **Explorabilidade:** Qualquer usuário com sessão válida (localProtectedProcedure) pode enviar notificações para o proprietário do projeto via API Forge.
- **Condições:** Usuário autenticado no sistema. Conhecimento do endpoint tRPC.
- **Impacto:** Spam de notificações para o proprietário, potencial DoS no serviço de notificação externo, vazamento de que o endpoint existe.

### BANCO SEM TRANCA

#### 8. Falta de Isolamento de Dados por Máquina/Tenant em Consultas Gerais
- **Severidade:** Média
- **Arquivo:** `server/routers/production.ts:77-79, 274-279`
- **Código:**
```typescript
dashboard: localProtectedProcedure.query(() => getProductionDashboard()),
products: router({
  list: localProtectedProcedure.query(() => getProducts(...)),
}),
stock: router({
  list: localProtectedProcedure.query(() => getStock(...)),
})
```
- **Descrição:** Endpoints de listagem geral (dashboard, produtos, estoque, pedidos) não filtram dados por machineCode ou companyCode do usuário autenticado. Retornam dados globais para qualquer usuário autenticado.
- **Explorabilidade:** Qualquer operador autenticado pode visualizar todos os produtos, estoque, pedidos e dashboard de toda a fábrica, não apenas os da sua máquina.
- **Condições:** Usuário autenticado com perfil "operator" ou superior. Acesso às rotas de listagem.
- **Impacto:** Vazamento de informação sensível de produção: volumes de pedidos, estoque total, programação de outras máquinas, dados de clientes/fornecedores. Violação de princípio de menor privilégio.

#### 9. Consulta de Clientes/Participantes sem Filtro de Empresa
- **Severidade:** Média
- **Arquivo:** `server/routers/participants.ts:37-55`
- **Código:**
```typescript
list: consultationProcedure
  .input(z.object({...}))
  .query(({ input }) =>
    getParticipants(
      input.page, input.limit, input.search, input.type, input.status
    )
  )
```
- **Descrição:** O endpoint participants.list retorna todos os participantes (clientes, fornecedores) sem filtrar por companyCode do usuário. O consultationProcedure valida apenas se o usuário tem perfil programmer ou canConfigureStation.
- **Explorabilidade:** Usuários com perfil programmer ou canConfigureStation=true podem listar todos os clientes/fornecedores de todas as empresas.
- **Condições:** Usuário com perfil programmer ou canConfigureStation=true.
- **Impacto:** Vazamento de base de clientes/fornecedores completa, incluindo CNPJ, contatos, endereços, condições comerciais.

### IDOR

#### 10. Endpoint de Detalhe de Cliente por ID sem Validação de Propriedade
- **Severidade:** Média
- **Arquivo:** `server/firebirdProxy.ts, server/routers/participants.ts:475, 56-58`
- **Código:**
```typescript
// firebirdProxy.ts
export const getClient = (codigo: number) => request<ClientRecord>(`/v1/clients/${codigo}`);

// participants.ts
client: consultationProcedure
  .input(z.object({ codigo: z.number().int().positive() }))
  .query(({ input }) => getClient(input.codigo))
```
- **Descrição:** O endpoint participants.client permite buscar qualquer cliente pelo código numérico (codigo) sem verificar se o cliente pertence à empresa do usuário autenticado.
- **Explorabilidade:** Usuário com acesso ao consultationProcedure pode enumerar IDs de clientes (1, 2, 3...) e obter dados completos (CNPJ, endereço, contato, condições comerciais) de clientes de outras empresas.
- **Condições:** Usuário com perfil programmer ou canConfigureStation=true. Conhecimento ou enumeração de códigos de cliente.
- **Impacto:** Vazamento de dados sensíveis de clientes (PII, dados fiscais, condições comerciais) entre empresas/tenants.

#### 11. Atualização de Status de Pedido sem Validação de Propriedade da Máquina
- **Severidade:** Média
- **Arquivo:** `server/routers/production.ts:80-85, server/firebirdProxy.ts:457-462`
- **Código:**
```typescript
// production.ts
updateStatus: programmerProcedure
  .input(processInput.extend({...}))
  .mutation(({ input }) => updateOrderStatus(input));

// firebirdProxy.ts
export const updateOrderStatus = (input: { opCodigo: number; mpCodigo: number; status: string; fila?: number }) =>
  request<{ success: true }>(`/v1/orders/${input.opCodigo}/${input.mpCodigo}/status`, {...})
```
- **Descrição:** O endpoint orders.updateStatus permite alterar o status de qualquer pedido (opCodigo/mpCodigo) sem verificar se o pedido pertence a uma máquina controlada pelo usuário programador.
- **Explorabilidade:** Um programador pode alterar status de pedidos de máquinas que não controla, desde que conheça opCodigo/mpCodigo.
- **Condições:** Usuário com perfil programmer. Conhecimento de opCodigo/mpCodigo de outras máquinas.
- **Impacto:** Manipulação indevida de status de produção de outras máquinas/equipes. Inconsistência de dados, relatórios incorretos.

### INPUTS SEM TRATAMENTO (XSS)

#### 12. Uso de dangerouslySetInnerHTML para Estilos CSS Dinâmicos
- **Severidade:** Baixa (Informativa)
- **Arquivo:** `client/src/components/ui/chart.tsx:81-98`
- **Código:**
```tsx
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES)
      .map(([theme, prefix]) => `...
${colorConfig.map(...).join("\n")}
}
`)
      .join("\n")
  }}
/>
```
- **Descrição:** O componente ChartStyle usa dangerouslySetInnerHTML para injetar variáveis CSS customizadas (--color-*) baseadas na configuração do tema. O conteúdo é gerado a partir de objeto de configuração interno, não de input de usuário.
- **Explorabilidade:** Não explorável atualmente - o conteúdo vem de configuração estática do tema (cores). Não há caminho para input de usuário chegar aqui.
- **Condições:** Nenhuma - código seguro na implementação atual.
- **Impacto:** Baixo risco atual. Porém, se no futuro a configuração de tema vier de input de usuário (ex: personalização), haveria risco de injeção CSS/JS.

---

## Recomendações Priorizadas

### P1 - Crítica

#### 1. Remover Imediatamente Todos os Segredos do Repositório Git
**Achados Relacionados:** CHAVES EXPOSTAS #1, #2, #3
**Ações:**
- Revogar e rotacionar TODAS as chaves expostas: JWT_SECRET, FIREBIRD_PROXY_TOKEN, FIREBIRD_PASSWORD, BUILT_IN_FORGE_API_KEY, OAUTH_SERVER_URL.
- Remover .project-config.json do histórico Git (use git filter-repo ou BFG Repo-Cleaner).
- Remover .env do histórico Git e adicionar ao .gitignore.
- Configurar variáveis de ambiente no ambiente de deploy (não no código).
- Implementar pre-commit hooks (husky + secretlint) para impedir commits futuros com segredos.

#### 2. Implementar Middleware de Autorização Centralizado (RBAC)
**Achados Relacionados:** PERMISSÃO DEFINIDA NO NAVEGADOR #1, #2
**Ações:**
- Criar procedimentos tRPC reais com middleware que validem ctx.user.role e ctx.localUser.operationalProfile.
- Remover validações manuais (throw new Error) das rotas individuais.
- Implementar testes automatizados de autorização para cada role.
- Documentar matriz de permissões por role/endpoint.

### P2 - Alta

#### 3. Validar Segurança de Credenciais no Startup
**Achados Relacionados:** CHAVES EXPOSTAS #4
**Ações:**
- Em getFirebirdProxyConfiguration: rejeitar tokens que correspondam a placeholders conhecidos ("crie-um-token-longo", "changeme", "default").
- Validar que FIREBIRD_PASSWORD não seja "masterkey" ou outras senhas padrão conhecidas.
- Log de warning crítico se credenciais inseguras detectadas em produção (NODE_ENV=production).

#### 4. Implementar Filtro de Tenant/Empresa nas Consultas
**Achados Relacionados:** BANCO SEM TRANCA #1, #2
**Ações:**
- Adicionar companyCode/machineCode como filtro obrigatório em getOrders, getProducts, getStock, getProductionDashboard.
- Para usuários programmer/admin, permitir visualização global (opcional). Para operator, filtrar estritamente pela máquina.
- Aplicar mesmo filtro em participants.list (filtrar por companyCode do usuário).
- Considerar implementar Row Level Security (RLS) no banco Firebird/MySQL como camada adicional.

#### 5. Corrigir IDOR em Endpoints de Detalhe
**Achados Relacionados:** IDOR #1, #2
**Ações:**
- Em participants.client: validar se cliente.codigo pertence à companyCode do usuário antes de retornar.
- Em orders.updateStatus: validar se opCodigo/mpCodigo pertence a uma máquina controlada pelo usuário (via getControlledMachines ou similar).
- Adicionar logs de auditoria para operações de escrita sensíveis (mudança de status, criação de cliente).

### P3 - Média

#### 6. Hardening Adicional
**Achados Relacionados:** INPUTS SEM TRATAMENTO (XSS) #1, Geral
**Ações:**
- Adicionar Content Security Policy (CSP) headers no Express (helmet.js).
- Implementar rate limiting global no Express (express-rate-limit).
- Adicionar validação de origem (CORS) restritiva.
- Mover dangerouslySetInnerHTML no ChartStyle para CSS-in-JS ou style tags seguras.
- Implementar logging de auditoria estruturado (quem acessou o quê, quando).

---

## Issues para GitHub

### --- ISSUE 1 ---
**Título:** [Segurança] Segredos Hardcoded no Arquivo de Configuração do Projeto  
**Labels sugeridas:** security, crítica  

**Descrição do problema:**  
O arquivo .project-config.json contém 17 segredos hardcoded incluindo chaves de API, tokens de autenticação, segredo JWT e URLs de serviços internos. Este arquivo está versionado no repositório Git.

**Evidência:**  
- Arquivo: .project-config.json  
- Linha: 24-41  
- Código:  
```json
secrets: {
  "BUILT_IN_FORGE_API_KEY": "MtgjkV5FtDtUD4tfaCduZd",
  "JWT_SECRET": "EGgZMMBX52nuMLDkiUE6ce",
  "FIREBIRD_PROXY_TOKEN": "bikraft159753",
  ...
}
```

**Impacto:** Comprometimento total da autenticação (forja de tokens JWT), acesso ao Firebird Proxy (banco de dados de produção), acesso à API Forge, vazamento de identidade do proprietário.

**Sugestão de correção:** Ver recomendações P1 no relatório.

**Critérios de aceite:**
- [ ] Segredo removido do repositório e rotacionado
- [ ] Middleware de autorização implementado
- [ ] Validação de propriedade adicionada
- [ ] Testes de segurança passando

--- FIM ISSUE 1 ---

### --- ISSUE 2 ---
**Título:** [Segurança] Credencial Padrão do Firebird em Arquivo .env  
**Labels sugeridas:** security, crítica  

**Descrição do problema:**  
O arquivo .env contém a senha padrão "masterkey" do usuário SYSDBA do Firebird, que é a senha padrão conhecida publicamente.

**Evidência:**  
- Arquivo: .env  
- Linha: 9  
- Código: `FIREBIRD_PASSWORD="masterkey"`

**Impacto:** Acesso total ao banco de dados Firebird (leitura/escrita/exclusão de todos os dados de produção).

--- FIM ISSUE 2 ---

### --- ISSUE 3 ---
**Título:** [Segurança] Token de Proxy Firebird Fraco/Placeholder  
**Labels sugeridas:** security, alta  

**Descrição do problema:**  
O arquivo .env contém um token placeholder "crie-um-token-longo" em vez de um segredo criptograficamente seguro.

**Evidência:**  
- Arquivo: .env  
- Linha: 3  
- Código: `FIREBIRD_PROXY_TOKEN="crie-um-token-longo"`

**Impacto:** Bypass da autenticação do proxy Firebird, acesso indireto ao banco de dados.

--- FIM ISSUE 3 ---

### --- ISSUE 4 ---
**Título:** [Segurança] Ausência de Middleware de Autorização Centralizado  
**Labels sugeridas:** security, alta  

**Descrição do problema:**  
Os procedimentos tRPC para diferentes roles (adminProcedure, operatorProcedure, programmerProcedure) são apenas aliases de publicProcedure sem validação de middleware. Isso permite que novas rotas sejam criadas sem validação de permissões.

**Evidência:**  
- Arquivo: server/_core/trpc.ts  
- Linha: 10-16  
- Código:  
```typescript
export const adminProcedure = t.procedure;
export const operatorProcedure = t.procedure;
export const programmerProcedure = t.procedure;
```

**Impacto:** Escalonamento de privilégios: usuários comuns podem acessar funcionalidades de administrador, programador ou operador.

--- FIM ISSUE 4 ---

### --- ISSUE 5 ---
**Título:** [Segurança] Falta de Isolamento de Dados em Consultas Gerais  
**Labels sugeridas:** security, média  

**Descrição do problema:**  
Endpoints de listagem geral (dashboard, produtos, estoque, pedidos) não filtram dados por machineCode ou companyCode do usuário autenticado. Retornam dados globais para qualquer usuário autenticado.

**Evidência:**  
- Arquivo: server/routers/production.ts  
- Linha: 77-79, 274-279  
- Código:  
```typescript
dashboard: localProtectedProcedure.query(() => getProductionDashboard()),
products: router({ list: localProtectedProcedure.query(() => getProducts(...)) }),
stock: router({ list: localProtectedProcedure.query(() => getStock(...)) })
```

**Impacto:** Vazamento de informação sensível de produção entre máquinas.

--- FIM ISSUE 5 ---

---

## Arquivos Gerados

| Artefato | Caminho |
|----------|---------|
| Relatório HTML (pode ser impresso como PDF via navegador) | `docs/security-audit/relatorio-auditoria-seguranca.html` |
| Relatório Markdown (este arquivo) | `docs/security-audit/relatorio-auditoria-seguranca.md` |
| Script gerador do relatório | `docs/security-audit/generate_report.cjs` |

---

*Relatório gerado automaticamente em 2026-11-18*  
*ProducaoWeb v1.0.0 - Auditoria de Segurança Completa*