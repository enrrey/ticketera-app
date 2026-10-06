"use client";

import { useState, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ClerkProvider } from "@clerk/nextjs";
import { ApplicationAccessProvider } from "@/modules/identity-access/client";
import type { AccessUser } from "@/modules/identity-access/types";

export function Providers({ children, accessUser = null }: { children: ReactNode; accessUser?: AccessUser | null }) {
  // El cliente se crea por montaje para que no se comparta entre peticiones en SSR.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ClerkProvider signInUrl="/ingresar" signUpUrl="/ingresar" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/">
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
        <ApplicationAccessProvider user={accessUser}>{children}</ApplicationAccessProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ClerkProvider>
  );
}
