import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useAuth } from "./AuthProvider";

type BootstrapStatus = {
  available: boolean;
};

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [bootstrapMode, setBootstrapMode] = useState(false);
  const [bootstrapNome, setBootstrapNome] = useState("");
  const [bootstrapLogin, setBootstrapLogin] = useState("");
  const [bootstrapSenha, setBootstrapSenha] = useState("");
  const [bootstrapConfirmacao, setBootstrapConfirmacao] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapSuccess, setBootstrapSuccess] = useState<string | null>(null);
  const [bootstrapSubmitting, setBootstrapSubmitting] = useState(false);

  useEffect(() => {
    if (loading || user) return;

    let active = true;
    apiFetch<BootstrapStatus>("/api/auth/bootstrap-status")
      .then((status) => {
        if (active) setBootstrapAvailable(status.available);
      })
      .catch(() => {
        if (active) setBootstrapAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [loading, user]);

  if (loading) {
    return (
      <main className="centered-state" role="status">
        Carregando...
      </main>
    );
  }

  if (user) {
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

  async function submitBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBootstrapError(null);

    if (bootstrapSenha !== bootstrapConfirmacao) {
      setBootstrapError("As senhas não coincidem.");
      return;
    }

    setBootstrapSubmitting(true);

    try {
      await apiFetch("/api/auth/bootstrap-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: bootstrapNome.trim(),
          login: bootstrapLogin.trim(),
          senha: bootstrapSenha,
        }),
      });

      setBootstrapAvailable(false);
      setBootstrapMode(false);
      setBootstrapSuccess(
        "Cadastro preparado. Agora falta ativar este administrador no D1.",
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "LOGIN_EM_USO") {
        setBootstrapError("Esse login já está em uso.");
      } else if (
        caught instanceof ApiError &&
        caught.code === "BOOTSTRAP_ENCERRADO"
      ) {
        setBootstrapAvailable(false);
        setBootstrapMode(false);
        setBootstrapError("O primeiro administrador já foi preparado.");
      } else if (caught instanceof ApiError && caught.status === 400) {
        setBootstrapError(
          "Confira os dados. A senha precisa ter pelo menos 12 caracteres.",
        );
      } else {
        setBootstrapError(
          "Não foi possível preparar o administrador agora. Tente novamente.",
        );
      }
    } finally {
      setBootstrapSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-toolbar">
          <div className="brand-mark" aria-hidden="true">
            AP
          </div>
          <ThemeToggle />
        </div>

        {bootstrapMode ? (
          <>
            <div className="login-heading">
              <span className="eyebrow">Agenda Prado</span>
              <h1 id="login-title">Preparar administrador</h1>
              <p>
                A conta ficará bloqueada até ser ativada no D1. A senha é
                armazenada somente como hash.
              </p>
            </div>

            <form className="login-form" onSubmit={submitBootstrap}>
              <label>
                <span>Nome</span>
                <input
                  name="nome"
                  value={bootstrapNome}
                  onChange={(event) => setBootstrapNome(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>

              <label>
                <span>Login do administrador</span>
                <input
                  name="bootstrap-login"
                  value={bootstrapLogin}
                  onChange={(event) => setBootstrapLogin(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                <span>Senha do administrador</span>
                <input
                  name="bootstrap-senha"
                  type="password"
                  value={bootstrapSenha}
                  onChange={(event) => setBootstrapSenha(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>

              <label>
                <span>Confirmar senha</span>
                <input
                  name="bootstrap-confirmacao"
                  type="password"
                  value={bootstrapConfirmacao}
                  onChange={(event) =>
                    setBootstrapConfirmacao(event.target.value)
                  }
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>

              {bootstrapError ? (
                <p className="form-error" role="alert">
                  {bootstrapError}
                </p>
              ) : null}

              <button type="submit" disabled={bootstrapSubmitting}>
                {bootstrapSubmitting
                  ? "Preparando..."
                  : "Preparar administrador"}
              </button>
            </form>

            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setBootstrapMode(false);
                setBootstrapError(null);
              }}
            >
              Voltar para login
            </button>
          </>
        ) : (
          <>
            <div className="login-heading">
              <span className="eyebrow">Agenda Prado</span>
              <h1 id="login-title">Entrar</h1>
              <p>Acesse a agenda da sua loja com segurança.</p>
            </div>

            {bootstrapSuccess ? (
              <p className="form-success" role="status">
                {bootstrapSuccess}
              </p>
            ) : null}

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

            {bootstrapAvailable ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setBootstrapMode(true);
                  setBootstrapError(null);
                }}
              >
                Preparar primeiro administrador
              </button>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
