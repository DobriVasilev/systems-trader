import Link from "next/link";
import HeroSection from "@/components/HeroSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-xl font-bold">Systems Trader</div>
          <div className="flex items-center gap-4">
            <Link
              href="/sessions"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Sessions
            </Link>
            <Link
              href="/sessions/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium
                       hover:bg-blue-700 transition-colors"
            >
              New Session
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Rive Animation */}
      <HeroSection />

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16 border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-gray-900 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">20+ Pattern Types</h3>
              <p className="text-gray-400 text-sm">
                Validate swings, BOS, MSB, ranges, false breakouts, and more trading patterns
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Interactive Corrections</h3>
              <p className="text-gray-400 text-sm">
                Move, delete, or add detections directly on the chart with full audit trail
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 text-left">
              <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2">Real-time Collaboration</h3>
              <p className="text-gray-400 text-sm">
                Share sessions with team members and collaborate like Google Docs
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400 mb-1">ULID</div>
              <div className="text-gray-500">Tracking</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-400 mb-1">100%</div>
              <div className="text-gray-500">Audit Trail</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400 mb-1">JSON</div>
              <div className="text-gray-500">Export</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-400 mb-1">Multi-TF</div>
              <div className="text-gray-500">Support</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
