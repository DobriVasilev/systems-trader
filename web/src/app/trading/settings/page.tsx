"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { TradingSettingsPage } from "@/components/trading/TradingSettingsPage";

export default function SettingsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <>
      <AppHeader title="Trading Settings" />
      <TradingSettingsPage />
    </>
  );
}
