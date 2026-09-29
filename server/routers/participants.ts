import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createClient, getClient, getParticipants } from "../firebirdProxy";
import { localProtectedProcedure, router } from "../_core/trpc";

const participantType = z.enum([
  "Todos",
  "Cliente",
  "Fornecedor",
  "Outro Participante",
  "Representante",
]);

const participantStatus = z.enum(["Todos", "Ativo", "Inativo"]);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
const optionalCode = z.number().int().positive().optional().nullable();
const optionalDecimal = z.number().min(0).max(100).optional().nullable();
const yesNo = z.enum(["S", "N"]).optional().nullable();

const consultationProcedure = localProtectedProcedure.use(({ ctx, next }) => {
  const hasCentralAccess =
    ctx.localUser.canConfigureStation ||
    ctx.localUser.operationalProfile === "programmer";

  if (!hasCentralAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A Consulta de Participantes Está Disponível Apenas no XPAPER.",
    });
  }

  return next({ ctx });
});

export const participantsRouter = router({
  list: consultationProcedure
    .input(
      z.object({
        page: z.number().int().min(1).max(100000).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(120).default(""),
        type: participantType.default("Todos"),
        status: participantStatus.default("Ativo"),
      })
    )
    .query(({ input }) =>
      getParticipants(
        input.page,
        input.limit,
        input.search,
        input.type,
        input.status
      )
    ),
  client: consultationProcedure
    .input(z.object({ codigo: z.number().int().positive() }))
    .query(({ input }) => getClient(input.codigo)),
  createClient: consultationProcedure
    .input(
      z.object({
        fantasia: z
          .string()
          .trim()
          .min(2, "Informe o Nome do Cliente.")
          .max(30),
        razaoSocial: z
          .string()
          .trim()
          .min(2, "Informe a Razão Social.")
          .max(180),
        cnpj: optionalText(30),
        cpf: optionalText(20),
        rg: optionalText(30),
        inscricaoEstadual: optionalText(30),
        inscricaoMunicipal: optionalText(30),
        cep: optionalText(12),
        endereco: optionalText(180),
        numero: optionalText(20),
        complemento: optionalText(100),
        bairro: optionalText(100),
        cidadeCodigo: z.number().int().positive().optional().nullable(),
        contato: optionalText(120),
        telefone: optionalText(30),
        celular: optionalText(30),
        email: z
          .string()
          .trim()
          .email("Informe um E-mail Válido.")
          .max(180)
          .optional()
          .nullable()
          .or(z.literal("")),
        grupoEconomicoCodigo: optionalCode,
        regiaoCodigo: optionalCode,
        ramoAtividadeCodigo: optionalCode,
        representanteCodigo: optionalCode,
        comissao: optionalDecimal,
        tributacaoCodigo: optionalCode,
        variacaoProducaoMais: optionalDecimal,
        variacaoProducaoMenos: optionalDecimal,
        tipoFrete: z.number().int().min(0).max(9).optional().nullable(),
        suframa: optionalText(20),
        consumidorFinal: yesNo,
        exigeLaudoTecnico: yesNo,
        unidadeMedida: optionalText(20),
        inspecionarProduto: yesNo,
        amostragem: yesNo,
        controlarLote: yesNo,
        tipoDocumentoCodigo: optionalCode,
        tipoOperacaoCodigo: optionalCode,
        status: z.enum(["Ativo", "Inativo"]).default("Ativo"),
      })
    )
    .mutation(({ input }) =>
      createClient({ ...input, email: input.email || null })
    ),
});
