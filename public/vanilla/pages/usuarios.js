// Tela users — JavaScript puro.
export async function showUsers(ctx) {
  const { state, root, $, $$, api, loadStores, heading, panel, table, badge, esc, statusLabel, isCurrent } = ctx;

    const [users] = await Promise.all([api("/api/admin/users"), loadStores()]);
    if (!isCurrent()) return;
    state.users = users;
    root.innerHTML = heading("Cadastros", "Usuários", "Controle de acesso e permissões, sem apagar o histórico.", `<button class="primary" id="new-user">Novo usuário</button>`) +
      panel("Usuários cadastrados", `${users.length} registros`, table(["Nome", "Login", "Perfil", "Loja", "Situação", "Ação"],
        users.map(u => `<tr><td class="cell-primary">${esc(u.nome)}</td><td>${esc(u.login)}</td><td>${esc(statusLabel(u.papel))}</td>
          <td>${esc(state.stores.find(s => s.id === u.lojaId)?.nome || "—")}</td><td>${badge(u.ativo ? "ativo" : "inativo")}</td>
          <td><button class="mini-button" data-edit-user="${esc(u.id)}">Editar</button></td></tr>`)));
    $("#new-user").onclick = () => userDialog(ctx);
    $$("[data-edit-user]").forEach(b => b.onclick = () => userDialog(ctx, users.find(x => x.id === b.dataset.editUser)));
  }
  const userDialog = (ctx, user = null) => {
    const { state, $, esc, field, modal, json, navigate, tell } = ctx;
    const roles = [["conferente", "Conferente"], ["visualizador", "Visualizador"], ["admin", "Administrador"]];
    const body = field("Nome", "nome", user?.nome || "") + field("Login", "login", user?.login || "") +
      `<label class="field">Perfil<select name="papel" id="role-selector">${roles.map(([id, name]) => `<option value="${id}" ${id === (user?.papel || "conferente") ? "selected" : ""}>${name}</option>`).join("")}</select></label>
      <label class="field" id="store-selector">Loja<select name="lojaId"><option value="">Selecione</option>${state.stores.map(s => `<option value="${esc(s.id)}" ${s.id === user?.lojaId ? "selected" : ""}>${esc(s.codigo)} · ${esc(s.nome)}</option>`).join("")}</select></label>
      <label class="field">${user ? "Nova senha (opcional)" : "Senha (mínimo 12 caracteres)"}<input name="senha" type="password" autocomplete="new-password" minlength="12" ${user ? "" : "required"}></label>
      ${user ? `<label class="field">Acesso<select name="ativo"><option value="true" ${user.ativo ? "selected" : ""}>Ativo</option><option value="false" ${user.ativo ? "" : "selected"}>Desativado</option></select></label>` : ""}`;
    const dialog = modal(user ? "Editar usuário" : "Novo usuário", body, "Salvar", async data => {
      if (data.papel === "conferente" && !data.lojaId) throw new Error("Selecione uma loja para o conferente.");
      await json(user ? "PATCH" : "POST", "/api/admin/users", {
        ...(user ? { id: user.id } : {}),
        nome: data.nome.trim(), login: data.login.trim(), papel: data.papel,
        ...(data.papel === "conferente" ? { lojaId: data.lojaId } : {}),
        ...(data.senha ? { senha: data.senha } : {}),
        ...(user ? { ativo: data.ativo === "true" } : {}),
      });
      await navigate(); tell("Usuário atualizado.");
    });
    const role = $("#role-selector", dialog.host);
    const setRole = () => $("#store-selector", dialog.host).hidden = role.value !== "conferente";
    role.onchange = setRole; setRole();
  };
