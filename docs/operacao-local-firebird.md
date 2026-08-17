# Operação Local com Firebird

Este projeto foi estruturado para funcionar **dentro da rede local da empresa**. O navegador nunca acessa o Firebird: ele conversa com a aplicação web, cuja camada de servidor consulta um proxy HTTP autenticado. O proxy é o único componente que usa `node-firebird` e deve ser instalado em uma máquina que alcance o serviço Firebird pela LAN.

| Componente | Local recomendado | Responsabilidade |
|---|---|---|
| Aplicação web | Servidor Windows/Linux da LAN ou estação administrativa | Interface, autenticação e procedimentos protegidos. |
| Proxy Firebird | Preferencialmente a mesma máquina da aplicação ou o servidor Firebird | Conexões parametrizadas com o banco e exposição de endpoints permitidos. |
| Firebird | Servidor existente da empresa | Fonte de dados operacional. |

## Inicialização

Crie um arquivo `.env` local, não versionado, na raiz do projeto e defina `FIREBIRD_PROXY_HOST`, `FIREBIRD_PROXY_PORT`, `FIREBIRD_PROXY_TOKEN`, `FIREBIRD_HOST`, `FIREBIRD_PORT`, `FIREBIRD_DATABASE`, `FIREBIRD_USER` e `FIREBIRD_PASSWORD`. Para operação na mesma máquina, mantenha `FIREBIRD_PROXY_HOST=127.0.0.1` e use `FIREBIRD_PROXY_URL=http://127.0.0.1:8787` na configuração da aplicação. Para separar o proxy em outro servidor da LAN, defina um IP privado específico em `FIREBIRD_PROXY_HOST`, use `http://IP_PRIVADO:8787` como URL e libere a porta somente entre os dois hosts no firewall. O proxy utiliza `FIREBIRD_ENCODING=WIN1252` por padrão, adequado ao banco legado; se a base estiver em UTF-8 íntegro, defina explicitamente `FIREBIRD_ENCODING=UTF8`.

Em terminais separados, execute `pnpm firebird:proxy` e `pnpm dev`. Antes de liberar o uso na rede, execute `pnpm test:firebird` **na máquina que enxerga o proxy**. O teste chama `GET /health` com o token e confirma a conexão Firebird, sem alterar registros.

## Acesso local

A interface usa o mesmo usuário ou e-mail e a mesma senha já cadastrados nas tabelas `usuarios`, `funcionarios` e `grupo_usuarios` do Firebird legado. O navegador envia a credencial apenas para a aplicação web local; o backend consulta o proxy autenticado e recebe somente os dados essenciais do operador. Ao validar a senha BCrypt armazenada no Firebird, a aplicação cria uma sessão HTTP protegida, com duração de oito horas.

O proxy também carrega as permissões efetivas de `permissoes`, `usuarios_permissoes` e `grupo_permissoes` com a mesma regra do serviço Delphi. Para autorizar a alteração de status de uma ordem, defina no `.env` o nome exato da permissão cadastrada na sua base, por exemplo `PRODUCTION_STATUS_PERMISSION=PRODUCAO_STATUS_UPDATE`. Se essa variável não for definida, a alteração exige a permissão padrão `PRODUCAO_STATUS_UPDATE`.

| Variável opcional do `.env` | Módulo ou ação controlada |
|---|---|
| `PRODUCTION_MENU_PERMISSION_PROGRAMMING` | Programação e dashboard. |
| `PRODUCTION_MENU_PERMISSION_ORDERS` | Ordens de Produção. |
| `PRODUCTION_MENU_PERMISSION_PRODUCTS` | Produto Venda. |
| `PRODUCTION_MENU_PERMISSION_STOCK` | Transferir Estoque. |
| `PRODUCTION_MENU_PERMISSION_PACKAGES` | Pacotes / Paletização. |
| `PRODUCTION_MENU_PERMISSION_REQUESTS` | Solicitações. |
| `PRODUCTION_MENU_PERMISSION_TRACEABILITY` | Rastreabilidade. |
| `PRODUCTION_STATUS_PERMISSION` | Alteração de status de ordens. |

Defina cada valor com o `perm_name` exato da tabela `permissoes`. Uma variável de menu não definida mantém o item visível; quando definida, o item fica indisponível para operadores sem a permissão correspondente. A alteração de status permanece bloqueada no frontend e no backend até a permissão definida ser encontrada na sessão do operador.

## Programação por máquina e apontamento

### Impressoras da Etiqueta de Processo

A **Etiqueta de Processo** consulta automaticamente as impressoras instaladas no **mesmo Windows que executa o proxy local**. A impressora padrão é exibida primeiro e impressoras offline ficam visíveis, porém indisponíveis para seleção.

