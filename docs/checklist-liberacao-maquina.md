# Checklist de liberação de máquina

Após o operador marcar o setup como **Atendido**, o Delphi abre um checklist obrigatório antes de finalizar o setup e iniciar a produção. O checklist é composto por caixas inicialmente desmarcadas. O operador só prossegue quando todos os itens forem confirmados.

| Aspecto | Regra observada no legado |
|---|---|
| Origem dos itens | Tabela `motivos`. |
| Tipo de motivo | `Liberação de Máquina`. |
| Filtro da máquina | `motivos.gmq_codigo` igual ao grupo da máquina atual. |
| Regra de confirmação | Todos os itens precisam estar marcados. |
| Transição posterior | Após confirmar o checklist, o legado finaliza o setup e libera o início da produção. |

> As opções **A Concluir** e **Cancelado** não abrem o checklist. Elas encerram o setup diretamente com seus respectivos estados operacionais.
