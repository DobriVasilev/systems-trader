"use client";

import Link from "next/link";

export default function SetupGuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold">Getting Started with Hyperliquid</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Intro */}
        <div className="mb-8">
          <p className="text-gray-400 text-lg">
            This guide will help you set up your Hyperliquid account and connect it to our trading platform.
            The entire process takes about 10-15 minutes.
          </p>
        </div>

        {/* Important Notice */}
        <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-semibold text-yellow-400">US Users: VPN Required for Setup Only</div>
              <p className="text-sm text-yellow-200/70 mt-1">
                Hyperliquid is not available in the US. You&apos;ll need a VPN to create your account initially.
                After setup, our European server handles all trading - no VPN needed for daily use.
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1 - VPN */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">1</div>
              <h2 className="text-lg font-semibold">Get a Free VPN (US users only)</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Download Windscribe and connect to <strong className="text-white">Switzerland</strong>:
            </p>
            <a
              href="https://windscribe.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors mb-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-blue-400">Windscribe VPN</div>
                  <div className="text-sm text-gray-500">10GB/month free - more than enough for setup</div>
                </div>
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-200">
                  <strong>Important:</strong> After installing Windscribe, connect to <strong>Switzerland</strong> specifically.
                  This has been tested and works reliably with Hyperliquid.
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 - MetaMask */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">2</div>
              <h2 className="text-lg font-semibold">Create a MetaMask Wallet</h2>
            </div>
            <p className="text-gray-400 mb-4">
              If you don&apos;t have a crypto wallet yet, create one with MetaMask:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
              <li>
                Install MetaMask from{" "}
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  metamask.io/download
                </a>
                {" "}(browser extension or mobile app)
              </li>
              <li>Click &quot;Create a new wallet&quot;</li>
              <li>Create a strong password</li>
              <li>
                <strong className="text-yellow-400">Write down your 12-word Secret Recovery Phrase</strong> on paper
                and store it safely. This is the ONLY way to recover your wallet!
              </li>
              <li>Confirm the phrase and finish setup</li>
            </ol>
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-200">
                  <strong>Save your keys!</strong> Store your MetaMask recovery phrase in a password manager
                  (KeePass, Apple Passwords, Google Password Manager, 1Password, etc.) or write it on paper.
                  Never share it with anyone.
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 - Fund Wallet */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">3</div>
              <h2 className="text-lg font-semibold">Add Funds to Your Wallet</h2>
            </div>
            <p className="text-gray-400 mb-4">
              You&apos;ll need USDC on the Arbitrum network. Here are two ways to get it:
            </p>

            {/* Option A - Crypto */}
            <div className="mb-4 p-4 bg-gray-800 rounded-lg">
              <div className="font-semibold text-green-400 mb-2">Option A: Transfer from Exchange (Recommended)</div>
              <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
                <li>Buy USDC on an exchange (Coinbase, Kraken, Binance, etc.)</li>
                <li>Copy your MetaMask wallet address (starts with 0x...)</li>
                <li>Withdraw USDC to your MetaMask address</li>
                <li><strong className="text-yellow-400">Select &quot;Arbitrum One&quot; network</strong> (lowest fees, ~$0.10)</li>
                <li>Wait 1-5 minutes for confirmation</li>
              </ol>
            </div>

            {/* Option B - Fiat */}
            <div className="mb-4 p-4 bg-gray-800 rounded-lg">
              <div className="font-semibold text-purple-400 mb-2">Option B: Buy Directly with Card</div>
              <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
                <li>In MetaMask, click &quot;Buy&quot;</li>
                <li>Select a provider (MoonPay, Transak, etc.)</li>
                <li>Buy ETH or USDC with debit/credit card</li>
                <li>If you bought ETH, swap to USDC using MetaMask Swap</li>
              </ol>
              <p className="text-xs text-gray-500 mt-2">Note: Direct purchase has higher fees (~3-5%)</p>
            </div>

            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-green-200">
                  <strong>How much?</strong> Start with $50-100 USDC while testing.
                  You can always add more later. Minimum to trade is ~$10.
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 - Create Hyperliquid Account */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">4</div>
              <h2 className="text-lg font-semibold">Create Hyperliquid Account</h2>
            </div>
            <p className="text-gray-400 mb-4">
              With VPN connected to Switzerland:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>
                Go to{" "}
                <a
                  href="https://app.hyperliquid.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  app.hyperliquid.xyz
                </a>
              </li>
              <li>Click &quot;Connect Wallet&quot; and select MetaMask</li>
              <li>Approve the connection in MetaMask</li>
              <li>Sign the message to authenticate</li>
            </ol>
          </div>

          {/* Step 5 - Deposit to Hyperliquid */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">5</div>
              <h2 className="text-lg font-semibold">Deposit to Hyperliquid</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Move your USDC from MetaMask to Hyperliquid:
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>On Hyperliquid, click &quot;Deposit&quot; (or Portfolio → Deposit)</li>
              <li>Select <strong className="text-yellow-400">&quot;Arbitrum One&quot;</strong> network</li>
              <li>Enter the amount of USDC to deposit</li>
              <li>Click &quot;Deposit&quot; and confirm in MetaMask</li>
              <li>Wait 1-2 minutes for confirmation</li>
            </ol>
            <p className="text-sm text-gray-500 mt-4">
              Your USDC is now on Hyperliquid and ready for trading!
            </p>
          </div>

          {/* Step 6 - Create API Wallet */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center font-bold">6</div>
              <h2 className="text-lg font-semibold">Create an API Wallet (Important!)</h2>
            </div>
            <div className="p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-purple-200">
                  <strong>Why API Wallet?</strong> API wallets can ONLY trade - they cannot withdraw funds.
                  This means even if someone got your API key, they cannot steal your money.
                  Much safer than using your main wallet key!
                </div>
              </div>
            </div>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>On Hyperliquid, click your wallet address in the top-right corner</li>
              <li>Select <strong className="text-yellow-400">&quot;API Wallets&quot;</strong></li>
              <li>Click &quot;Generate new API private key&quot;</li>
              <li>
                <strong className="text-red-400">IMPORTANT:</strong> Copy the private key that appears.
                You will only see it once!
              </li>
              <li>Click &quot;Authorize API Wallet&quot; and confirm in MetaMask</li>
            </ol>
            <div className="mt-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm text-red-200">
                  <strong>Save this API key!</strong> Store it in your password manager (KeePass, Apple Passwords,
                  Google Password Manager, 1Password, etc.). You cannot retrieve it again from Hyperliquid.
                </div>
              </div>
            </div>
          </div>

          {/* Step 7 - Add to Platform */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center font-bold">7</div>
              <h2 className="text-lg font-semibold">Add Wallet to Our Platform</h2>
            </div>
            <p className="text-gray-400 mb-4">
              Now you can disconnect your VPN - you won&apos;t need it anymore for trading!
            </p>
            <ol className="list-decimal list-inside space-y-3 text-gray-300">
              <li>
                Go to{" "}
                <Link href="/trading" className="text-blue-400 hover:underline">
                  Trading
                </Link>
              </li>
              <li>Click &quot;Add Wallet&quot;</li>
              <li>Enter a nickname (e.g., &quot;Main Trading&quot;)</li>
              <li>
                Paste your <strong className="text-yellow-400">wallet address</strong> (your MetaMask address, starts with 0x...)
              </li>
              <li>
                Paste your <strong className="text-yellow-400">API wallet private key</strong> (from Step 6)
              </li>
              <li>Click &quot;Connect Wallet&quot;</li>
            </ol>
            <div className="mt-4 p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-green-200">
                  Your API key is encrypted with AES-256-GCM before storage and is tied to your account.
                  Only you can access it when logged in.
                </div>
              </div>
            </div>
          </div>

          {/* Done */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-lg font-semibold mb-2">You&apos;re All Set!</h2>
            <p className="text-gray-400 mb-6">
              You can now trade on Hyperliquid through our platform, set up automated bots,
              and manage your positions - all without needing a VPN.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/trading"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Start Trading
              </Link>
              <Link
                href="/bots/new"
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Create a Bot
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Is my API key safe?</h3>
              <p className="text-gray-400 text-sm">
                Yes! First, API wallets can only trade - they <strong>cannot withdraw funds</strong>, so even
                in the worst case your money is safe. Second, your API key is encrypted using AES-256-GCM
                with a server-side key and is only accessible when you&apos;re logged into your account.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Why do I need a VPN only once?</h3>
              <p className="text-gray-400 text-sm">
                The VPN is only needed to create your Hyperliquid account from a non-US IP address.
                After that, <strong>our server (located in Europe) handles all communication with Hyperliquid</strong>.
                This means all your trades are executed from a European IP address - as if you&apos;re sitting
                in Europe and trading normally. There&apos;s no VPN involved in your actual trading, so there&apos;s
                no risk of &quot;being caught using a VPN&quot; - you&apos;re simply using a trading platform that
                happens to be hosted in Europe.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Can I withdraw funds through this platform?</h3>
              <p className="text-gray-400 text-sm">
                Yes! You can withdraw funds directly from our platform. Go to the Trading page,
                and you&apos;ll find withdrawal options in your account section. Withdrawals are processed
                through Hyperliquid&apos;s standard withdrawal system. You can also withdraw directly on
                Hyperliquid if you prefer (use VPN if needed for the initial access).
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">What if I lose my API key?</h3>
              <p className="text-gray-400 text-sm">
                If you lose your API key, simply create a new one on Hyperliquid (Step 6) and update
                your wallet on our platform. Your funds and positions are unaffected - API keys are
                just for authentication.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Which network should I use?</h3>
              <p className="text-gray-400 text-sm">
                Always use <strong>Arbitrum One</strong> for deposits and withdrawals. It has the lowest
                fees (~$0.10-0.50) and fastest confirmation times (1-2 minutes). Hyperliquid operates
                on Arbitrum, so this is the native choice.
              </p>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="font-semibold mb-2">Why Windscribe specifically?</h3>
              <p className="text-gray-400 text-sm">
                We tested various free VPNs and Windscribe connecting to Switzerland works reliably
                with Hyperliquid. ProtonVPN&apos;s free tier only allows &quot;Quick Connect&quot; which often
                connects to US or Canada servers - not helpful for bypassing geo-restrictions.
                Windscribe lets you choose Switzerland specifically on the free plan.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
