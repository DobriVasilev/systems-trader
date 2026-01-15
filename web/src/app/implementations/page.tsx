import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppHeader } from "@/components/layout/AppHeader";
import { ImplementationsDashboard } from "@/components/implementation/ImplementationsDashboard";

export default async function ImplementationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Only admin and dev_team can access
  if (session.user.role !== "admin" && session.user.role !== "dev_team") {
    redirect("/dashboard");
  }

  // Fetch implementation sessions
  const implementations = await prisma.implementationSession.findMany({
    where: {
      createdById: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      phase: true,
      status: true,
      progress: true,
      sessionId: true,
      indicatorId: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true,
    },
  });

  // Fetch available sessions for testing
  const sessions = await prisma.patternSession.findMany({
    where: {
      createdById: session.user.id,
      status: "active",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
    select: {
      id: true,
      name: true,
      patternType: true,
      symbol: true,
      timeframe: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Implementations" />
      <ImplementationsDashboard
        implementations={implementations}
        sessions={sessions}
      />
    </div>
  );
}
