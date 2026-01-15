import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/layout/AppHeader";
import { UnifiedFeedbackManagement } from "@/components/admin/UnifiedFeedbackManagement";

export default async function AdminFeedbackPage() {
  const session = await auth();

  // Only admins can access
  if (!session?.user || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Feedback Management" />
      <UnifiedFeedbackManagement />
    </div>
  );
}
