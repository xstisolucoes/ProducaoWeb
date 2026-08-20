# Atualização da Etiqueta de Processo

1. Feche a aplicação e pare o proxy Firebird no terminal atual com `Ctrl+C`.
2. Extraia o pacote **diretamente dentro de `C:\ProducaoWeb`**, aceitando substituir arquivos. Não extraia criando `C:\ProducaoWeb\producao-web`, pois isso mantém o proxy antigo em execução.
3. Preserve o arquivo `.env` existente de `C:\ProducaoWeb`.
4. No PowerShell aberto em `C:\ProducaoWeb`, execute:

```powershell
pnpm install
pnpm firebird:proxy
```

5. Antes de abrir o sistema, confirme que a última linha do terminal contém:

```text
build 2026-08-20-label-print-v3
```

Se essa identificação não aparecer, o Windows ainda está executando uma cópia antiga de `local-firebird-proxy\server.mjs`.

Depois, em outro terminal na mesma pasta, execute:

```powershell
pnpm dev
```

Na Etiqueta de Processo, a prévia deve ser o PDF final e o botão **Imprimir** deve enviar à impressora selecionada sem abrir PDF no navegador.
