# RPNC — regras legadas confirmadas

## Fluxo de operador

O operador acessa **Abrir RPNC** enquanto a produção está iniciada. A tela oferece duas origens: **Produto**, que usa o tipo de formulário `Liberação de Produto`, e **Matéria-prima (PO)**, que usa `Inspeção de Recebimento`.

No vídeo de referência, o operador marca a categoria e o item detalhado como **Não Conforme**, informa a quantidade e, para produto, seleciona as causas aparentes. Os exemplos mostrados foram `Defeitos de Impressão` → `Ausência de Impressão` → quantidade `1000` → causa `Chapa Amassada`; e, para matéria-prima, `Carregamento e transporte` → `Carga tombada, risco de acidente na abertura das Lonas` → quantidade `1000`.

## Consulta de checklist

| Entidade | Campos empregados | Relação |
|---|---|---|
| `CHECK_LIST` | `CL_CODIGO`, `CL_DESCRICAO`, `CL_DESCRICAO_COMPLETA`, `CL_STATUS`, `CL_TIPO_FORMULARIO`, `CL_TIPO_INSPECAO` | Filtrar por `CL_TIPO_FORMULARIO` conforme a origem |
| `ITENS_CHECK_LIST` | `ICL_CODIGO`, `CL_CODIGO`, `ICL_DESCRICAO`, `ICL_DEFINICAO`, `ICL_CAMINHO_DOC`, `ICL_STATUS` | Filtrar pelo checklist selecionado |
| `CAUSA_APARENTE` | `CA_CODIGO`, `CA_DESCRICAO`, `CL_CODIGO`, `ICL_CODIGO`, `CA_STATUS` | Filtrar por checklist e item não conforme |

Para matéria-prima, o lote vem de `ESTOQUE_RESERVADO.ER_LOTE` da OP e o fornecedor é obtido de `CONTROLE_VALIDADE.PES_CODIGO`, relacionado por `CV_LOTE_INTERNO = ER_LOTE`.

## Gravação transacional esperada

Quando existir ao menos uma não conformidade, gravar na mesma transação: `INSPECAO_PRODUTO` para cada item; um cabeçalho em `RPNC`; uma linha em `RPNC_NAO_CONFORMIDADES` por item; e uma linha em `RPNC_CAUSA_NC` para cada causa selecionada. Para a origem Produto, o legado também cria a ação padrão em `RPNC_ACOES_PRODUTO_NC`.

> As gravações permanecem bloqueadas até `PRODUCTION_POINTING_WRITE_ENABLED=S`, de modo que a primeira execução deve ocorrer em uma ordem de teste controlada na LAN.
