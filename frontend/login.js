import { ApiError, apiFetch } from "./api.js";
import { homeForRole } from "./routes.js";

// Markup e textos preservados de src/auth/LoginPage.tsx da main.
const loginView = () => `<main class="login-page">
  <section class="login-card" aria-labelledby="login-title">
    <div class="login-toolbar"><img class="brand-icon" src="/agenda-prado-icon.svg" alt="" aria-hidden="true"></div>
    <div class="login-heading">
      <span class="eyebrow">Agenda Prado</span><h1 id="login-title">Entrar</h1>
      <p>Acesse a agenda da sua loja com segurança.</p>
    </div>
    <p class="form-success" role="status" data-login-success hidden></p>
    <form class="login-form" data-login-form>
      <label><span>Login</span><input name="login" autocomplete="username" required></label>
      <label><span>Senha</span><input name="senha" type="password" autocomplete="current-password" required></label>
      <p class="form-error" role="alert" data-login-error hidden></p>
      <button type="submit">Entrar</button>
    </form>
    <section class="quick-login-area" data-quick-login hidden aria-label="Acesso rápido de homologação">
      <h2>Acesso rápido — testes</h2>
      <p>Use o código de homologação para entrar com uma conta de teste.</p>
      <label for="preview-quick-code">Código de testes</label>
      <input id="preview-quick-code" type="password" autocomplete="off"
        placeholder="Informe somente na primeira entrada" data-quick-code>
      <div class="quick-login-actions">
        <button type="button" class="ghost-button" data-quick-role="admin">ADM</button>
        <button type="button" class="ghost-button" data-quick-role="doca1">Doca 1</button>
        <button type="button" class="ghost-button" data-quick-role="visualizador">Visualizador</button>
      </div>
      <p class="form-error" role="alert" data-quick-error hidden></p>
    </section>
    <button type="button" class="ghost-button" data-bootstrap-entry hidden>Preparar primeiro administrador</button>
  </section>
</main>`;

const bootstrapView = () => `<main class="login-page">
  <section class="login-card" aria-labelledby="login-title">
    <div class="login-toolbar"><img class="brand-icon" src="/agenda-prado-icon.svg" alt="" aria-hidden="true"></div>
    <div class="login-heading">
      <span class="eyebrow">Agenda Prado</span><h1 id="login-title">Preparar administrador</h1>
      <p>A conta ficará bloqueada até ser ativada no D1. A senha é armazenada somente como hash.</p>
    </div>
    <form class="login-form" data-bootstrap-form>
      <label><span>Nome</span><input name="nome" autocomplete="name" required></label>
      <label><span>Login do administrador</span><input name="bootstrap-login" autocomplete="username" required></label>
      <label><span>Senha do administrador</span><input name="bootstrap-senha" type="password" autocomplete="new-password" minlength="12" required></label>
      <label><span>Confirmar senha</span><input name="bootstrap-confirmacao" type="password" autocomplete="new-password" minlength="12" required></label>
      <p class="form-error" role="alert" data-bootstrap-error hidden></p>
      <button type="submit">Preparar administrador</button>
    </form>
    <button type="button" class="ghost-button" data-login-entry>Voltar para login</button>
  </section>
</main>`;

function setMessage(element, message) {
  element.textContent = message || "";
  element.hidden = !message;
}

