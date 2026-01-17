import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/layout/AppHeader";
import { ExecutionViewer } from "@/components/workspace/ExecutionViewer";

export default async function ExecutionViewerPage({
  params,
}: {
  params: { patternType: string; executionId: string };
}) {
  const session = await auth();

  // Only admins can view execution details
  if (!session?.user || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Execution Details" />
      <ExecutionViewer executionId={params.executionId} />
    </div>
  );
}
