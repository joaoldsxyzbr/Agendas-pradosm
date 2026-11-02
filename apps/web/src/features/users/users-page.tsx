import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import type { Store } from "@/features/receiving/model";
import { listStores, storesKey } from "@/features/stores/api";
import {
  ROLE_LABELS, filterUsers, listUserAudit, listUsers, saveUser, setUserActive,
  usersKey, validUser, type AdminUser, type UserForm,
} from "./api";

const surface = "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#344d69] bg-[#142338] shadow-lg";
const input = "h-9 min-w-0 w-full rounded-md border border-[#48617b] bg-[#192d46] px-3 text-xs text-white outline-none focus-visible:border-sky-400";
const errorText = (e: unknown) => e instanceof ApiError ? e.message : "A operação não pôde ser concluída. Tente novamente.";
const auditActions: Record<string, string> = {
  usuario_criado: "Usuário criado", usuario_atualizado: "Usuário atualizado",
  usuario_removido: "Usuário removido", admin_bootstrap_preparado: "Administrador preparado",
};
function auditValue(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  return Object.entries(value).filter(([key]) => key !== "senha" && key !== "token").map(([key, item]) => {
    const labels: Record<string, string> = {
      nome: "nome", login: "login", codigo: "código", ativo: "status", lojaId: "loja",
    };
    const label = labels[key] ?? key;
    if (key === "senhaAlterada") return item ? "senha alterada" : null;
    return label + ": " + (typeof item === "boolean" ? item ? "sim" : "não" : String(item ?? "-"));
  }).filter(Boolean).join(" · ");
}

function StoreSelect({ form, setForm, stores, editing }: {
  form: UserForm; setForm: (update: (value: UserForm) => UserForm) => void;
  stores: Store[]; editing: boolean;
}) {
  const choices = editing ? stores : stores.filter(store => store.ativo);
  return <label className="grid gap-1.5 text-xs font-semibold text-slate-300 sm:col-span-2">Loja
    <select className={input} name="lojaId" value={form.lojaId} required
      onChange={event => setForm(value => ({ ...value, lojaId: event.target.value }))}>
      <option value="">Selecione</option>
      {choices.map(store => <option key={store.id} value={store.id}>
        {`${store.codigo} - ${store.nome}${editing && !store.ativo ? " (inativa)" : ""}`}
      </option>)}
    </select>
  </label>;
}

