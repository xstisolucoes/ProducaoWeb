# Estrutura confirmada: `CONTADOR_DIARIO_PROCESSOS`

A instalação Firebird local confirmou textualmente a seguinte sequência de campos da tabela `CONTADOR_DIARIO_PROCESSOS`: `CDP_CODIGO`, `MQP_CODIGO`, `CDP_DATA`, `CDP_INICIO`, `CDP_FIM`, `CDP_CRONOMETRO` e `CDP_STATUS`.

| Campo | Uso no ciclo operacional |
|---|---|
| `CDP_CODIGO` | Identificador do registro diário. |
| `MQP_CODIGO` | Máquina vinculada ao contador. |
| `CDP_DATA` | Data de referência do período diário. |
| `CDP_INICIO` | Horário de abertura do contador. |
| `CDP_FIM` | Horário de encerramento do período. |
| `CDP_CRONOMETRO` | Próximo horário sequencial utilizado pelas transições do apontamento. |
| `CDP_STATUS` | Estado do período, com `Iniciado` para o ciclo ativo. |

O proxy seleciona o contador `Iniciado` da data corrente por máquina. Quando encontra somente um contador de data anterior, encerra esse registro com seu último valor de cronômetro e cria o novo período diário. No fechamento de uma produção, o mesmo valor consumido de `CDP_CRONOMETRO` é aplicado a `MP_FIM` e `MPH_FIM` na transação correspondente.
