import type { Metadata } from "next";
import { OrderPage } from "@/modules/checkout";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderPage orderId={(await params).orderId} />;
}
