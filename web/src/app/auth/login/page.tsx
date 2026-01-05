"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef, Suspense, KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";

const COLORS = {
  bg0: '#0a0a0f',
  bg1: '#0f0f14',
  bg2: '#161620',
  accent: '#3B82F6',
  accentHover: '#2563EB',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHover: 'rgba(255, 255, 255, 0.1)',
};

// Provider configuration: Google, Apple, Facebook, GitHub
const PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill={COLORS.textPrimary}>
        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
      </svg>
    ),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: (
      <svg className="w-5 h-5" fill={COLORS.textPrimary} viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
      </svg>
    ),
  },
];

const LAST_USED_KEY = 'systems_trader_last_login_method';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [mode, setMode] = useState<'form' | 'verify'>('form');
  const [authMethod, setAuthMethod] = useState<'code' | 'password'>('password'); // Default to password for now
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get('callbackUrl') || '/sessions';

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(LAST_USED_KEY);
    if (stored) {
      setLastUsed(stored);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(provider);
    localStorage.setItem(LAST_USED_KEY, provider);
    await signIn(provider, { callbackUrl });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading('email');
    setError('');
    localStorage.setItem(LAST_USED_KEY, 'email');

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmail(normalizedEmail);
        setMode('verify');
        setCode(['', '', '', '', '', '']);
        setResendCooldown(60);
      } else {
        setError(data.error || 'Failed to send code. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading('password');
    setError('');
    localStorage.setItem(LAST_USED_KEY, 'password');

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        window.location.href = callbackUrl;
        return;
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(null);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      setIsLoading('code');
      setTimeout(() => handleCodeSubmit(newCode.join('')), 50);
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < 6; i++) {
        newCode[i] = pastedData[i] || '';
      }
      setCode(newCode);
      const lastFilledIndex = Math.min(pastedData.length - 1, 5);
      codeInputRefs.current[lastFilledIndex]?.focus();
      if (pastedData.length === 6) {
        handleCodeSubmit(pastedData);
      }
    }
  };

  const handleCodeSubmit = async (codeValue?: string) => {
    if (isLoading === 'code' && !codeValue) return;

    const fullCode = codeValue || code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    if (isLoading !== 'code') {
      setIsLoading('code');
    }
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), code: fullCode }),
      });

      const data = await res.json();

      if (res.ok) {
        const isSecure = window.location.protocol === 'https:';
        const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
        const secureFlag = isSecure ? '; Secure' : '';
        document.cookie = `${cookieName}=${data.sessionToken}; path=/; max-age=2592000; SameSite=Lax${secureFlag}`;
        window.location.href = callbackUrl;
        return;
      } else {
        setError(data.error || 'Invalid code. Please try again.');
        setCode(['', '', '', '', '', '']);
        codeInputRefs.current[0]?.focus();
        setIsLoading(null);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setIsLoading(null);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading('resend');
    setError('');

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      if (res.ok) {
        setCode(['', '', '', '', '', '']);
        codeInputRefs.current[0]?.focus();
        setResendCooldown(60);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to resend code');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex relative" style={{ background: COLORS.bg0 }}>
      {/* Mobile background */}
      <div className="lg:hidden absolute inset-0 overflow-hidden">
        <img
          src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/abstract-glass-walls.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover mobile-bg-animate"
          style={{
            filter: 'hue-rotate(200deg) saturate(1.3) brightness(0.85)',
            objectPosition: 'center center',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 50%, rgba(59, 130, 246, 0.1) 100%)',
            mixBlendMode: 'overlay',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10, 10, 15, 0.4) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(10, 10, 15, 0.6)',
          }}
        />
      </div>

      {/* Left Side - Visual Panel (Desktop only) */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img
          src="https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/abstract-glass-walls.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover desktop-bg-animate"
          style={{
            filter: 'hue-rotate(200deg) saturate(1.3) brightness(0.9)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(59,130,246,0.1) 50%, rgba(59,130,246,0.2) 100%)',
            mixBlendMode: 'overlay',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(10,10,15,0.3) 0%, rgba(10,10,15,0.1) 40%, rgba(10,10,15,0.4) 70%, rgba(10,10,15,0.95) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,10,15,0.4) 100%)',
          }}
        />

        {/* Content on left panel */}
        <div className="relative z-10 flex flex-col h-full p-12 xl:p-16 max-w-3xl">
          {/* Logo at top */}
          <Link href="/" className="flex items-center gap-3 group mb-auto">
            <Logo size="lg" showText={true} />
          </Link>

          {/* Center content */}
          <div className="space-y-6 my-auto">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: COLORS.accent,
              }}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              Pattern Validation Platform
            </div>
            <h1
              className="text-5xl font-bold leading-tight"
              style={{ color: COLORS.textPrimary }}
            >
              Validate Your<br />
              <span style={{ color: COLORS.accent }}>Trading Patterns</span>
            </h1>
            <p
              className="text-lg max-w-md leading-relaxed"
              style={{ color: COLORS.textSecondary }}
            >
              Collaborative platform for testing and validating trading pattern detection algorithms with real market data.
            </p>
          </div>

          {/* Footer */}
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            © 2025 Systems Trader. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col min-h-screen z-20 relative">
        {/* Mobile header */}
        <header className="lg:hidden p-6">
          <Link href="/">
            <Logo size="md" showText={true} />
          </Link>
        </header>

        {/* Login form container */}
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div
            className={`w-full max-w-[380px] transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            {/* Glass card on mobile, solid on desktop */}
            <div
              className="px-8 py-12 rounded-2xl backdrop-blur-xl lg:backdrop-blur-none"
              style={{
                background: 'rgba(15, 15, 20, 0.85)',
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
              }}
            >
              {/* Header */}
              <div className="text-center mb-10">
                <h2
                  className="text-2xl font-semibold mb-2"
                  style={{ color: COLORS.textPrimary }}
                >
                  Welcome back
                </h2>
                <p style={{ color: COLORS.textMuted }}>
                  Sign in to continue
                </p>
              </div>

              {mode === 'form' ? (
                <div key="form" className="mode-enter">
                  {/* OAuth buttons */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {PROVIDERS.map((provider) => {
                      const isLastUsed = lastUsed === provider.id;
                      return (
                        <div key={provider.id} className="relative">
                          {isLastUsed && (
                            <div
                              className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider z-10 whitespace-nowrap"
                              style={{
                                background: COLORS.accent,
                                color: '#000',
                                boxShadow: `0 2px 8px -2px ${COLORS.accent}80`,
                              }}
                            >
                              Last
                            </div>
                          )}
                          <button
                            onClick={() => handleOAuthSignIn(provider.id)}
                            disabled={isLoading !== null}
                            className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-50 hover:translate-y-[-2px] hover:border-white/10 ${isLastUsed ? 'oauth-btn-last' : 'oauth-btn'}`}
                            title={`Sign in with ${provider.name}`}
                          >
                            {isLoading === provider.id ? (
                              <div
                                className="w-4 h-4 border-2 rounded-full animate-spin"
                                style={{ borderColor: `${COLORS.textMuted}40`, borderTopColor: COLORS.textMuted }}
                              />
                            ) : (
                              provider.icon
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px" style={{ background: COLORS.border }} />
                    <span
                      className="text-xs font-medium uppercase tracking-wider"
                      style={{ color: COLORS.textMuted }}
                    >
                      or continue with email
                    </span>
                    <div className="flex-1 h-px" style={{ background: COLORS.border }} />
                  </div>

                  {/* Auth method toggle */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => { setAuthMethod('code'); setError(''); }}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200"
                      style={{
                        background: authMethod === 'code' ? `${COLORS.accent}20` : 'transparent',
                        border: `1px solid ${authMethod === 'code' ? COLORS.accent + '50' : COLORS.border}`,
                        color: authMethod === 'code' ? COLORS.accent : COLORS.textMuted,
                      }}
                    >
                      Email Code
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMethod('password'); setError(''); }}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200"
                      style={{
                        background: authMethod === 'password' ? `${COLORS.accent}20` : 'transparent',
                        border: `1px solid ${authMethod === 'password' ? COLORS.accent + '50' : COLORS.border}`,
                        color: authMethod === 'password' ? COLORS.accent : COLORS.textMuted,
                      }}
                    >
                      Password
                    </button>
                  </div>

                  {/* Email/Password form */}
                  <form onSubmit={authMethod === 'code' ? handleEmailSignIn : handlePasswordSignIn} className="space-y-4">
                    <div className="relative">
                      {(lastUsed === 'email' || lastUsed === 'password') && (
                        <div
                          className="absolute -top-2 left-3 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider z-10"
                          style={{
                            background: COLORS.accent,
                            color: '#000',
                            boxShadow: `0 2px 8px -2px ${COLORS.accent}80`,
                          }}
                        >
                          Last used
                        </div>
                      )}
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-12 px-4 rounded-xl text-sm transition-all duration-200 outline-none"
                        style={{
                          background: COLORS.bg2,
                          border: `1px solid ${focusedInput === 'email' ? COLORS.accent + '50' : COLORS.border}`,
                          color: COLORS.textPrimary,
                          boxShadow: focusedInput === 'email' ? `0 0 0 3px ${COLORS.accent}15` : 'none',
                        }}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </div>

                    {authMethod === 'password' && (
                      <div className="relative">
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full h-12 px-4 rounded-xl text-sm transition-all duration-200 outline-none"
                          style={{
                            background: COLORS.bg2,
                            border: `1px solid ${focusedInput === 'password' ? COLORS.accent + '50' : COLORS.border}`,
                            color: COLORS.textPrimary,
                            boxShadow: focusedInput === 'password' ? `0 0 0 3px ${COLORS.accent}15` : 'none',
                          }}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                        />
                      </div>
                    )}

                    {error && (
                      <p className="text-sm text-center" style={{ color: '#ef4444' }}>{error}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading !== null || !email || (authMethod === 'password' && !password)}
                      className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 submit-btn hover:translate-y-[-1px]"
                    >
                      {isLoading === 'email' ? 'Sending code...' : isLoading === 'password' ? 'Signing in...' : authMethod === 'code' ? 'Continue with email' : 'Sign in'}
                    </button>
                  </form>
                </div>
              ) : (
                /* Verification mode */
                <div key="verify" className="mode-enter space-y-6">
                  {/* Success indicator */}
                  <div
                    className="flex items-center justify-center gap-3 p-4 rounded-xl"
                    style={{
                      background: `${COLORS.accent}15`,
                      border: `1px solid ${COLORS.accent}30`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: COLORS.accent }}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: COLORS.textPrimary }}>
                        Check your email
                      </p>
                      <p className="text-xs" style={{ color: COLORS.textMuted }}>
                        Code sent to {email}
                      </p>
                    </div>
                  </div>

                  {/* Code input */}
                  <div>
                    <p className="text-sm text-center mb-4" style={{ color: COLORS.textSecondary }}>
                      Enter the 6-digit code
                    </p>
                    <div className="flex gap-2 justify-center mb-4">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={el => { codeInputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(index, e)}
                          onPaste={handleCodePaste}
                          className={`code-input w-11 h-14 text-center text-xl font-bold rounded-lg transition-colors duration-150 outline-none ${digit ? 'code-input-filled' : ''} ${isLoading === 'code' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={isLoading === 'code'}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>

                    {error && (
                      <p className="text-sm text-center mb-4" style={{ color: '#ef4444' }}>{error}</p>
                    )}

                    <button
                      onClick={() => handleCodeSubmit()}
                      disabled={isLoading === 'code' || code.some(d => !d)}
                      className="w-full h-12 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 submit-btn hover:translate-y-[-1px]"
                    >
                      {isLoading === 'code' ? 'Verifying...' : 'Continue'}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => {
                        setMode('form');
                        setCode(['', '', '', '', '', '']);
                        setError('');
                      }}
                      className="transition-colors hover:underline"
                      style={{ color: COLORS.textSecondary }}
                    >
                      ← Use different email
                    </button>
                    <button
                      onClick={handleResendCode}
                      disabled={isLoading === 'resend' || resendCooldown > 0}
                      className="transition-colors hover:underline disabled:opacity-50"
                      style={{ color: resendCooldown > 0 ? COLORS.textMuted : COLORS.accent }}
                    >
                      {isLoading === 'resend' ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}

              {/* Terms */}
              <p className="mt-6 text-xs text-center leading-relaxed" style={{ color: COLORS.textMuted }}>
                By continuing, you agree to our{' '}
                <Link
                  href="/terms"
                  className="transition-colors hover:underline"
                  style={{ color: COLORS.textSecondary }}
                >
                  Terms
                </Link>
                {' '}and{' '}
                <Link
                  href="/privacy"
                  className="transition-colors hover:underline"
                  style={{ color: COLORS.textSecondary }}
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </main>

        {/* Mobile footer */}
        <footer className="p-6 text-center lg:hidden">
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            © 2025 Systems Trader
          </span>
        </footer>
      </div>

      {/* CSS Animations and Button Styles */}
      <style jsx global>{`
        .desktop-bg-animate {
          animation: desktopDrift 25s ease-in-out infinite;
        }
        .mobile-bg-animate {
          animation: mobileDrift 20s ease-in-out infinite;
        }
        @keyframes desktopDrift {
          0%, 100% {
            transform: scale(1.2) translate(0, 0);
          }
          50% {
            transform: scale(1.2) translate(-2.5%, 1%);
          }
        }
        @keyframes mobileDrift {
          0%, 100% {
            transform: scale(1.35) translate(0, 0);
          }
          50% {
            transform: scale(1.35) translate(-3%, 1.5%);
          }
        }
        /* OAuth button base styles */
        .oauth-btn {
          background: #161620;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .oauth-btn-last {
          background: #161620;
          border: 1px solid rgba(59, 130, 246, 0.3);
          box-shadow: 0 0 20px -5px rgba(59, 130, 246, 0.3);
        }
        /* Submit button styles */
        .submit-btn {
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          color: #fff;
          box-shadow: 0 4px 14px -4px rgba(59, 130, 246, 0.5);
        }
        .submit-btn:hover:not(:disabled) {
          box-shadow: 0 6px 20px -4px rgba(59, 130, 246, 0.6);
        }
        /* Mode transition animations */
        .mode-enter {
          animation: modeEnter 0.3s ease-out forwards;
        }
        @keyframes modeEnter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Code input styles */
        .code-input {
          background: #161620;
          border: 2px solid rgba(255, 255, 255, 0.06);
          color: #f4f4f5;
          caret-color: #3B82F6;
        }
        .code-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .code-input-filled {
          border-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#3B82F6' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
