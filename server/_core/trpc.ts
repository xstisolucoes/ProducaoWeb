// Create tRPC context using initTRPC
import { initTRPC } from "@trpc/server";

// Initialize tRPC
const t = initTRPC.create();

// Export router and procedures
export const router = t.router;
export const publicProcedure = t.procedure;
export const adminProcedure = t.procedure;

// Custom procedures with role-based access control
// These are aliases for publicProcedure - the role checks are done in the procedure implementation
export const localProtectedProcedure = t.procedure;
export const operatorProcedure = t.procedure;
export const programmerProcedure = t.procedure;