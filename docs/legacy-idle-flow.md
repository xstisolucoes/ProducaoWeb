# Fluxo legado de ociosidade

O formulário Delphi `U_MotivosOciosidade` grava na tabela `motivo_ociosidade` os campos `mqp_codigo`, `mo_codigo`, `mto_data`, `mto_hora_inicio`, `usu_codigo` e `mto_hora_fim`. Após gravar, atualiza o cronômetro aberto da máquina em `contador_diario_processos.cdp_cronometro`.

| Ação | Regra legada | Resultado operacional |
| --- | --- | --- |
| Limpeza | Exige motivo ativo de ociosidade/limpeza e confirmação | Insere o período no motivo de ociosidade, atualiza o cronômetro e restaura a máquina para **Em Fila**. |
| Fim do período | Usa o motivo fixo `63` | Insere o período no motivo de ociosidade, atualiza o cronômetro e encerra o acesso da estação. |

O código legado usa `AtualizaStatusMaquina('Em Fila', maquina)`, correspondente a `maquinas_processos.mqp_status_processo`, depois do registro concluído.

> Fonte: `U_MotivosOciosidade.pas`, linhas 121–169 e 214–264; `U_SMProducao.pas`, linhas 420–439 e 959–975; `U_Programacao.pas`, linhas 688–723.
