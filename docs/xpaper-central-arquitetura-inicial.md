# XPAPER — Arquitetura Inicial Integrada

## Objetivo da primeira versão

O XPAPER passa a ter uma **entrada corporativa única** para os módulos administrativos e operacionais, sem desfazer o fluxo já estabilizado de chão de fábrica. A Produção continua como módulo especializado, mas faz parte do mesmo projeto, sessão e integração com o Firebird.

> Nesta primeira versão, somente **Produção** e a estrutura de **Cadastros** estão navegáveis. Os demais módulos aparecem no menu para representar a organização do ERP legado e serão conectados gradualmente aos dados do Firebird.

## Navegação e perfis

| Perfil autenticado                | Tela de entrada | Motivo                                      |
| --------------------------------- | --------------- | ------------------------------------------- |
| Administrador, PCP ou Programador | XPAPER (`/`)    | Escolhe o módulo corporativo ou Produção.   |
| Operador                          | Produção (`/`)  | Mantém o acesso direto à Máquina/Processo.  |
| Apontador, Manual e Qualidade     | Produção (`/`)  | Mantém os fluxos especializados existentes. |

Os perfis são identificados na sessão local já existente. O portal não cria uma segunda senha nem replica usuário; ele reutiliza a sessão autenticada pelo mesmo proxy Firebird que a Produção já utiliza.

## Rotas iniciais

| Rota                                      | Conteúdo                                                                                           | Situação                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `/`                                       | Seletor de módulos do XPAPER para perfis administrativos; Produção direta para perfis operacionais | Implementada                  |
| `/producao`                               | Programação e fluxos existentes de Máquina/Processo                                                | Implementada                  |
| `/xpaper/cadastros`                       | Padrão de consulta inicial de Cadastros                                                            | Implementada como base visual |
| `/apontamento/:opCodigo/:mpCodigo`        | Apontamento do Operador                                                                            | Preservada                    |
| `/apontamento-manual/:opCodigo/:mpCodigo` | Apontamento Manual                                                                                 | Preservada                    |
| `/liberacao-produto/:opCodigo/:mpCodigo`  | Liberação de Produto                                                                               | Preservada                    |

## Módulos do XPAPER

O menu segue a organização observada no legado: **Cadastros, Almoxarifado, Compras, Desenvolvimento, Emissor NF, Financeiro, Fiscal, PCP, Qualidade, Vendas, Relatórios, Configurações, Atualizações e Produção**. Os módulos são agrupados no portal como Gestão, Operação e Administração para facilitar a escolha sem reintroduzir uma barra lateral fixa.

## Padrão de Cadastros: consulta antes da manutenção

A primeira tela de Cadastros já adota o contrato legado de **consulta primeiro**. Ela possui escolha de entidade, pesquisa, status, grade ordenável e barra com **Novo, Alterar, Excluir, Imprimir e Fechar**. A grade permanece propositalmente vazia até a próxima etapa, quando cada entidade será ligada à consulta Firebird correspondente. Isso impede a criação de dados fictícios e preserva a integridade do ERP.

## Integração compartilhada

```text
XPAPER ─┐
                ├── Rotas e API do projeto ─── Proxy Node.js ─── Firebird local
Produção Web ───┘
```

O proxy é único. As novas rotas do XPAPER devem ser acrescidas de forma modular à camada atual, com procedimentos tRPC, validação no servidor, consultas parametrizadas e testes. Nenhum módulo web acessa o Firebird diretamente pelo navegador.

## Próximas etapas sugeridas

| Prioridade | Entrega                                                                 | Dependência                                                   |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1          | Consultas reais de Empresas, Funcionários, Clientes, Produtos e Setores | Mapear SQL legado e permissões.                               |
| 2          | Cadastro genérico com Novo, Alterar, Excluir e Imprimir                 | Definir validações e regra de auditoria.                      |
| 3          | PCP Central com OPs e ligação para Produção                             | Reutilizar regras operacionais existentes.                    |
| 4          | Vendas, Compras, Almoxarifado e Qualidade                               | Migrar módulo por módulo, sem duplicar regras.                |
| 5          | Login/permite único corporativo                                         | Evoluir a sessão local sem interromper a operação da fábrica. |

## Arquivos principais

| Arquivo                                   | Responsabilidade                                    |
| ----------------------------------------- | --------------------------------------------------- |
| `client/src/pages/XPaperPortal.tsx`       | Menu, seletor de módulos e resumo da sessão.        |
| `client/src/pages/XPaperConsultation.tsx` | Primeira tela padrão de consulta de Cadastros.      |
| `client/src/pages/Home.tsx`               | Direcionamento por perfil entre Central e Produção. |
| `client/src/App.tsx`                      | Rotas do portal e do módulo Produção.               |
| `server/routers/localAuth.ts`             | Sessão local reutilizada pelo XPAPER.               |
| `server/firebirdProxy.ts`                 | Comunicação segura com o proxy Firebird.            |
