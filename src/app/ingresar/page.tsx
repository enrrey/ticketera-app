import { LoginPage } from "@/modules/portal";

export default async function Page({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) { return <LoginPage returnTo={(await searchParams).returnTo} />; }
