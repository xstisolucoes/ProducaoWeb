# Fluxo do operador confirmado no vídeo legado

O operador entra com suas credenciais e a máquina é identificada automaticamente pelo registro do computador local. A tela inicial apresenta a **sequência de máquinas/processos** e a fila liberada para a máquina atribuída. Antes de iniciar, o operador pode consultar quantidades anteriores, reservas, layout de impressão e instruções de pacotes/paletização.

| Etapa | Estado/ação confirmada | Resultado esperado |
|---|---|---|
| 1. Acesso | Login do operador e identificação automática da máquina | Programação filtrada para a máquina do computador. |
| 2. Fila | Seleção de uma OP liberada, prioritariamente na fila inicial | Consulta de detalhes e ações auxiliares antes do início. |
| 3. Início | **Iniciar Processo (F2)** | Abre o apontamento em **Setup Iniciado** com cronômetro. |
| 4. Parada | **Iniciar Parada (F5)**, motivo e confirmação | Parada fica ativa; **Finalizar Parada (F5)** retoma o setup. |
| 5. Setup | **Finalizar Setup (F3)** e resultado Atendido/Cancelado/A Concluir | Em caso de atendimento, exige checklist de liberação de qualidade. |
| 6. Produção | Checklist confirmado | Estado muda para **Produção Iniciada**. |
| 7. Finalização | **Finalizar Produção (F6)** | Solicita lote(s) de matéria-prima e quantidade produzida. |
| 8. Conclusão | **Atendido (F7)** | Processo é atendido, a OP retorna à fila e a sequência seguinte é reavaliada. |

> O programador não executa o apontamento. O seu escopo confirmado é consultar a programação e alterar fila ou processo quando autorizado. O módulo de Transferir Estoque não será alterado nesta etapa.
