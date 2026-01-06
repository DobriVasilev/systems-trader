import Link from "next/link";

export const metadata = {
  title: "Terms of Service - Systems Trader",
  description: "Terms of Service for Systems Trader",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Systems Trader
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 leading-relaxed">
              By accessing or using Systems Trader ("the Platform"), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use the Platform.
              We reserve the right to modify these terms at any time, and your continued use
              constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-gray-300 leading-relaxed">
              Systems Trader is a collaborative platform for validating and refining trading pattern
              detection algorithms. The Platform provides tools for analyzing candlestick charts,
              annotating patterns, and collaborating with other users on pattern validation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              To use certain features of the Platform, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Use the Platform for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Platform</li>
              <li>Interfere with or disrupt the Platform's infrastructure</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Scrape or collect data from the Platform without permission</li>
              <li>Impersonate another person or entity</li>
              <li>Use the Platform to harass, abuse, or harm others</li>
              <li>Circumvent any access restrictions or security measures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              <strong className="text-white">Platform Content:</strong> The Platform, including its
              design, code, features, and branding, is owned by Systems Trader and protected by
              intellectual property laws.
            </p>
            <p className="text-gray-300 leading-relaxed">
              <strong className="text-white">User Content:</strong> You retain ownership of any
              content you create on the Platform, including sessions, annotations, and comments.
              By using the Platform, you grant us a license to store, display, and process your
              content as necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Not Financial Advice</h2>
            <p className="text-gray-300 leading-relaxed bg-red-950/30 border border-red-900/50 rounded-lg p-4">
              <strong className="text-red-400">IMPORTANT DISCLAIMER:</strong> The Platform is
              intended for educational and research purposes only. Nothing on this Platform
              constitutes financial, investment, trading, or any other type of advice. Trading
              cryptocurrencies and other financial instruments carries significant risk. You should
              consult with qualified professionals before making any financial decisions. We are not
              responsible for any losses you may incur from trading activities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Market Data</h2>
            <p className="text-gray-300 leading-relaxed">
              The Platform may display market data from third-party sources. This data is provided
              "as is" and we make no guarantees about its accuracy, completeness, or timeliness.
              Market data should not be relied upon for trading decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-gray-300 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SYSTEMS TRADER SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR
              USE OF OR INABILITY TO USE THE PLATFORM.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-gray-300 leading-relaxed">
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED,
              ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Indemnification</h2>
            <p className="text-gray-300 leading-relaxed">
              You agree to indemnify and hold harmless Systems Trader and its affiliates from any
              claims, damages, losses, or expenses arising from your use of the Platform, violation
              of these Terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-gray-300 leading-relaxed">
              We reserve the right to suspend or terminate your account at any time, with or without
              cause or notice. Upon termination, your right to use the Platform will immediately
              cease. You may also delete your account at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-gray-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the
              jurisdiction in which Systems Trader operates, without regard to conflict of law
              principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Severability</h2>
            <p className="text-gray-300 leading-relaxed">
              If any provision of these Terms is found to be unenforceable, the remaining provisions
              will continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              For questions about these Terms of Service, please contact us at legal@systemstrader.io.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-gray-800 flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-white transition-colors">
            &larr; Back to Home
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
