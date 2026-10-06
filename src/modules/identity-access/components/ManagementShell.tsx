"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Menu, RotateCcw, ScanLine, Ticket, UsersRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useApplicationAccess } from "../client";
import type { PermissionName } from "../types";
import styles from "./ManagementShell.module.css";

export function ManagementShell({ children }: { children: ReactNode }) {
  const user = useApplicationAccess();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = (permission: PermissionName) => user?.permissions.includes(permission);
  const navigation = <nav aria-label="Administración y organización" className={styles.navigation}>
    {allowed("events.manage") && <><p>Eventos y operación</p><Link href="/organizador" aria-current={pathname.startsWith("/organizador") ? "page" : undefined} onClick={() => setOpen(false)}><CalendarDays size={18} />Eventos</Link></>}
    {allowed("tickets.check_in") && <span className={styles.pending}><ScanLine size={18} />Validar entradas<small>Pronto</small></span>}
    {(allowed("refunds.manage") || allowed("settlements.manage")) && <p>Finanzas</p>}
    {allowed("refunds.manage") && <span className={styles.pending}><RotateCcw size={18} />Reembolsos<small>Pronto</small></span>}
    {allowed("settlements.manage") && <span className={styles.pending}><Wallet size={18} />Liquidaciones<small>Pronto</small></span>}
    {allowed("staff.manage") && <><p>Administración</p><Link href="/administracion/usuarios" aria-current={pathname.startsWith("/administracion/usuarios") ? "page" : undefined} onClick={() => setOpen(false)}><UsersRound size={18} />Usuarios y permisos</Link></>}
  </nav>;
  return <div className={styles.shell}>
    <aside className={styles.sidebar}><Link href="/" className={styles.brand}><Ticket size={25} />ticketera</Link><span className={styles.brandCaption}>Panel de gestión</span>{navigation}<div className={styles.profile}><span className={styles.avatar}>{user?.name.split(" ").slice(0, 2).map((name) => name[0]).join("") || "TU"}</span><div><b>{user?.name || "Mi cuenta"}</b><small>{user?.roles.includes("super_admin") ? "Super admin" : user?.roles.includes("admin") ? "Administrador" : "Organizador"}</small></div></div></aside>
    <div className={styles.workspace}><header className={styles.top}><Button variant="ghost" size="icon" className={styles.mobileMenu} aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu /></Button><span>Panel / <b>{pathname.startsWith("/administracion") ? "Usuarios" : "Eventos"}</b></span><Link href="/">Ver ticketera<ArrowUpRight size={15} /></Link></header>{children}</div>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent side="left" className={styles.mobileSidebar}><SheetHeader><SheetTitle>ticketera</SheetTitle><SheetDescription>Panel de gestión</SheetDescription></SheetHeader>{navigation}</SheetContent></Sheet>
  </div>;
}

