# Roteiro de validação LAN — RPNC

Antes de confirmar uma RPNC, use uma **ordem de produção de teste** e mantenha uma cópia de consulta das tabelas envolvidas. A escrita do proxy só ocorre quando `PRODUCTION_POINTING_WRITE_ENABLED=S`.

| Etapa | Ação no sistema | Resultado esperado |
|---|---|---|
| 1 | Inicie uma OP de teste e deixe o processo em **Produção Iniciada**. | O botão **Abrir RPNC** fica disponível. |
| 2 | Abra RPNC e selecione **Produto**. | Devem aparecer checklists cujo `CL_TIPO_FORMULARIO` seja `Liberação de Produto`. |
| 3 | Marque um item como **Não Conforme**, informe uma quantidade positiva e, se aplicável, selecione uma causa aparente. | O botão **Confirmar RPNC** é habilitado. |
| 4 | Confirme a janela visual. | O sistema retorna ao apontamento e informa o número anual da RPNC. |
| 5 | Consulte `INSPECAO_PRODUTO`, `RPNC`, `RPNC_NAO_CONFORMIDADES` e `RPNC_CAUSA_NC`. | Os registros devem possuir OP, produto, revisão, máquina, usuário e quantidades compatíveis. |
| 6 | Repita com **Matéria-prima (PO)**. | O lote de `ESTOQUE_RESERVADO` e o fornecedor de `CONTROLE_VALIDADE` devem constar no cabeçalho RPNC. |

> Se a consulta acusar coluna, tabela ou tipo de campo diferente, não repita a confirmação. Envie a mensagem completa do proxy e o resultado do select correspondente para ajustar o mapeamento sem criar registros duplicados.
