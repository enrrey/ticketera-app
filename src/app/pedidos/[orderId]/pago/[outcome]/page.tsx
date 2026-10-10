import { notFound } from "next/navigation";
import { OrderPage } from "@/modules/checkout";

export const metadata = { title: "Estado de tu pago", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ orderId: string; outcome: string }> }) {
  const { orderId, outcome } = await params;
  if (outcome !== "exito" && outcome !== "cancelado" && outcome !== "fallido") notFound();
  return <OrderPage orderId={orderId} outcome={outcome} />;
}
