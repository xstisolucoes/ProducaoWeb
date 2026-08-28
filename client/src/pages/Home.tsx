import { useLocalAuth } from "@/hooks/useLocalAuth";
import Programming from "./Programming";
import XPaperPortal from "./XPaperPortal";

export default function Home() {
  const { user } = useLocalAuth();

  // Perfis administrativos entram pelo XPAPER Central e escolhem o módulo.
  // Os perfis de operação mantêm a abertura direta do chão de fábrica.
  if (user?.canConfigureStation || user?.operationalProfile === "programmer") return <XPaperPortal />;
  return <Programming />;
}
