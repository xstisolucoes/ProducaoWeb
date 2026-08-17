import { useEffect, useState } from "react";
import { Factory, KeyRound, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ThemeConfigurator } from "@/components/ThemeConfigurator";
import { useTheme } from "@/contexts/ThemeContext";
import { XPAPER_LOGO_SRC } from "@/lib/xpaperLogo";

export default function LocalLogin() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState<number | null>(null);
  const { brandTheme } = useTheme();
  const utils = trpc.useUtils();
  const companies = trpc.localAuth.companies.useQuery(undefined, { retry: false });
  const signIn = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      await utils.localAuth.me.invalidate();
    },
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen().catch(() => undefined);
    signIn.mutate({ login, password, companyCode });
  };
  useEffect(() => {
    if (companyCode || !companies.data?.length) return;
    setCompanyCode(companies.data[0].code);
  }, [companies.data, companyCode]);
  return (
    <main className="theme-login relative grid min-h-screen place-items-center bg-background p-5">
      <img src={XPAPER_LOGO_SRC} alt="XPAPER — Sistema de Produção" className="absolute left-5 top-5 h-14 w-80 object-contain object-left sm:h-16 sm:w-96" />
      <div className="absolute right-5 top-5"><ThemeConfigurator compact /></div>
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dce5dc] bg-white shadow-[0_24px_60px_rgba(18,55,39,0.12)]">
        <div className="theme-login-header px-7 pb-8 pt-9 text-white">
          <div className={`grid place-items-center overflow-hidden ${brandTheme === "xsti" ? "h-11 w-40" : "h-11 w-11 rounded-xl bg-[#d6efdf] text-[#166248]"}`}>{brandTheme === "xsti" ? <img src={XPAPER_LOGO_SRC} alt="XPAPER" className="h-full w-full object-contain object-left" /> : <Factory className="h-5 w-5" />}</div>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.18em] text-[#a9c8b6]">Acesso local</p><h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">Produção</h1><p className="mt-2 text-sm leading-6 text-[#c1d9ca]">Entre com o mesmo usuário e senha cadastrados no sistema de produção.</p>
        </div>
        <form onSubmit={submit} className="space-y-5 p-7">
          <div className="space-y-2"><Label htmlFor="company">Empresa</Label><select id="company" value={companyCode ?? ""} onChange={(event) => setCompanyCode(event.target.value ? Number(event.target.value) : null)} disabled={companies.isLoading || !companies.data?.length} className="h-11 w-full rounded-md border border-[#dbe3dc] bg-white px-3 text-sm font-bold text-[#294438] outline-none focus:border-[#177458]"><option value="">{companies.isLoading ? "Carregando empresas…" : "Selecione a empresa"}</option>{companies.data?.map((company) => <option key={company.code} value={company.code}>{company.fantasyName || company.legalName || `Empresa ${company.code}`}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="login">Usuário ou e-mail</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849189]" /><Input id="login" autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} className="h-11 border-[#dbe3dc] pl-9" required /></div></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849189]" /><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 border-[#dbe3dc] pl-9" required /></div></div>
          {companies.error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Não foi possível listar as empresas. O cadastro do usuário será utilizado.</p>}{signIn.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{signIn.error.message}</p>}
          <Button type="submit" disabled={signIn.isPending} className="theme-login-submit h-11 w-full font-bold">{signIn.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validando acesso…</> : "Entrar no sistema"}</Button>
        </form>
      </section>
    </main>
  );
}
