# Atualização — Produção Especial

Substitua os arquivos deste pacote preservando a estrutura de pastas, dentro da instalação `producao-web`. Não há novas variáveis de ambiente nem alterações de banco nesta atualização.

Depois de substituir os arquivos, execute os comandos abaixo no diretório do projeto:

```powershell
pnpm install
pnpm check
pnpm firebird:proxy
```

Em outro terminal, inicie a aplicação:

```powershell
pnpm dev
```

## Fluxo incluído

Nas máquinas dos grupos **Liberação de Produto**, **Apontamento** e **Manual**, o Grid principal mostra somente OPs normais e OPs principais. Quando `ORDENS_PRODUCAO.OP_ESPECIAL` estiver preenchido e `OP_PRINCIPAL` for diferente de `N`, a OP principal exibirá a ação **Conjunto**. As OPs componentes, que possuem o mesmo número de `OP_ESPECIAL` e `OP_PRINCIPAL='N'`, ficam ocultas do Grid principal e são exibidas somente ao clicar em **Conjunto**. O diálogo lista OP, Produto, Revisão, Referencial, Código do Produto e Cliente.

Nas demais máquinas, todas as OPs — inclusive as componentes de um conjunto — permanecem visíveis e seguem o apontamento normal, uma OP por vez, sem selo ou painel de Produção Especial.

Ao iniciar uma OP principal nos grupos especiais, o sistema cria ou recupera um único horário ativo em `MOV_PROCESSOS_HORARIOS` para cada OP componente. Ao concluir a OP principal, o sistema atualiza todas as componentes na mesma transação, gravando `MOV_PROCESSOS`, `MOV_PROCESSOS_HORARIOS` e `ORDENS_PRODUCAO`. Para o grupo **Apontamento**, a entrada de estoque acabado também é registrada para cada OP componente.

## Validação sugerida

Use uma OP de teste cuja ordem principal tenha `OP_ESPECIAL` e cujo `OP_PRINCIPAL` seja diferente de `N`. Na máquina de Liberação, Apontamento ou Manual, confirme que as OPs componentes têm o mesmo `OP_ESPECIAL`, `OP_PRINCIPAL='N'` e processo na mesma máquina. Após iniciar a principal, confirme um horário ativo por componente; após finalizar, confira que cada componente recebeu uma única movimentação final em `MOV_PROCESSOS_HORARIOS`.
