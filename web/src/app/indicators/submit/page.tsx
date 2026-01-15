import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppHeader } from "@/components/layout/AppHeader";
import { IndicatorReasoningForm } from "@/components/indicators/IndicatorReasoningForm";

export default async function SubmitIndicatorReasoningPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const prefilledType = params.type;

  return (
    <div className="min-h-screen bg-black">
      <AppHeader title="Submit Indicator Reasoning" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Share Your Pattern Recognition Logic
          </h1>
          <p className="text-gray-400">
            Help us build better algorithms by sharing how you identify patterns.
            Your reasoning will be reviewed and potentially implemented into the system.
          </p>
        </div>
        <IndicatorReasoningForm userId={session.user.id} prefilledType={prefilledType} />
      </div>
    </div>
  );
}
