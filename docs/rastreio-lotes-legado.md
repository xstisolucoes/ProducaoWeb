# Rastreio de lotes na finalização

O legado lista as matérias-primas da ordem pela estrutura de produção e grava o lote interno confirmado em cada item da estrutura.

| Etapa | Tabela e regra confirmada |
|---|---|
| Estrutura da ordem | `ordem_producao_estrutura` (`ope`), filtrada por `op_codigo`, contém `ope_codigo` e o campo de destino `pce_lote`. |
| Vínculo técnico | `prod_vendas_est_produto` (`pvet`) é associado por `pvet_codigo`, `pv_codigo` e `pv_revisao`. |
| Matéria-prima | `pvet.pc_codigo` referencia `produto_de_compras`, de onde vem a descrição e a regra de controle de validade. |
| Validação de lote | `controle_validade.cv_lote_interno` deve corresponder ao lote digitado e ao `pc_codigo` da matéria-prima. |
| Gravação | O legado executa `update ordem_producao_estrutura set pce_lote = :pce_lote where ope_codigo = :ope_codigo`. |

> A interface web abrirá o rastreio antes da finalização da produção. O operador só poderá avançar após validar os lotes exigidos para a estrutura da ordem.
