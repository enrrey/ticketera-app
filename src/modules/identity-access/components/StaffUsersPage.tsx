"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, LockKeyhole, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserEditorSheet, type UserEditorMode } from "./UserEditorSheet";
import type { AccessUser, UsersPage, UsersQuery } from "../types";
import styles from "./StaffUsersPage.module.css";

const roleLabels = { super_admin: "Super admin", admin: "Administrador", organizer: "Organizador", customer: "Cliente" };
const queryString = (query: UsersQuery) => new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();

export function StaffUsersPage({ initialPage }: { initialPage: UsersPage }) {
  const [data, setData] = useState(initialPage);
  const [query, setQuery] = useState<UsersQuery>({ search: "", role: "all", status: "all", kind: "all", page: initialPage.page, pageSize: initialPage.pageSize });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<{ mode: UserEditorMode; user?: AccessUser } | null>(null);
  const initialKey = useRef(queryString(query));
  const sequence = useRef(0);
  const queryKey = queryString(query);

  async function load(key: string, signal?: AbortSignal) {
    const request = ++sequence.current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/users?${key}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cargar la lista de usuarios.");
      if (request === sequence.current && !signal?.aborted) setData(result);
    } catch (cause) { if (!signal?.aborted && request === sequence.current) setError(cause instanceof Error ? cause.message : "No se pudo cargar la lista."); }
    finally { if (request === sequence.current && !signal?.aborted) setLoading(false); }
  }

  useEffect(() => {
    if (queryKey === initialKey.current) { initialKey.current = ""; return; }
    const controller = new AbortController();
    const timer = setTimeout(() => { void load(queryKey, controller.signal); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [queryKey]);

  function filter(values: Partial<UsersQuery>) { setQuery((current) => ({ ...current, ...values, page: 1 })); }
  function saved(text: string, created: boolean) {
    setEditor(null); setMessage(text);
    if (created) {
      const reset: UsersQuery = { search: "", role: "all", status: "all", kind: "all", page: 1, pageSize: query.pageSize };
      if (queryString(reset) !== queryKey) setQuery(reset);
      else void load(queryKey);
    } else void load(queryKey);
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pageNumbers = [...new Set([1, ...Array.from({ length: 3 }, (_, i) => data.page - 1 + i).filter((page) => page > 1 && page < pages), pages])].sort((a, b) => a - b);

  return <main className={styles.page}>
    <header className={styles.heading}><div><h1>Usuarios y permisos</h1><p>Gestiona tu equipo y los accesos a Ticketera.</p></div><Button className={styles.primary} onClick={() => { setMessage(""); setEditor({ mode: "create" }); }}><Plus size={16} />Invitar usuario</Button></header>
    <div className={styles.tabs} aria-label="Tipo de usuarios">{([['all', 'Todos'], ['staff', 'Equipo'], ['customer', 'Clientes']] as const).map(([kind, label]) => <button key={kind} type="button" aria-pressed={query.kind === kind} onClick={() => filter({ kind })}>{label}</button>)}</div>
    <div className={styles.toolbar}><label className={styles.search}><Search size={17} /><Input type="search" value={query.search} maxLength={100} onChange={(e) => filter({ search: e.target.value })} placeholder="Buscar nombre o correo…" aria-label="Buscar por nombre o correo" /></label><select aria-label="Filtrar por rol" value={query.role} onChange={(e) => filter({ role: e.target.value as UsersQuery['role'] })}><option value="all">Todos los roles</option>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><select aria-label="Filtrar por estado" value={query.status} onChange={(e) => filter({ status: e.target.value as UsersQuery['status'] })}><option value="all">Todos los estados</option><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
    <div className={styles.results}><span>{loading ? "Cargando usuarios…" : `${data.total} usuarios encontrados`}</span><button type="button" onClick={() => filter({ search: "", role: "all", status: "all", kind: "all" })}>Limpiar filtros</button></div>
    {message && <p role="status" className={styles.feedback}>{message}</p>}
    {error && <div role="alert" className={styles.error}>{error} <Button variant="outline" onClick={() => void load(queryKey)}>Reintentar</Button></div>}
    <div className={styles.list} aria-busy={loading}>
      <table className={styles.table}><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.users.map((user) => {
        const protectedUser = user.roles.includes("super_admin");
        const displayedRoles = user.roles.some((role) => role !== "customer") ? user.roles.filter((role) => role !== "customer") : user.roles;
        return <tr key={user.id}><td className={styles.personCell}><div className={styles.person}><span className={styles.avatar}>{user.name.split(" ").slice(0, 2).map((name) => name[0]).join("")}</span><div><b>{user.name}</b><small>{user.email}</small></div></div></td><td><div className={styles.badges}>{displayedRoles.map((role) => <span className={role === "super_admin" ? styles.superBadge : styles.badge} key={role}>{roleLabels[role]}</span>)}</div></td><td><span className={user.status === "active" ? styles.active : styles.inactive}><span aria-hidden="true">●</span>{user.status === "active" ? "Activo" : "Inactivo"}</span></td><td className={styles.actionsCell}><div className={styles.actions}><Button variant="ghost" size="icon" aria-label={`Ver ${user.name}`} onClick={() => setEditor({ mode: "view", user })}><Eye /></Button>{protectedUser ? <span className={styles.protected}><LockKeyhole size={13} />Protegido</span> : <><Button variant="ghost" size="icon" aria-label={`Editar ${user.name}`} onClick={() => setEditor({ mode: "edit", user })}><Pencil /></Button><Button variant="ghost" size="icon" aria-label={`Eliminar ${user.name}`} onClick={() => setEditor({ mode: "delete", user })}><Trash2 /></Button></>}</div></td></tr>;
      })}</tbody></table>
      {!loading && data.users.length === 0 && <div className={styles.empty}><h2>No encontramos usuarios</h2><p>Prueba otro nombre, correo o filtro, o invita a alguien a tu equipo.</p></div>}
      <footer className={styles.pagination}><label>Filas por página<select aria-label="Filas por página" value={query.pageSize} onChange={(e) => filter({ pageSize: Number(e.target.value) })}>{[5, 10, 20, 50].map((size) => <option key={size}>{size}</option>)}</select></label><span>{data.total ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} de ${data.total}` : "0 de 0"}</span><nav aria-label="Paginación" className={styles.pages}><Button variant="outline" size="icon" disabled={loading || data.page === 1} aria-label="Página anterior" onClick={() => setQuery((current) => ({ ...current, page: data.page - 1 }))}><ChevronLeft /></Button>{pageNumbers.map((page, i) => <span key={page}>{i > 0 && page - pageNumbers[i - 1] > 1 && <span className={styles.ellipsis}>…</span>}<Button variant={page === data.page ? "secondary" : "outline"} size="icon" disabled={loading} aria-label={`Página ${page}`} aria-current={page === data.page ? "page" : undefined} onClick={() => setQuery((current) => ({ ...current, page }))}>{page}</Button></span>)}<Button variant="outline" size="icon" disabled={loading || data.page >= pages} aria-label="Página siguiente" onClick={() => setQuery((current) => ({ ...current, page: data.page + 1 }))}><ChevronRight /></Button></nav></footer>
    </div>
    {editor && <UserEditorSheet key={`${editor.mode}:${editor.user?.id ?? 'new'}`} {...editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </main>;
}
