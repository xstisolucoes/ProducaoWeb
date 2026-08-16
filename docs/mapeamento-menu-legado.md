# Mapeamento de módulos do legado

O projeto Delphi confirma superfícies operacionais de **Programação**, **Ordens de Produção**, **Produto Venda**, **Transferir Estoque**, **Pacotes / Paletização**, **Solicitações** e **Rastreabilidade**. A aplicação mantém esses nomes na sidebar para preservar a terminologia de operação já conhecida pela equipe.

| Módulo legado identificado | Situação no web | Conduta atual |
|---|---|---|
| Programação | Implementado como ponto de entrada com dashboard | Consulta indicadores e processos recentes. |
| Ordens de Produção | Implementado | Busca, paginação e atualização de status. |
| Produto Venda | Implementado | Consulta paginada do cadastro de itens. |
| Transferir Estoque | Implementado | Saldos e histórico de produção. |
| Pacotes / Paletização | Identificado, pendente | Mantido no menu sem rota provisória; comunica que requer validação da consulta legada. |
| Solicitações | Identificado, pendente | Mantido no menu sem rota provisória; comunica que requer validação do dataset e regras. |
| Rastreabilidade | Identificado, pendente | Mantido no menu sem rota provisória; comunica que requer validação da consulta legada. |

> Um módulo pendente não é redirecionado para outra tela. O clique informa a situação para evitar uma navegação enganosa. A implementação deverá ser ativada somente após a conferência das consultas Firebird da instalação local.
