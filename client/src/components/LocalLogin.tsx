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
  const stationStorageKey = "production-station-machine-code";
  const manualMachineStorageKey = "production-manual-machine-code";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState<number | null>(null);
  const [machineCode, setMachineCode] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = Number(window.localStorage.getItem(stationStorageKey));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });
  const [manualMachineCode] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = Number(window.localStorage.getItem(manualMachineStorageKey));
    return Number.isInteger(stored) && stored > 0 ? stored : null;
  });
  const { brandTheme } = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const utils = trpc.useUtils();
  const companies = trpc.localAuth.companies.useQuery(undefined, {
    retry: false,
  });
  const persistedStation = trpc.localAuth.station.useQuery(undefined, {
    retry: false,
  });
  const signIn = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      setPassword("");
      window.localStorage.removeItem(manualMachineStorageKey);
      await utils.localAuth.me.invalidate();
      window.location.assign("/");
    },
    onSettled: () => setSubmitting(false),
  });
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || signIn.isPending) return;
    setSubmitting(true);
    signIn.mutate({
      login,
      password,
      companyCode,
      machineCode:
        manualMachineCode ?? persistedStation.data?.machineCode ?? machineCode,
    });
  };
  useEffect(() => {
    if (companyCode || !companies.data?.length) return;
    setCompanyCode(companies.data[0].code);
  }, [companies.data, companyCode]);
  useEffect(() => {
    const persistedCode = persistedStation.data?.machineCode;
    if (!persistedCode || persistedCode === machineCode) return;
    setMachineCode(persistedCode);
    window.localStorage.setItem(stationStorageKey, String(persistedCode));
  }, [machineCode, persistedStation.data?.machineCode]);
  return (
    <main className="theme-login relative grid min-h-screen place-items-center bg-background p-5">
      <img
        src={XPAPER_LOGO_SRC}
        alt="XPAPER — Sistema de Produção"
        className="absolute left-5 top-5 h-14 w-80 object-contain object-left sm:h-16 sm:w-96"
      />
      <div className="absolute right-5 top-5">
        <ThemeConfigurator compact />
      </div>
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dce5dc] bg-white shadow-[0_24px_60px_rgba(18,55,39,0.12)]">
        <div className="theme-login-header px-7 pb-8 pt-9 text-white">
          <div
            className={`grid place-items-center overflow-hidden ${brandTheme === "xsti" ? "h-11 w-40" : "h-11 w-11 rounded-xl bg-[#d6efdf] text-[#166248]"}`}
          >
            {brandTheme === "xsti" ? (
              <img
                src={XPAPER_LOGO_SRC}
                alt="XPAPER"
                className="h-full w-full object-contain object-left"
              />
            ) : (
              <Factory className="h-5 w-5" />
            )}
          </div>
          {/* <p className="mt-7 font-mono text-[10px] tracking-[0.18em] text-[#a9c8b6]">
            Acesso Integrado
          </p> */}
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">
            XPAPER
          </h1>
          {/* <p className="mt-2 text-sm leading-6 text-[#c1d9ca]">
            Entre com Sua Identificação Corporativa. Após Validar o Acesso,
            Perfis Administrativos Escolhem o Módulo; Perfis Operacionais Seguem
            Direto para Produção.
          </p> */}
        </div>
        <form
          onSubmit={submit}
          className="space-y-5 p-7"
          aria-busy={submitting || signIn.isPending}
        >
          <div className="hidden">
            <Label htmlFor="company">Empresa</Label>
            <select
              id="company"
              value={companyCode ?? ""}
              onChange={event =>
                setCompanyCode(
                  event.target.value ? Number(event.target.value) : null
                )
              }
              disabled={companies.isLoading || !companies.data?.length}
            >
              <option value="">
                {companies.isLoading
                  ? "Carregando Empresas…"
                  : "Selecione uma Empresa"}
              </option>
              {companies.data?.map(company => (
                <option key={company.code} value={company.code}>
                  {company.fantasyName ||
                    company.legalName ||
                    `Empresa ${company.code}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="login">Número, Usuário ou E-mail</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849189]" />
              <Input
                id="login"
                autoComplete="username"
                placeholder="Ex.: 25, Operador ou E-Mail"
                value={login}
                onChange={event => setLogin(event.target.value)}
                className="h-11 border-[#dbe3dc] pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#849189]" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="h-11 border-[#dbe3dc] pl-9"
                required
              />
            </div>
          </div>
          {!persistedStation.isLoading &&
          !(persistedStation.data?.machineCode ?? machineCode) ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
              Esta Máquina/Processo Ainda Não Foi Configurada. O Primeiro Acesso
              Deve Ser Realizado por PCP, Programador ou Administrador.
            </p>
          ) : null}
          {signIn.error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {signIn.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting || signIn.isPending}
            className="theme-login-submit h-11 w-full font-bold"
          >
            {submitting || signIn.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validando Acesso…
              </>
            ) : (
              "Entrar no Sistema"
            )}
          </Button>
        </form>
      </section>
    </main>
  );
}
