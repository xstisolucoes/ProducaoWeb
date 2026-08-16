# Fluxo de parada operacional

O operador inicia uma parada escolhendo um motivo e confirmando o registro. O legado grava uma linha em `historico_paradas` com situação `A` (ativa), processo, ordem, produto, revisão, usuário, máquina e os horários de início e fim inicializados. A retomada altera a situação para `F` e atualiza o horário de fim.

| Elemento | Regra aplicável ao web |
|---|---|
| Fonte dos motivos | Tabela `motivos`. |
| Tipo | `Paradas de Maquina`. |
| Grupo permitido | `motivos.gmq_codigo` deve corresponder ao grupo da máquina do processo (`mov_processos.mqp_codigo` → `maquinas_processos.gmq_codigo`). |
| Registro da parada | `historico_paradas`, situação `A` enquanto aberta. |
| Retomada | Atualiza a situação para `F` e a hora de fim. |
| Finalização de produção | Deve ficar indisponível enquanto existir uma parada ativa da máquina. |

> O modal web exibirá motivos como botões de grande área de toque. A escolha criará o registro de parada e trocará a ação disponível para **Finalizar parada**.
