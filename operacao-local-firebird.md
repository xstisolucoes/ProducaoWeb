# Operação Local com Firebird

Este projeto foi estruturado para funcionar **dentro da rede local da empresa**. O navegador nunca acessa o Firebird: ele conversa com a aplicação web, cuja camada de servidor consulta um proxy HTTP autenticado. O proxy é o único componente que usa `node-firebird` e deve ser instalado em uma máquina que alcance o serviço Firebird pela LAN.

| Componente | Local recomendado | Responsabilidade |
|---|---|---|
| Aplicação web | Servidor Windows/Linux da LAN ou estação administrativa | Interface, autenticação e procedimentos protegidos. |
| Proxy Firebird | Preferencialmente a mesma máquina da aplicação ou o servidor Firebird | Conexões parametrizadas com o banco e exposição de endpoints permitidos. |
| Firebird | Servidor existente da empresa | Fonte de dados operacional. |

## Inicialização

Crie um arquivo `.env` local, não versionado, na raiz do projeto e defina `FIREBIRD_PROXY_HOST`, `FIREBIRD_PROXY_PORT`, `FIREBIRD_PROXY_TOKEN`, `FIREBIRD_HOST`, `FIREBIRD_PORT`, `FIREBIRD_DATABASE`, `FIREBIRD_USER` e `FIREBIRD_PASSWORD`. Para operação na mesma máquina, mantenha `FIREBIRD_PROXY_HOST=127.0.0.1` e use `FIREBIRD_PROXY_URL=http://127.0.0.1:8787` na configuração da aplicação. Para separar o proxy em outro servidor da LAN, defina um IP privado específico em `FIREBIRD_PROXY_HOST`, use `http://IP_PRIVADO:8787` como URL e libere a porta somente entre os dois hosts no firewall.

Em terminais separados, execute `pnpm firebird:proxy` e `pnpm dev`. Antes de liberar o uso na rede, execute `pnpm test:firebird` **na máquina que enxerga o proxy**. O teste chama `GET /health` com o token e confirma a conexão Firebird, sem alterar registros.

## Mapeamento confirmado no legado

As rotas iniciais usam as entidades identificadas no código Delphi: `mov_processos` para ordens e status, `produtos_vendas` para itens, `estoque_acabados` e `prod_vendas_estoque` para saldo e histórico. Os status seguem a terminologia existente: **Liberado**, **Em Produção**, **Parcial**, **Atendido** e **Parado**.

> A criação de ordens e de produtos exige validar localmente todas as colunas obrigatórias, geradores e regras do banco antes de habilitar escritas. A alteração de status foi delimitada à atualização já presente no serviço Delphi, evitando inserções especulativas em um banco de produção.
