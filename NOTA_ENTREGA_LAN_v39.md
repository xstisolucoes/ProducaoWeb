# Entrega LAN Completa — XPAPER / Produção Web v39

## Cadastro de Cliente

Esta versão acrescenta a primeira aba interna de **Cliente** ao XPAPER. A partir de **Cadastros → Participantes**, clique em uma linha do tipo Cliente para abrir a aba **Cliente [Código]** sem duplicar o mesmo registro aberto.

Os dados são lidos exclusivamente pelo caminho protegido: navegador, API Node.js/tRPC, proxy Firebird local e Firebird. Não existe acesso direto do navegador ao banco.

## Seções Disponíveis

| Seção              | Dados Apresentados                                               |
| ------------------ | ---------------------------------------------------------------- |
| Dados Gerais       | Participante, razão social, documentos e status                  |
| Endereços          | CEP, endereço, cidade, UF e contatos principais                  |
| Comercial          | Grupo econômico, região, ramo, representante, comissão e frete   |
| Fiscal             | Tributação, natureza fiscal, SUFRAMA, consumidor final e unidade |
| Regras de Produção | Inspeção de produto, amostragem e controle de lote               |
| Contatos           | Estrutura preparada para a próxima etapa de persistência         |

## Limite Atual

A operação de leitura está implementada. Inclusão e alteração continuam bloqueadas até validação das regras de gravação da tabela `PESSOA` e das tabelas-filhas diretamente na LAN.

## Instalação

Antes de extrair o pacote, faça cópia e preserve `.env` e `data/` da instalação atual. O pacote não contém credenciais, dados locais, `node_modules/`, `dist/`, logs ou `.git`.
