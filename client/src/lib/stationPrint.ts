/**
 * Impressão pela própria estação.
 *
 * O proxy lista as impressoras do Windows em que ele roda — que, na operação
 * atual, é o servidor central. A estação do operador tem as impressoras
 * dela, e o navegador é o único componente que enxerga essa fila: abrindo o
 * diálogo de impressão nativo, o sistema já lista as impressoras instaladas
 * localmente e o operador confirma antes de sair o papel.
 *
 * Não existe API web para enumerar impressoras, então a opção local não pode
 * vir preenchida: ela aparece como uma entrada única e a escolha acontece no
 * diálogo do sistema.
 */

/** Valor sintético da opção local. Não colide com nome de impressora real. */
export const STATION_PRINTER_OPTION = "__station_native__";

export const STATION_PRINTER_LABEL =
  "Impressora desta estação (nativa)";

export type ProxyPrinter = { name: string; isDefault: boolean; offline: boolean };

export type PrinterChoice = {
  /** Valor do <option>: nome da impressora ou STATION_PRINTER_OPTION. */
  value: string;
  /** Texto exibido, já com os marcadores de origem e estado. */
  label: string;
  isStation: boolean;
  /** Impressora do servidor sem resposta — aparece, mas não pode ser escolhida. */
  offline: boolean;
};

/**
 * Monta as opções do seletor: primeiro a impressora da estação (que é a
 * padrão, por ser a que o operador tem ao lado), depois as do proxy. Nomes
 * configurados em PRODUCTION_LABEL_PRINTERS entram quando ainda não vieram
 * na consulta, para não sumir da lista.
 */
export function buildPrinterChoices(
  printers: ProxyPrinter[],
  manualNames: string[] = [],
): PrinterChoice[] {
  const choices: PrinterChoice[] = [
    {
      value: STATION_PRINTER_OPTION,
      label: `${STATION_PRINTER_LABEL} — padrão`,
      isStation: true,
      offline: false,
    },
  ];
  const known = new Set(printers.map((printer) => printer.name));

  const fromProxy = [...printers]
    .sort(
      (left, right) =>
        Number(right.isDefault) - Number(left.isDefault) ||
        left.name.localeCompare(right.name, "pt-BR")
    )
    .map((printer) => ({
      value: printer.name,
      label: `${printer.name} (servidor)${printer.isDefault ? " (padrão)" : ""}${printer.offline ? " (offline)" : ""}`,
      isStation: false,
      offline: printer.offline,
    }));

  const manual = manualNames
    .filter((name) => !known.has(name))
    .sort((left, right) => left.localeCompare(right, "pt-BR"))
    .map((name) => ({
      value: name,
      label: `${name} (servidor)`,
      isStation: false,
      offline: false,
    }));

  return [...choices, ...fromProxy, ...manual];
}

/**
 * Envia o PDF ao diálogo de impressão do sistema, que apresenta as
 * impressoras da estação. O iframe precisa ficar no documento para que o
 * navegador aceite a chamada a print() (janela em segundo plano é bloqueada).
 */
export async function printWithStationDialog(pdfDataUrl: string): Promise<void> {
  if (!pdfDataUrl) throw new Error("A prévia da etiqueta não está disponível.");

  const blob = await fetch(pdfDataUrl).then((response) => response.blob());
  const objectUrl = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.border = "0";
  frame.style.opacity = "0";

  await new Promise<void>((resolve) => {
    // WebViews e alguns navegadores não emitem load para PDF; o prazo evita
    // travar a tela quando isso acontece.
    const settle = window.setTimeout(resolve, 3000);
    frame.addEventListener(
      "load",
      () => {
        window.clearTimeout(settle);
        resolve();
      },
      { once: true }
    );
    frame.src = objectUrl;
    document.body.appendChild(frame);
  });

  try {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  } finally {
    // O PDF fica carregado enquanto o diálogo estiver aberto; a limpeza
    // acontece depois para não cancelar a impressão em andamento.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
  }
}