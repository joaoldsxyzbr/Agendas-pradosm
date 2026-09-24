import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.perfil === "admin" ? "/admin" : "/app"} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const authenticated = await login(loginValue.trim(), senha);
      navigate(authenticated.perfil === "admin" ? "/admin" : "/app", {
        replace: true,
      });
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        (caught.status === 400 || caught.status === 401)
      ) {
        setError("Login ou senha inválidos.");
      } else {
        setError("Não foi possível entrar agora. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">
          AP
        </div>
        <div className="login-heading">
          <span className="eyebrow">Agenda Prado</span>
          <h1 id="login-title">Entrar</h1>
          <p>Acesse a agenda da sua loja com segurança.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Login</span>
            <input
              name="login"
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Senha</span>
            <input
              name="senha"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
