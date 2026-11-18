import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@shared/_core/trpc";

export const trpc = createTRPCReact<AppRouter>();
