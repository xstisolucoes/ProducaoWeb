import { useLocalAuth } from "@/hooks/useLocalAuth";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import LocalLogin from "./LocalLogin";

/**
 * Mantém a guarda de autenticação da aplicação sem reintroduzir a navegação
 * lateral. A Programação é a tela direta de todos os perfis locais.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useLocalAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <LocalLogin />;

  return <main className="min-h-dvh flex-1 bg-[#f6f7f4] p-3 sm:p-4">{children}</main>;
}