> Para que cada operador veja as impressoras da própria estação, o proxy local precisa estar executando naquele computador. Se o proxy estiver em um servidor central, a lista exibida será a das impressoras instaladas nesse servidor.

Como contingência, o `.env` pode listar impressoras adicionais manualmente:

```env
PRODUCTION_LABEL_PRINTERS=Zebra ZT230;Argox OS-214
```

No login local, o proxy procura primeiro a máquina pelo nome do computador atual, comparando-o com `maquinas_processos.MQP_LOGON`; por exemplo, uma estação Windows chamada `DESKTOP-NCNL42A` deve ter esse mesmo valor no cadastro da máquina. Em Raspberry Pi e Orange Pi, é usado o hostname Linux da estação; configure-o com `hostnamectl set-hostname NOME-DA-ESTACAO` e cadastre o mesmo valor em `MQP_LOGON`. O proxy preserva a prioridade de `FIREBIRD_MACHINE_LOGON`; se ela não estiver definida, usa `COMPUTERNAME` no Windows e `HOSTNAME`/`os.hostname()` no Linux. Se não encontrar o nome, usa `usuarios_maquinas` como alternativa. Caso a estação tenha um vínculo diferente, defina `FIREBIRD_MACHINE_CODE` ou `FIREBIRD_MACHINE_LOGON` explicitamente. O perfil operacional usa os grupos `3,4,6` como **programador** por padrão; para ajustar à sua instalação, defina `PRODUCTION_PROGRAMMER_GROUPS` com os códigos separados por vírgula.

| Variável local | Efeito |
|---|---|
| `FIREBIRD_MACHINE_CODE` | Força a máquina exibida e usada para filtrar a fila nesta instalação. |
| `FIREBIRD_MACHINE_LOGON` | Sobrescreve o nome do computador comparado com `maquinas_processos.MQP_LOGON`. |
| `PRODUCTION_PROGRAMMER_GROUPS` | Determina quais grupos operam como programador; os demais são tratados como operador. |
| `PRODUCTION_POINTING_WRITE_ENABLED=S` | Libera a gravação real de **Iniciar setup** para uma ordem de teste. Sem essa variável, a tela é consultável, mas a escrita é bloqueada. |
| `PRODUCTION_STOCK_WRITE_ENABLED=S` | Libera a baixa de `estoque_reservado` e a movimentação de estoque na finalização. Exige também a chave de apontamento e deve ser usada apenas em OP de teste. |
| `PRODUCTION_PROCESS_INSPECTION_INTERVAL_MINUTES` | Intervalo, em minutos, para abrir a Inspeção de Processo enquanto a OP estiver em produção. O padrão é `20`; para teste controlado, use `1` e reinicie o proxy e a aplicação. |
| `FIREBIRD_RESERVE_CORTADA_GROUPS` | Códigos de grupos que usam reserva `Cortada/Vincada`, separados por vírgula. Opcional quando a descrição do grupo contém Impress, Corte ou Vinco. |
| `FIREBIRD_RESERVE_RISCADOR_GROUPS` | Códigos de grupos que usam reservas `Aberta` ou `Revincada`, separados por vírgula. Opcional quando a descrição do grupo contém Risc. |

> Antes de definir `PRODUCTION_POINTING_WRITE_ENABLED=S`, selecione uma OP de teste. O início de setup replica o legado: atualiza `mov_processos` para `mp_status='Em Produção'` e `mp_posicao='SI'`, registra os horários e cria uma linha em `mov_processos_horarios`.

> Durante uma OP em produção, o sistema agenda a **Inspeção de Processo** pelo intervalo configurado. O modal não permite fechar por clique externo, Escape ou cancelamento: todos os itens de `motivos` do tipo `Inspeção de Processo`, vinculados ao grupo da máquina, devem ser selecionados. Na confirmação, o proxy acrescenta o horário ao campo `MOV_PROCESSOS_HORARIOS.MPH_INSPECAO_PROCESSO` do registro ativo da OP.

> A finalização com reserva exige **as duas chaves** de escrita. Ao informar uma quantidade inferior ao saldo reservado, a interface impede o resultado **Atendido** e orienta **Parcial** ou **A Concluir**. Quando houver excedente, o modal informa a quantidade e o percentual acima da reserva antes da confirmação. A baixa da reserva e a chamada da procedure `movimenta_estoque` ocorrem dentro da mesma transação Firebird.

> A comparação com `TSMProducao.InserirMovEstoque` do legado confirma que essa rotina Delphi também chama `execute procedure movimenta_estoque`. Para consumo de matéria-prima, o proxy envia a quantidade com **sinal negativo**, origem `AP`, baixa de estoque `S`, lote reservado, OP e operador da sessão. Assim, a procedure Firebird permanece responsável por gerar o efeito de movimentação mantido pelo sistema legado, inclusive em `prod_compras_estoque` quando essa for a regra da base local.

