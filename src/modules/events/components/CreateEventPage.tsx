"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApplicationAccess } from "@/modules/identity-access/client";
import { EventEditorSheet } from "./EventEditorSheet";
export function CreateEventPage() {
  const router = useRouter(); const client = useQueryClient(); const access = useApplicationAccess();
  return <EventEditorSheet mode="create" canFeature={Boolean(access?.roles.some((role)=>role==="admin"||role==="super_admin"))} canPublish={Boolean(access?.permissions.includes("events.publish"))} onClose={() => router.push("/organizador")} onSaved={() => { void client.invalidateQueries({ queryKey: ["events"] }); router.push("/organizador"); }} />;
}

