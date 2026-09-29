"use client";

import { useState, type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }) {
  // El cliente se crea por montaje para que no se comparta entre peticiones en SSR.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
