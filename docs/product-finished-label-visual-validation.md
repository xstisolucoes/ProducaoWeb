# Validação visual — Etiqueta de Produto Acabado

## Referência comparada

Foi comparado o PDF legado `pasted_file_QFMQF7_EtiquetaPACopy.pdf` com a prévia gerada pelo template jsreport em `/tmp/xpaper-product-finished-label-v2.pdf`.

## Achados

| Elemento | Referência | Prévia revisada | Ajuste necessário |
|---|---:|---:|---|
| Título | Arial Black 26 pt | 26 pt | Mantido. |
| Razão social | 24 pt | 24 pt | Ampliar a linha para impedir corte inferior. |
| Cliente | 42 pt | 42 pt | Mantido. |
| Referência | 48 pt | 48 pt | Mantido. |
| Estoque / palete | 48 pt | 48 pt | Mantido. |
| OP / Fabricação | 68 pt / 50 pt | 68 pt / 50 pt | Mantido. |

O ajuste final deve redistribuir a altura interna da grade da etiqueta, priorizando a linha de Razão Social, sem reduzir as escalas tipográficas confirmadas.

## Revisão complementar

A prévia final `xpaper-product-finished-label-v3.pdf` confirmou que a assinatura e o rótulo **Responsável** permanecem íntegros entre a área de inspeção e o QR Code, sem sobreposição. O conteúdo do QR Code foi alterado para o `PV_CODIGO` do produto, validado no template com o exemplo `6000073`.