export function renderLogin(root, { auth, navigate, request = apiFetch }) {
  let disposed = false;
  let bootstrapAvailable = false;
  let quickAvailable = false;
  const QUICK_SESSION_KEY = "agenda-prado-preview-quick-code";
  const session = () => {
    try { return root.ownerDocument.defaultView?.sessionStorage ?? null; } catch { return null; }
  };
  let bootstrapSuccess = null;
  const isCurrent = () => !disposed && Boolean(root.querySelector("[data-login-form], [data-bootstrap-form]"));

  const showLogin = () => {
    if (disposed) return;
    root.innerHTML = loginView();
    const form = root.querySelector("[data-login-form]");
    const button = form.querySelector('button[type="submit"]');
    const errorNode = root.querySelector("[data-login-error]");
    const entry = root.querySelector("[data-bootstrap-entry]");
    entry.hidden = !bootstrapAvailable;
    const quick = root.querySelector("[data-quick-login]");
    quick.hidden = !quickAvailable;
    const codeInput = quick.querySelector("[data-quick-code]");
    if (session()?.getItem(QUICK_SESSION_KEY)) {
      codeInput.placeholder = "Código salvo nesta aba; selecione um perfil";
    }
    for (const button of quick.querySelectorAll("[data-quick-role]")) {
      button.addEventListener("click", async () => {
        const stored = session()?.getItem(QUICK_SESSION_KEY) || "";
        const code = codeInput.value.trim() || stored;
        const error = quick.querySelector("[data-quick-error]");
        setMessage(error, null);
        if (!code) { setMessage(error, "Informe o código do ambiente de testes."); return; }
        const buttons = quick.querySelectorAll("[data-quick-role]");
        buttons.forEach(item => { item.disabled = true; });
        try {
          const user = await auth.quickLogin(button.dataset.quickRole, code);
          session()?.setItem(QUICK_SESSION_KEY, code);
          if (isCurrent()) navigate(homeForRole(user.papel), { replace: true });
        } catch (caught) {
          if (!isCurrent()) return;
          if (caught instanceof ApiError && caught.code === "CODIGO_INVALIDO") {
            session()?.removeItem(QUICK_SESSION_KEY);
            setMessage(error, "Código incorreto.");
          } else {
            setMessage(error, "Não foi possível entrar no ambiente de testes.");
          }
        } finally {
          buttons.forEach(item => { item.disabled = false; });
        }
      });
    }
    setMessage(root.querySelector("[data-login-success]"), bootstrapSuccess);
    entry.addEventListener("click", showBootstrap);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      button.disabled = true;
      button.textContent = "Entrando...";
      setMessage(errorNode, null);
      try {
        const user = await auth.login(form.elements.namedItem("login").value.trim(), form.elements.namedItem("senha").value);
        if (isCurrent()) navigate(homeForRole(user.papel), { replace: true });
      } catch (caught) {
        if (!isCurrent()) return;
        setMessage(errorNode, caught instanceof ApiError && [400, 401].includes(caught.status)
          ? "Login ou senha inválidos."
          : "Não foi possível entrar agora. Tente novamente.");
      } finally {
        if (isCurrent() && form.isConnected) {
          button.disabled = false;
          button.textContent = "Entrar";
        }
      }
    });
  };
  const showBootstrap = () => {
    if (disposed || !bootstrapAvailable) return;
    root.innerHTML = bootstrapView();
    const form = root.querySelector("[data-bootstrap-form]");
    const button = form.querySelector('button[type="submit"]');
    const errorNode = root.querySelector("[data-bootstrap-error]");
    root.querySelector("[data-login-entry]").addEventListener("click", showLogin);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      setMessage(errorNode, null);
      const password = form.elements.namedItem("bootstrap-senha").value;
      const confirm = form.elements.namedItem("bootstrap-confirmacao").value;
      if (password !== confirm) {
        setMessage(errorNode, "As senhas não coincidem.");
        return;
      }
      button.disabled = true;
      button.textContent = "Preparando...";
      try {
        await request("/api/auth/bootstrap-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.elements.namedItem("nome").value.trim(),
            login: form.elements.namedItem("bootstrap-login").value.trim(),
            senha: password
          })
        });
        bootstrapAvailable = false;
        bootstrapSuccess = "Cadastro preparado. Agora falta ativar este administrador no D1.";
        showLogin();
      } catch (caught) {
        if (!isCurrent()) return;
        if (caught instanceof ApiError && caught.code === "LOGIN_EM_USO") {
          setMessage(errorNode, "Esse login já está em uso.");
        } else if (caught instanceof ApiError && caught.code === "BOOTSTRAP_ENCERRADO") {
          bootstrapAvailable = false;
          showLogin();
          setMessage(root.querySelector("[data-login-error]"), "O primeiro administrador já foi preparado.");
        } else if (caught instanceof ApiError && caught.status === 400) {
          setMessage(errorNode, "Confira os dados. A senha precisa ter pelo menos 12 caracteres.");
        } else {
          setMessage(errorNode, "Não foi possível preparar o administrador agora. Tente novamente.");
        }
      } finally {
        if (isCurrent() && form.isConnected) {
          button.disabled = false;
          button.textContent = "Preparar administrador";
        }
      }
    });
  };
  showLogin();
  void request("/api/auth/quick-login/status")
    .then(status => {
      if (disposed) return;
      quickAvailable = status.enabled === true;
      const section = root.querySelector("[data-quick-login]");
      if (section) section.hidden = !quickAvailable;
    })
    .catch(() => { quickAvailable = false; });
  void request("/api/auth/bootstrap-status")
    .then(status => {
      if (disposed) return;
      bootstrapAvailable = status.available === true;
      const entry = root.querySelector("[data-bootstrap-entry]");
      if (entry) entry.hidden = !bootstrapAvailable;
    })
    .catch(() => {
      bootstrapAvailable = false;
    });
  return () => { disposed = true; };
}