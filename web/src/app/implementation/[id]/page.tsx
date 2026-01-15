import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ImplementationSession } from "@/components/implementation/ImplementationSession";
import { AppHeader } from "@/components/layout/AppHeader";

export default async function ImplementationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Allow admin and dev_team users
  if (session.user.role !== "admin" && session.user.role !== "dev_team") {
    redirect("/dashboard");
  }

  const { id } = await params;

  const implementation = await prisma.implementationSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      phase: true,
      status: true,
    },
  });

  if (!implementation) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Implementation Progress" showBackButton />
      <ImplementationSession
        sessionId={implementation.id}
        title={implementation.title}
        description={implementation.description || undefined}
        type={implementation.type}
      />
    </div>
  );
}
