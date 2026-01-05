"use client";

import { ToastProvider } from "@/components/ui";
import { ReactNode } from "react";

export function ToastProviderWrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
