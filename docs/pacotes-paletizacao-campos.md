# Pacotes / Paletização — vínculo de campos Firebird

O painel operacional de **Pacotes / Paletização** segue a disposição da tela Delphi de referência. Os valores são consultados pelo proxy local em `prod_vendas_paletizacao`, para o produto e a revisão do processo atual, usando primeiro o cadastro específico do cliente e, na falta dele, o cadastro padrão (`PES_CODIGO = 0`).

| Área exibida | Rótulo no painel | Campo Firebird | Alias do proxy / contrato web |
|---|---|---|---|
| Pacotes | Tipo | `PVP_PACOTE_TIPO` | `package_type` / `packageType` |
| Pacotes | Qtde | `PVP_PACOTE_QUANTIDADE` | `package_quantity` / `packageQuantity` |
| Pacotes | Fitas Pacote L | `PVP_PACOTE_FITAS_LARG` | `package_straps_width` / `packageStrapsWidth` |
| Pacotes | Fitas Pacote C | `PVP_PACOTE_FITAS_COMP` | `package_straps_length` / `packageStrapsLength` |
| Palete | Tipo do Palete | `PALETE.PALETE_DESCRICAO` | `pallet_description` / `palletDescription` |
| Palete | Remontado | `PVP_REMONTADO` | `remounted` |
| Palete | Altura Máxima do Palete | `PVP_PALETE_PACOTE_ALTURA_MAX` | `maximum_height` / `maximumHeight` |
| Palete | Medidas L | `PALETE.PALETE_LARGURA` | `pallet_width` / `palletWidth` |
| Palete | Medidas C | `PALETE.PALETE_COMPRIMENTO` | `pallet_length` / `palletLength` |
| Palete | Lastro L | `PVP_PALETE_PACOTE_LASTRO` | `packages_per_layer` / `packagesPerLayer` |
| Palete | Qtde de Pacotes na Altura | `PVP_PALETE_PACOTE_ALTURA` | `packages_high` / `packagesHigh` |
| Palete | Total Pacotes | `PVP_PALETE_PACOTE_TOTAL` | `total_packages` / `totalPackages` |
| Palete | Total de Unid | `PVP_PALETE_TOTAL_PRODUTOS` | `total_products` / `totalProducts` |
| Complementos | Arqueado | `PVP_PALETE_ARQUEADO` | `arched` |
| Complementos | Espelho | `PVP_PALETE_ESPELHADO` | `mirrored` |
| Complementos | Cantoneira | `PVP_PALETE_CANTONEIRA` | `cornerProtector` |
| Complementos | Filme Stretch | `PVP_PALETE_FILME_STRETCH` | `stretchFilm` |
| Complementos | Fitas no Palete L | `PVP_PALETE_FITAS_LARG` | `pallet_straps_width` / `palletStrapsWidth` |
| Complementos | Fitas no Palete C | `PVP_PALETE_FITAS_COMP` | `pallet_straps_length` / `palletStrapsLength` |
| Observação | Observação | `PVP_OBSERVACAO` | `observation` |
| Imagem | Desenho do palete | `PALETE.PALETE_JSON` | `pallet_image_path` → `imageDataUri` |

> A imagem de `PALETE_JSON` é priorizada. `LASTRO.LASTRO_JSON` continua somente como alternativa quando não existir uma imagem cadastrada para o palete.

Os campos já retornados pelo proxy, porém não presentes na referência visual fornecida, permanecem disponíveis para uma próxima tela ou ampliação: medidas e peso do pacote, altura do palete, descrição do lastro, aproveitamento de área, etiquetas e altura/comprimento montados.
