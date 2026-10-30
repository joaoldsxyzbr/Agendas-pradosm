import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { homeForRole, login } from "./session";
import { useSession } from "@/app/session-query";

export function LoginPage() {
  const { data: user, isPending, isError, refetch } = useSession();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const signin = useMutation({
    mutationFn: () => login(loginValue.trim(), senha),
    onSuccess: (person) => {
      client.setQueryData(["session"], person);
      navigate(homeForRole(person.papel), { replace: true });
    },
    onError: (error) => {
      setErrorMessage(error instanceof ApiError ? error.message : "Não foi possível entrar. Tente novamente.");
    },
  });
  if (isPending) return <main className="grid min-h-svh place-items-center text-slate-400">Verificando sessão…</main>;
  if (isError) return <main className="grid min-h-svh place-items-center gap-3 p-5">
    <p role="alert">Não foi possível verificar a sessão.</p>
    <Button onClick={() => void refetch()}>Tentar novamente</Button>
  </main>;
  if (user) return <Navigate to={homeForRole(user.papel)} replace />;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    if (loginValue.trim() && senha) signin.mutate();
  };
  return <main className="flex min-h-svh items-center justify-center bg-[#101923] p-4">
    <section aria-labelledby="login-title" className="w-full max-w-sm rounded-xl border border-slate-700 bg-[#172638] p-6 shadow-2xl">
      <div className="mb-5 inline-flex size-11 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15 text-sky-300"><LockKeyhole aria-hidden="true" size={22} /></div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-sky-400">Agenda Prado</p>
      <h1 id="login-title" className="mt-1 text-2xl font-bold tracking-tight text-white">Entrar</h1>
      <p className="mt-2 text-sm text-slate-400">Acesse sua operação com segurança.</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">Login
          <input name="login" autoComplete="username" required value={loginValue} onChange={(event) => setLoginValue(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-600 bg-[#101e30] px-3 text-sm text-white outline-none focus-visible:border-sky-400" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">Senha
          <input name="senha" type="password" autoComplete="current-password" required value={senha} onChange={(event) => setSenha(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-600 bg-[#101e30] px-3 text-sm text-white outline-none focus-visible:border-sky-400" />
        </label>
        {errorMessage && <p role="alert" className="text-xs text-rose-300">{errorMessage}</p>}
        <Button type="submit" disabled={signin.isPending} className="mt-1 w-full">{signin.isPending ? "Entrando…" : "Entrar"}</Button>
      </form>
      <p className="mt-5 text-center text-[11px] text-slate-500">Base React em migração · ambiente de desenvolvimento</p>
    </section>
  </main>;
}
