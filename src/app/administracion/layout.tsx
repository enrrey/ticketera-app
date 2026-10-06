import { requirePagePermission } from "@/modules/identity-access";
import { ManagementShell } from "@/modules/identity-access/client";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("staff.manage");
  return <ManagementShell>{children}</ManagementShell>;
}
