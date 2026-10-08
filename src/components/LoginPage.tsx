/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Mock minimal delay for premium feel
    setTimeout(() => {
      if (username === 'midhun' && password === 'midhun123') {
        onLoginSuccess();
      } else {
        setError('Invalid username or password. Please use correct administrator credentials.');
        setIsSubmitting(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center relative overflow-hidden gradient-4-color p-4">
      {/* Refined Ambient Glow Backgrounds matching main dashboard theme */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-indigo-200/30 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[550px] h-[550px] rounded-full bg-violet-200/30 blur-[120px] pointer-events-none animate-pulse" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        
        {/* Actual Glass/White Premium Elegant Card with deep shadow */}
        <div className="relative bg-white/30 backdrop-blur-2xl rounded-3xl p-8 md:p-10 flex flex-col border border-white/80 shadow-[0_25px_60px_-15px_rgba(99,102,241,0.15),0_1px_3px_rgba(0,0,0,0.05)]">
          
          {/* Header & Logo with high depth */}
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-600/20 mb-4 transition-transform hover:scale-105">
              <ShieldCheck className="w-7 h-7" />
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-50 border border-violet-100 text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-violet-500" />
              Allowance
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-display">
              Midhun Maheswar M D
            </h1>
            <p className="text-xs text-slate-700 mt-1 font-medium">
              Authorized personnel access only
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 font-display" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="Enter administrator username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-950 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/5 transition duration-150"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 font-display" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-950 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/5 transition duration-150"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div id="login-error" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 flex gap-2.5 items-start text-xs text-rose-700 animate-fadeIn shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Submit Button aligned with the main Violet styling */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-250 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl ${
                isSubmitting
                  ? 'bg-slate-100 text-slate-600 cursor-not-allowed shadow-none'
                  : 'bg-violet-600 hover:bg-violet-750 text-white shadow-violet-600/25 hover:shadow-violet-600/35 hover:-translate-y-0.5'
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Secure Sign In
                </>
              )}
            </button>
          </form>

          {/* Card Footer credit with enhanced branding */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-600 tracking-wide font-bold uppercase">
              Program developed by{' '}
              <span className="text-violet-600 font-extrabold block mt-0.5 text-xs tracking-normal normal-case">
                Midhun Maheswar M D
              </span>
            </p>
          </div>

        </div>
      </div>

      {/* Global Bottom Credit */}
      <div className="mt-10 text-center text-[10px] text-slate-700 font-bold tracking-widest uppercase relative z-10 bg-white/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/50 shadow-sm">
        Depot Report Audit Suite • Built for Enterprise Transit Integrity
      </div>
    </div>
  );
}
