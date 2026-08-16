# Reservas e movimentação na finalização

A finalização web deverá avaliar somente reservas ainda não atendidas e aplicar a regra de reserva adequada ao grupo de máquina. O usuário confirmou que **Impressoras** e **Corte/Vinco** usam o tipo `Cortada/Vincada`, enquanto **Riscador** usa `Aberta` ou `Revincada`. Outros grupos não exigem reserva para finalizar.

| Elemento | Regra de implementação |
|---|---|
| Reserva aberta | Consulta `estoque_reservado` com status diferente de `Atendido`. |
| Valor de referência | `er_quantidade` e `er_saldo`; na OP de teste 11343, ambos são 1210. |
| Resultado abaixo da reserva | Não permite **Atendido**; orienta **Parcial** ou **A Concluir**. |
| Resultado acima da reserva | Permite a finalização, mas mostra a quantidade e o percentual excedentes em modal de cuidado. |
| Baixa de reserva | O legado atualiza `er_status`, `er_baixado` e subtrai a quantidade de `er_saldo`. |
| Movimento de estoque | O legado chama `movimenta_estoque` por `InserirMovEstoque`, usando origem `AP`, baixa de estoque `S`, OP, lote, fornecedor e localização. |

> A operação web deve executar a atualização da produção, a baixa de reserva e a movimentação de estoque em uma única transação Firebird, com a escrita ainda protegida pela configuração local de validação.
