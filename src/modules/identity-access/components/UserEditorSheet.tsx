"use client";
import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { permissionDefinitions, type AccessUser, type PermissionName, type StaffSettings } from "../types";
import styles from "./StaffUsersPage.module.css";

export type UserEditorMode = "create" | "view" | "edit" | "delete";
export function UserEditorSheet({ mode, user, onClose, onSaved }: { mode: UserEditorMode; user?: AccessUser; onClose: () => void; onSaved: (message: string, created: boolean) => void }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [settings, setSettings] = useState<StaffSettings>({ roles: user?.roles.filter((r): r is "admin" | "organizer" => r === "admin" || r === "organizer") ?? ["organizer"], overrides: { ...user?.overrides }, status: user?.status === "inactive" ? "inactive" : "active" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const readonly = mode === "view" || Boolean(user?.roles.includes("super_admin"));
  const titles = { create: "Invitar usuario", view: "Detalle del usuario", edit: "Editar usuario", delete: "Eliminar usuario" };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (readonly) return;
    if (mode === "create" && !settings.roles.length) { setError("Selecciona al menos un rol de equipo."); return; }
    setBusy(true); setError("");
    try {
      const creating = mode === "create";
      const response = await fetch(creating ? "/api/admin/users" : `/api/admin/users/${user!.id}`, {
        method: mode === "delete" ? "DELETE" : creating ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        ...(mode === "delete" ? {} : { body: JSON.stringify(creating ? { name, email, roles: settings.roles, overrides: settings.overrides } : { name, ...settings }) }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "No se pudo guardar el usuario."); }
      onSaved(mode === "delete" ? "Usuario eliminado. Sus registros históricos se conservan." : creating ? "Invitación enviada por correo. El usuario aparecerá aquí cuando complete su registro con Clerk." : "Usuario actualizado correctamente.", creating);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }

  return <Sheet open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <SheetContent className={styles.sheet} showCloseButton={!busy}>
      <SheetHeader><SheetTitle>{titles[mode]}</SheetTitle><SheetDescription>{mode === "delete" ? "Confirma qué cuenta quieres retirar de Ticketera." : mode === "create" ? "Envía una invitación por correo y prepara sus accesos." : "Datos de cuenta, roles y permisos individuales."}</SheetDescription></SheetHeader>
      <form onSubmit={submit} className={styles.form}>
        {mode === "delete" ? <div className={styles.deletion}><b>{user?.name}</b><p>{user?.email}</p><p>Perderá acceso a Ticketera y desaparecerá de esta lista. Sus compras, eventos y auditorías se conservarán. Esta acción no se puede deshacer desde este panel.</p></div> : <>
          <label>Nombre completo<Input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} readOnly={readonly} disabled={busy} /></label>
          <label>Correo electrónico<Input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={mode !== "create"} disabled={busy} /></label>
          {mode !== "create" && <p className={styles.note}>El correo y su verificación se gestionan desde la cuenta de Clerk.</p>}
          {mode === "create" && <p className={styles.note}>Recibirá un enlace válido por 7 días para autenticarse con Clerk en Ticketera. Sus roles se activarán al completar el registro. Si ya tiene una cuenta, edita sus accesos desde la lista.</p>}
          {user?.roles.includes("super_admin") ? <p className={styles.protected}><LockKeyhole size={16} />La cuenta super admin está protegida.</p> : <fieldset disabled={readonly || busy}><legend>Roles de equipo</legend>{(["admin", "organizer"] as const).map((role) => <label className={styles.checkbox} key={role}><input type="checkbox" checked={settings.roles.includes(role)} onChange={(e) => setSettings((current) => ({ ...current, roles: e.target.checked ? [...current.roles, role] : current.roles.filter((r) => r !== role) }))} />{role === "admin" ? "Administrador" : "Organizador"}</label>)}</fieldset>}
          {user?.roles.includes("customer") && <p className={styles.note}>El perfil de cliente y sus compras se conservan al asignar roles de equipo.</p>}
          {mode !== "create" && <label>Estado<select value={settings.status} onChange={(e) => setSettings((current) => ({ ...current, status: e.target.value as "active" | "inactive" }))} disabled={readonly || busy}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>}
          <details><summary>Permisos individuales</summary><p className={styles.note}>«Según rol» conserva los permisos predeterminados.</p><div className={styles.permissions}>{(Object.keys(permissionDefinitions) as PermissionName[]).filter((permission) => permission !== "staff.manage").map((permission) => <label key={permission}>{permissionDefinitions[permission]}<select value={settings.overrides[permission] === undefined ? "inherit" : settings.overrides[permission] ? "allow" : "deny"} disabled={readonly || busy} onChange={(e) => setSettings((current) => { const overrides = { ...current.overrides }; if (e.target.value === "inherit") delete overrides[permission]; else overrides[permission] = e.target.value === "allow"; return { ...current, overrides }; })}><option value="inherit">Según rol</option><option value="allow">Permitir</option><option value="deny">Denegar</option></select></label>)}</div></details>
        </>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.formActions}><Button type="button" variant="outline" onClick={onClose} disabled={busy}>{readonly ? "Cerrar" : "Cancelar"}</Button>{!readonly && <Button type="submit" disabled={busy} variant={mode === "delete" ? "destructive" : "default"} className={mode === "delete" ? undefined : styles.primary}>{busy ? "Procesando…" : mode === "delete" ? "Eliminar usuario" : mode === "create" ? "Enviar invitación" : "Guardar cambios"}</Button>}</div>
      </form>
    </SheetContent>
  </Sheet>;
}
