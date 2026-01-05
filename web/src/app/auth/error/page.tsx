"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link may have expired.",
    OAuthSignin: "Error during OAuth sign in. Please try again.",
    OAuthCallback: "Error during OAuth callback. Please try again.",
    OAuthCreateAccount: "Could not create OAuth account. Please try again.",
    EmailCreateAccount: "Could not create email account. Please try again.",
    Callback: "Error during callback. Please try again.",
    OAuthAccountNotLinked: "This email is already associated with another account.",
    EmailSignin: "Check your email for the sign in link.",
    CredentialsSignin: "Invalid email or password.",
    SessionRequired: "Please sign in to access this page.",
    Default: "An error occurred during authentication.",
  };

  const message = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="bg-gray-900 rounded-lg p-8">
      <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
      <p className="text-gray-400 mb-6">{message}</p>

      <Link
        href="/auth/login"
        className="inline-block bg-blue-600 text-white rounded-lg px-6 py-2 font-medium hover:bg-blue-700 transition-colors"
      >
        Try Again
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
      <div className="w-full max-w-md p-8 text-center">
        <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
          <ErrorContent />
        </Suspense>
      </div>
    </main>
  );
}
