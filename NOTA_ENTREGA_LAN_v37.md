# Entrega LAN Completa — XPAPER / Produção Web v37

## Alterações Incluídas

Esta versão inicia o módulo de **Participantes** no XPAPER. A nova área de trabalho inclui uma Sidebar com a entrada **Participantes**, abas internas persistentes no padrão PageControl e uma Consulta de Participantes com filtros por texto, tipo e status, grid ordenável, paginação e estados de carregamento, vazio e erro.

A consulta trabalha com os tipos **Cliente**, **Fornecedor**, **Outro Participante** e **Representante**. A abertura de uma linha cria uma aba própria, sem duplicar uma consulta já aberta. O detalhe já possui áreas preparadas para **Dados Gerais**, **Contatos**, **Condições de Pagamento** e **Observações**. Todas as leituras do Firebird permanecem exclusivamente no proxy Node.js LAN; o navegador não acessa o banco diretamente.

## Validações

| Verificação       | Resultado                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Testes Vitest     | 40 arquivos aprovados; 132 testes aprovados; 1 ignorado                                           |
| TypeScript        | Aprovado (`pnpm check`)                                                                           |
| Build             | Aprovado (`pnpm build`)                                                                           |
| Sintaxe do Proxy  | Aprovada (`node --check local-firebird-proxy/server.mjs`)                                         |
| Diff              | Aprovado (`git diff --check`)                                                                     |
| Rota de Cadastros | A guarda de autenticação foi verificada; a visualização detalhada requer perfil local autorizado. |

## Validação Necessária na LAN

Antes de habilitar os cadastros de gravação, entre como PCP, Programador ou Administrador e valide uma consulta real nas tabelas `PESSOA`, `CIDADES` e `ESTADOS`. Confirme Código, Tipo, Participante, Razão Social, CNPJ/CPF, Contato, Telefone, Cidade/UF e Status.

## Instalação

1. Pare a aplicação e o proxy Firebird local.
2. Faça cópia de `.env` e `data/` da instalação atual.
3. Extraia o pacote completo sobre a pasta da aplicação.
4. Preserve ou restaure `.env` e `data/`; esses itens não devem ser substituídos pelo pacote.
5. Instale dependências se necessário e inicie aplicação e proxy pelo procedimento LAN habitual.

## Exclusões do Pacote

O pacote não contém `.env`, `data/`, `node_modules/`, `dist/`, logs ou `.git`.
