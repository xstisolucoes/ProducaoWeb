# Correção do teste do proxy no Windows

Este pacote corrige duas situações identificadas na execução local: o teste agora carrega o arquivo `.env` e o comando `pnpm test:firebird` passa a funcionar tanto no PowerShell quanto em Linux.

Extraia o conteúdo do pacote corretivo dentro da raiz do projeto `C:\producao-web`, permitindo a substituição dos arquivos. Não substitua seu arquivo `.env` e não o inclua em nenhum compartilhamento.

Depois, abra dois terminais na raiz do projeto. No primeiro, execute `pnpm install` e `pnpm firebird:proxy`. No segundo, execute `pnpm test:firebird`. O primeiro terminal deve permanecer aberto durante o teste.

Se o teste passar, inicie a interface com `pnpm dev` e abra no navegador o endereço apresentado pelo terminal.
