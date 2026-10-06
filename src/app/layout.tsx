import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { getCurrentAccessUser } from "@/modules/identity-access";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ticketera — Tu próxima gran noche en Perú",
  description:
    "Descubre eventos en Perú. Consulta la agenda publicada por sus organizadores, las zonas, tarifas y condiciones de ingreso.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const accessUser = await getCurrentAccessUser();
  return (
    <html
      lang="es-PE" data-scroll-behavior="smooth"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers accessUser={accessUser}>{children}</Providers>
      </body>
    </html>
  );
}