function UserDialog({ user, stores, onClose }: { user: AdminUser | null; stores: Store[]; onClose: () => void }) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [form, setForm] = useState<UserForm>(() => ({
    nome: user?.nome ?? "", login: user?.login ?? "", senha: "",
    papel: user?.papel ?? "conferente", lojaId: user?.lojaId ?? "",
  }));
  const [auditVisible, setAuditVisible] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const audit = useQuery({
    queryKey: ["admin", "user-audit", user?.id],
    queryFn: () => listUserAudit(user!.id),
    enabled: Boolean(user) && auditVisible,
  });
  useEffect(() => {
    const dialog = modalRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const refresh = async () => { await client.invalidateQueries({ queryKey: usersKey }); };
  const save = useMutation({
    mutationFn: () => saveUser(form, user?.id),
    onSuccess: async () => { await refresh(); onClose(); },
  });
  const toggle = useMutation({
    mutationFn: () => { if (!user) throw new Error("Usuário não selecionado"); return setUserActive(user.id, !user.ativo); },
    onSuccess: async () => { await refresh(); onClose(); },
  });
  const busy = save.isPending || toggle.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && validUser(form, !user)) save.mutate();
  };
  return <dialog ref={modalRef} aria-label={user ? "Editar usuário" : "Cadastrar usuário"}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}
    className="fixed inset-0 m-auto max-h-[90vh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#48617b] bg-[#142338] p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/75">
    <div className="flex items-start justify-between gap-3 border-b border-[#344d69] px-5 py-4">
      <div><p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">{user ? "Gerenciar acesso" : "Novo acesso"}</p>
        <h2 className="mt-1 text-lg font-bold">{user ? "Editar usuário" : "Cadastrar usuário"}</h2></div>
      <Button size="icon" variant="ghost" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={18} /></Button>
    </div>
    <form onSubmit={submit} className="space-y-4 p-5" aria-label="Formulário do usuário">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Nome
          <input autoFocus name="nome" className={input} maxLength={120} required value={form.nome}
            onChange={event => setForm(value => ({ ...value, nome: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Login
          <input name="login" className={input} maxLength={100} minLength={3} required value={form.login}
            onChange={event => setForm(value => ({ ...value, login: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">
          {user ? "Nova senha (opcional)" : "Senha"}
          <input type="password" name="senha" className={input} minLength={12} maxLength={200}
            autoComplete="new-password" required={!user} value={form.senha}
            onChange={event => setForm(value => ({ ...value, senha: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-300">Papel
          <select className={input} name="papel" value={form.papel}
            onChange={event => setForm(value => ({ ...value, papel: event.target.value as UserForm["papel"] }))}>
            <option value="admin">Administrador</option>
            <option value="conferente">Conferente</option>
            <option value="visualizador">Visualizador</option>
          </select>
        </label>
        {form.papel === "conferente" &&
          <StoreSelect form={form} setForm={setForm} stores={stores} editing={Boolean(user)} />}
      </div>
      {save.isError && <p role="alert" className="text-xs text-rose-300">{errorText(save.error)}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={busy || !validUser(form, !user)}>
          {save.isPending ? "Salvando…" : user ? "Salvar alterações" : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
    {user && <div className="space-y-4 border-t border-[#344d69] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold">Histórico de alterações</h3><p className="text-xs text-slate-400">Auditoria deste cadastro</p></div>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAuditVisible(value => !value)}>{auditVisible ? "Ocultar histórico" : "Ver histórico"}</Button>
      </div>
      {auditVisible && <div className="max-h-56 overflow-auto rounded-lg border border-[#344d69] bg-[#101e30] p-3">
        {audit.isPending && <p role="status" className="text-xs text-slate-400">Carregando histórico…</p>}
        {audit.isError && <p role="alert" className="text-xs text-rose-300">Não foi possível carregar o histórico.
          <Button variant="secondary" size="sm" onClick={() => void audit.refetch()}>Tentar novamente</Button></p>}
        {audit.data && (!audit.data.length ? <p className="text-xs text-slate-400">Nenhuma alteração registrada.</p>
          : <ol className="space-y-3">{audit.data.map(event => <li key={event.id} className="space-y-1 border-b border-[#344d69] pb-3 text-xs">
            <strong className="block text-white">{auditActions[event.action] ?? event.action.replaceAll("_", " ")}</strong>
            <span className="block text-slate-400">{event.user?.name ?? "Sistema"} · {new Date(event.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            {event.details && <span className="block text-slate-300">{event.details}</span>}
            {event.before && <span className="block break-words text-slate-400">Antes: {auditValue(event.before)}</span>}
            {event.after && <span className="block break-words text-slate-400">Depois: {auditValue(event.after)}</span>}
          </li>)}</ol>)}
      </div>}
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-xs text-slate-100">
              {confirmToggle ? (user.ativo ? `Desativar ${user.nome}?` : `Ativar ${user.nome}?`)
                : user.ativo ? "Desativar usuário" : "Ativar usuário"}
            </strong>
            <p className="mt-1 text-[11px] text-slate-400">
              {confirmToggle
                ? user.ativo ? "O acesso será bloqueado, mas o usuário continuará cadastrado."
                  : "O usuário poderá acessar novamente com sua senha atual."
                : user.ativo ? "Bloqueia o acesso sem apagar agendas ou histórico."
                  : "Restaura o acesso e a visibilidade da loja no dashboard."}
            </p>
          </div>
          {!confirmToggle
            ? <Button size="sm" variant={user.ativo ? "danger" : "secondary"} disabled={busy}
              onClick={() => setConfirmToggle(true)}>{user.ativo ? "Desativar usuário" : "Ativar usuário"}</Button>
            : <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmToggle(false)}>Cancelar</Button>
              <Button size="sm" variant={user.ativo ? "danger" : "secondary"} disabled={busy} onClick={() => toggle.mutate()}>
                {toggle.isPending ? "Salvando…" : user.ativo ? "Confirmar desativação" : "Confirmar ativação"}
              </Button>
            </div>}
        </div>
        {toggle.isError && <p role="alert" className="mt-2 text-xs text-rose-300">{errorText(toggle.error)}</p>}
      </div>
    </div>}
  </dialog>;
}

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"todos" | AdminUser["papel"]>("todos");
  const [status, setStatus] = useState<"todos" | "ativos" | "inativos">("todos");
  const [editing, setEditing] = useState<AdminUser | null | "new">(null);
  const usersQuery = useQuery({ queryKey: usersKey, queryFn: listUsers });
  const storesQuery = useQuery({ queryKey: storesKey, queryFn: listStores });
  const users = usersQuery.data ?? [];
  const stores = storesQuery.data ?? [];
  const visible = filterUsers(users, stores, search, role, status);
  const storeNames = new Map(stores.map(store => [store.id, `${store.codigo} - ${store.nome}`]));
  return <section className="mx-auto w-full min-w-0 max-w-[1450px] overflow-x-clip space-y-5" aria-label="Cadastro de usuários">
    <PageHeader eyebrow="Cadastros" title="Usuários" description="Gerencie os acessos ao sistema."
      actions={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-slate-400">{users.length} {users.length === 1 ? "usuário" : "usuários"} · {users.filter(user => user.ativo).length} ativos</span>
        <Button onClick={() => setEditing("new")}><Plus size={14} />Novo usuário</Button>
      </div>} />
    <div className={surface}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#344d69] p-4">
        <label className="flex w-full min-w-0 items-center gap-2 rounded-md border border-[#48617b] bg-[#192d46] px-3 sm:max-w-sm">
          <Search size={15} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="sr-only">Buscar usuário</span>
          <input type="search" aria-label="Buscar usuário" value={search} onChange={event => setSearch(event.target.value)}
            className="h-9 w-full min-w-0 bg-transparent text-xs text-white outline-none" placeholder="Buscar por nome, login ou loja..." />
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <select aria-label="Filtrar por papel" value={role}
            onChange={event => setRole(event.target.value as typeof role)} className={input + " max-w-[170px]"}>
            <option value="todos">Todos os papéis</option>
            <option value="admin">Administrador</option>
            <option value="conferente">Conferente</option>
            <option value="visualizador">Visualizador</option>
          </select>
          <select aria-label="Filtrar por situação" value={status}
            onChange={event => setStatus(event.target.value as typeof status)} className={input + " max-w-[165px]"}>
            <option value="todos">Todas as situações</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>
          <Button size="icon" variant="secondary" aria-label="Atualizar usuários" disabled={usersQuery.isFetching} onClick={() => void usersQuery.refetch()}>
            <RefreshCw size={15} />
          </Button>
        </div>
      </div>
      {usersQuery.isPending && <p role="status" className="p-5 text-xs text-slate-300">Carregando usuários…</p>}
      {usersQuery.isError && <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-xs text-rose-300">Não foi possível carregar os usuários.
        <Button size="sm" variant="secondary" onClick={() => void usersQuery.refetch()}>Tentar novamente</Button></div>}
      {usersQuery.data && <>
        <div className="min-w-0 max-w-full divide-y divide-[#344d69] sm:hidden" aria-label="Usuários no celular">
          {visible.map(user => <article key={user.id} data-testid={"mobile-user-" + user.login}
            className="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-xs text-white">{user.nome}</strong>
                <StatusBadge tone={user.ativo ? "success" : "neutral"}>{user.ativo ? "Ativo" : "Inativo"}</StatusBadge>
              </div>
              <p className="mt-1 break-words text-xs text-slate-300">{user.login}</p>
              <p className="mt-1 break-words text-[11px] text-slate-400">
                {user.lojaId ? storeNames.get(user.lojaId) ?? "Loja não localizada" : "—"} · {ROLE_LABELS[user.papel]}
              </p>
            </div>
            <Button size="sm" variant="secondary" aria-label={"Editar usuário " + user.nome} onClick={() => setEditing(user)}>
              <Pencil size={13} />Editar
            </Button>
          </article>)}
          {!visible.length && <p className="p-5 text-center text-xs text-slate-400">Nenhum usuário encontrado.</p>}
        </div>
        <div className="hidden w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain sm:block">
          <table aria-label="Usuários cadastrados" className="w-full min-w-[720px] border-collapse">
            <thead className="bg-[#203750] text-left text-[11px] font-semibold text-slate-300"><tr>
              <th className="px-4 py-3">Nome</th><th className="px-4 py-3">Login</th><th className="px-4 py-3">Loja</th>
              <th className="px-4 py-3">Papel</th><th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody className="divide-y divide-[#344d69]">
              {visible.map(user => <tr key={user.id} data-testid={"user-" + user.login} className="hover:bg-[#1c3047]">
                <td className="px-4 py-3 text-xs font-bold text-white">{user.nome}</td>
                <td className="px-4 py-3 text-xs text-slate-200">{user.login}</td>
                <td className="px-4 py-3 text-xs text-slate-200">{user.lojaId ? storeNames.get(user.lojaId) ?? "Loja não localizada" : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-200">{ROLE_LABELS[user.papel]}</td>
                <td className="px-4 py-3"><StatusBadge tone={user.ativo ? "success" : "neutral"}>{user.ativo ? "Ativo" : "Inativo"}</StatusBadge></td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="secondary" aria-label={"Editar usuário " + user.nome} onClick={() => setEditing(user)}>
                  <Pencil size={13} />Editar</Button></td>
              </tr>)}
              {!visible.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </div>
    {editing !== null && <UserDialog key={editing === "new" ? "new" : editing.id} user={editing === "new" ? null : editing}
      stores={stores} onClose={() => setEditing(null)} />}
  </section>;
}
