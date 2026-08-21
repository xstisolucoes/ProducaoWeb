# Atualização Completa — Correções de Regressão

Este pacote contém a **base completa de código** da Produção Web, consolidando as funcionalidades anteriores e as correções mais recentes. Ele deve substituir os pacotes parciais anteriores.

## Recursos conferidos nesta versão

| Área | Comportamento entregue |
|---|---|
| Reserva de matéria-prima | Modal restaurado ao padrão de Quantidades aprovadas, com cabeçalho temático, valores destacados e ordenação por cabeçalho. |
| Grids operacionais | Ordenação crescente/decrescente restaurada nos grids de Programação, Consulta de Fila, Reserva, Quantidades aprovadas, Conjunto, Ordens, Produtos, Estoque e Painel de Produção. |
| Liberação de Produto | Indicadores **Lote**, **Amostra**, **N** e **NC** exibidos novamente; filtro para mostrar somente processos já iniciados ou atendidos anteriormente restaurado. |
| Grade de Liberação | A Programação de Liberação opera com **oito linhas** para manter os comandos e o grid na tela. |
| Horários de processo | O contador diário passa a gravar e retornar o horário atual do Firebird antes dos fechamentos, protegendo `MPH_INICIO ≤ MPH_FIM`. |
| Etiqueta PA | Abertura automática após finalizar permanece exclusiva do grupo de máquina **Apontamento**. |
| Produção Especial | Mantidas as regras de Conjunto por grupo de máquina e os registros de horários das OPs componentes nos fluxos elegíveis. |

## Instalação segura na LAN

Antes de atualizar, encerre os processos `pnpm dev` e `pnpm firebird:proxy`. Faça uma cópia de segurança da pasta atual e preserve obrigatoriamente os arquivos locais `.env` e `data/production-station-bindings.json`.

Extraia este pacote completo em uma nova pasta `producao-web` ou substitua os arquivos da instalação atual. **Não copie `node_modules` de outra máquina**; instale as dependências novamente na pasta atualizada.

```powershell
pnpm install
pnpm test
pnpm build
pnpm firebird:proxy
```

Em outro terminal, inicie a aplicação:

```powershell
pnpm dev
```

Após confirmar o funcionamento, aplique o pacote antigo apenas como backup. As próximas entregas serão geradas como **pacotes completos**, nunca como atualizações parciais.

## Validação recomendada

Na Programação de Liberação, selecione uma OP e confirme os campos Lote, Amostra, N e NC. Marque e desmarque o filtro de processos iniciados. Em seguida, abra a Reserva, alterne o tema Verde/XSTI e clique nos títulos das colunas para confirmar a ordenação.
