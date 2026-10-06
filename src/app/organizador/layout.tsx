import { requirePagePermission } from "@/modules/identity-access";
import { ManagementShell } from "@/modules/identity-access/client";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("events.manage", "/organizador");
  return <ManagementShell><div className="p-5 md:p-8">{children}</div></ManagementShell>;
}
