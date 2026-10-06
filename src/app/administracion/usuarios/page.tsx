import { requirePagePermission, queryApplicationUsers } from "@/modules/identity-access";
import { StaffUsersPage } from "@/modules/identity-access/client";

export default async function Page() {
  await requirePagePermission("staff.manage");
  return <StaffUsersPage initialPage={await queryApplicationUsers()} />;
}
