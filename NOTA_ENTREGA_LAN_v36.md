# Entrega LAN Completa — XPAPER / Produção Web v36

## Alterações Incluídas

Esta versão assume integralmente os arquivos de interface enviados pelo usuário como referência para tamanhos, cores e organização visual. A infraestrutura Node.js, a integração Firebird por proxy local, os controles de perfil e as regras operacionais previamente existentes foram preservados. A cobertura de regressão foi atualizada apenas para reconhecer a nova composição visual, sem reduzir as verificações das regras de operação.

## Validações

| Verificação | Resultado |
|---|---|
| Testes Vitest | 38 arquivos aprovados; 126 testes aprovados; 1 ignorado |
| TypeScript | Aprovado (`pnpm check`) |
| Build | Aprovado (`pnpm build`) |
| Sintaxe do Proxy | Aprovada (`node --check local-firebird-proxy/server.mjs`) |
| Validação Visual | Tela de acesso verificada em 1280 × 720 |

## Instalação

1. Pare a aplicação e o proxy Firebird local.
2. Faça cópia de segurança de `.env` e `data/` da instalação atual.
3. Extraia o pacote completo sobre a pasta da aplicação.
4. Preserve ou restaure `.env` e `data/`; o pacote não deve substituir esses itens.
5. Instale dependências somente se a instalação local ainda não possuir a versão indicada no `package.json`.
6. Inicie a aplicação e o proxy pelo procedimento operacional habitual.

## Exclusões do Pacote

O pacote não contém `.env`, `data/`, `node_modules/`, `dist/`, logs ou `.git`.

## Aceite LAN

Antes de liberar a operação, valide uma OP real em uma Máquina/Processo autorizada, confirmando o perfil do usuário, a seleção da OP, os status antes e depois da ação e o registro correspondente no Firebird.
