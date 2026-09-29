# Entrega LAN Completa — XPAPER / Produção Web v38

## Alteração de Navegação

O XPAPER passa a concentrar todos os módulos na **Sidebar**. A barra superior de módulos foi removida, preservando no cabeçalho apenas a marca XPAPER, o seletor de tema, a identificação da sessão e a saída.

Os módulos disponíveis na Sidebar são Cadastros, Almoxarifado, Compras, Desenvolvimento, Emissor NF, Financeiro, Fiscal, PCP, Qualidade, Vendas, Relatórios, Configurações, Atualizações e Produção. A opção Produção mantém a navegação para o módulo de chão de fábrica.

## Abas Internas

As abas internas no padrão PageControl agora são usadas exclusivamente para consultas, formulários e registros abertos. Estão preparados os fluxos de Consulta de Participantes, detalhes por participante, Clientes, Fornecedores, Outros Participantes, Representantes, Contabilistas, Transportadoras, Condições de Pagamento, Consulta Geral e Relatórios.

Uma mesma tela ou registro não é duplicado ao ser aberto novamente. Cada aba que não seja Início pode ser fechada individualmente.

## Validações

| Verificação      | Resultado                                                 |
| ---------------- | --------------------------------------------------------- |
| Testes Vitest    | 40 arquivos aprovados; 132 testes aprovados; 1 ignorado   |
| TypeScript       | Aprovado (`pnpm check`)                                   |
| Build            | Aprovado (`pnpm build`)                                   |
| Sintaxe do Proxy | Aprovada (`node --check local-firebird-proxy/server.mjs`) |
| Diff             | Aprovado (`git diff --check`)                             |

## Instalação

Antes de extrair o pacote, faça cópia de `.env` e `data/` da instalação atual. Esses itens devem ser preservados após a extração. O pacote não inclui credenciais, dados locais, `node_modules/`, `dist/`, logs ou `.git`.