## Validação controlada de reserva e baixa de estoque

Use uma ordem de teste sem usuários concorrentes — a OP `11343` é a referência indicada para esta validação. A finalização é uma operação de escrita: ela atualiza o processo, reduz o saldo de `estoque_reservado` e executa `movimenta_estoque`. Portanto, registre os saldos antes do teste e mantenha uma cópia de segurança ou um procedimento interno de reversão aprovado pela empresa antes de habilitar as chaves de escrita.

| Etapa | Ação | Resultado esperado |
|---|---|---|
| 1. Preparar | Confirme o grupo da máquina, a OP de teste, o processo em `PI` e que não há parada ativa. Registre os valores atuais de `ER_SALDO` e `ER_STATUS` da OP. | A tela de finalização mostra a reserva aplicável e seu saldo. |
| 2. Habilitar | Defina `PRODUCTION_POINTING_WRITE_ENABLED=S` e `PRODUCTION_STOCK_WRITE_ENABLED=S` no `.env`, reinicie proxy e aplicação e execute `pnpm test:firebird`. | O teste de saúde responde sem escrita e o proxy consegue alcançar o Firebird. |
| 3. Regra de menor quantidade | Informe uma quantidade abaixo do saldo reservado e tente **Atendido**. | O botão Atendido permanece bloqueado; **Parcial** e **A Concluir** permanecem disponíveis. |
| 4. Regra de excedente | Em uma OP de teste apropriada, informe quantidade acima do saldo reservado. | A tela mostra a quantidade e o percentual excedentes e exige confirmação visual antes da gravação. |
| 5. Finalizar | Informe quantidade produzida e perda válidas, selecione o resultado e confirme no modal. | A operação é concluída; o saldo do processo e a reserva são atualizados na mesma transação. |
| 6. Conferir | Consulte `mov_processos`, `estoque_reservado` e o movimento gerado pelo legado para a OP testada. | A soma baixada equivale à quantidade apontada, distribuída entre as reservas abertas do tipo aplicável; a procedure recebe cada baixa como quantidade negativa. |
| 7. Encerrar | Remova ou altere as duas chaves de escrita após o teste. | Novas gravações voltam a ser bloqueadas pelo proxy. |

Para conferir a reserva antes e depois, execute no banco uma consulta somente de leitura semelhante a esta, adaptando os códigos da sua OP:

```sql
select er_codigo, op_codigo, pc_codigo, pc_tipo, er_quantidade, er_saldo, er_status, er_baixado, er_lote
from estoque_reservado
where op_codigo = 11343
order by er_codigo;
```

> Não use uma ordem real de produção para descobrir a regra. Caso a finalização retorne erro, o proxy desfaz toda a transação: não deve permanecer apenas uma baixa de reserva ou apenas uma movimentação de estoque.

## Cronômetro diário da máquina

O proxy consulta `contador_diario_processos` pelo código da máquina e pelo status `Iniciado`. Para uma ordem **Liberada**, o valor disponível em `CDP_CRONOMETRO` é aplicado aos campos de início do setup e do respectivo registro em `mov_processos_horarios`; em seguida o contador é atualizado para o horário corrente. O mesmo consumo do cronômetro ocorre ao concluir setup, liberar o checklist e finalizar a produção, preservando a sequência diária dos horários.

| Situação operacional | Origem do horário | Efeito no contador diário |
|---|---|---|
| Início de setup de Liberado | `CDP_CRONOMETRO` | Avança para o horário atual. |
| Fim de setup, checklist ou finalização | `CDP_CRONOMETRO` | Avança para o horário atual. |
| Retomada de A Concluir | `CURRENT_TIMESTAMP` | Não reabre setup; limpa `MP_FIM` e cria novo ciclo ativo. |
| Encerramento do período | Fluxo futuro | Deve gravar `CDP_FIM` e encerrar o status Iniciado antes da abertura do próximo período. |

> O botão **Finalizar período** ainda não foi exposto na interface. Ele deverá registrar `CDP_FIM` e concluir o contador vigente; no próximo acesso à máquina, um novo período diário poderá ser iniciado.

## Mapeamento confirmado no legado

As rotas iniciais usam as entidades identificadas no código Delphi: `mov_processos` para ordens e status, `produtos_vendas` para itens, `estoque_acabados` e `prod_vendas_estoque` para saldo e histórico. Os status seguem a terminologia existente: **Liberado**, **Em Produção**, **Parcial**, **Atendido** e **Parado**.

> A criação de ordens e de produtos exige validar localmente todas as colunas obrigatórias, geradores e regras do banco antes de habilitar escritas. A alteração de status foi delimitada à atualização já presente no serviço Delphi, evitando inserções especulativas em um banco de produção.
