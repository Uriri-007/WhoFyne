'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { PageTransition } from '@/src/components/Navigation';
import { Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}/profile`,
          },
        });

        if (error) {
          throw error;
        }

        router.push('/profile'); // Redirect to profile to fill out details
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        router.push('/'); // Redirect home
      }
    } catch (err: any) {
      // Don't log expected auth errors to console to avoid cluttering and confusion
      if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/user-not-found' && err.code !== 'auth/wrong-password') {
        console.error('Authentication error:', err);
      }
      
      if (err.message?.toLowerCase().includes('provider is not enabled')) {
        setError('Email/Password sign-up is not allowed. Please check your Supabase auth settings.');
      } else if (err.message?.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email or password. Please try again.');
      } else if (err.message?.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists.');
      } else if (err.message?.toLowerCase().includes('password')) {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (err.message?.toLowerCase().includes('rate limit')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-neutral-900 p-10 rounded-[2.5rem] shadow-xl border border-neutral-100 dark:border-neutral-800 relative overflow-hidden">
          
          {/* Background decor */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-amber-50 dark:bg-amber-900/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
          
          <div className="relative z-10 text-center">
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              {isSignUp ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              {isSignUp 
                ? 'Join to curate and share your vibrance.' 
                : 'Enter your details to access your account.'}
            </p>
          </div>

          <form className="relative z-10 mt-8 space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 pl-1">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                    </div>
                    <input
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-11 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-0 text-neutral-900 dark:text-white rounded-2xl ring-1 ring-inset ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all sm:text-sm"
                      placeholder="johndoe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 pl-1">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                  </div>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-0 text-neutral-900 dark:text-white rounded-2xl ring-1 ring-inset ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 pl-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-neutral-400 dark:text-neutral-500" />
                  </div>
                  <input
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border-0 text-neutral-900 dark:text-white rounded-2xl ring-1 ring-inset ring-neutral-200 dark:ring-neutral-700 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 transition-all sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-indigo-500/25"
              >
                {loading ? 'Processing...' : isSignUp ? 'Sign up' : 'Sign in'}
                {!loading && (
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </div>
          </form>

          <div className="relative z-10 mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
                Or continue with
              </span>
            </div>
          </div>

          <div className="relative z-10 mt-6 text-center text-sm">
            <button
              onClick={handleGoogleAuth}
              type="button"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-sm text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.74 22.37 10.04H12V14.22H17.92C17.66 15.58 16.89 16.74 15.74 17.51V20.24H19.3C21.38 18.32 22.56 15.54 22.56 12.25Z" fill="#4285F4"/>
                <path d="M12 23C14.97 23 17.46 22.02 19.3 20.24L15.74 17.51C14.75 18.17 13.48 18.57 12 18.57C9.13 18.57 6.7 16.63 5.82 14.04H2.16V16.88C3.98 20.49 7.71 23 12 23Z" fill="#34A853"/>
                <path d="M5.82 14.04C5.59 13.37 5.46 12.7 5.46 12C5.46 11.3 5.59 10.63 5.82 9.96V7.12H2.16C1.41 8.62 1 10.26 1 12C1 13.74 1.41 15.38 2.16 16.88L5.82 14.04Z" fill="#FBBC05"/>
                <path d="M12 5.38C13.62 5.38 15.06 5.93 16.2 7.02L19.38 3.84C17.46 2.05 14.97 1 12 1C7.71 1 3.98 3.51 2.16 7.12L5.82 9.96C6.7 7.37 9.13 5.38 12 5.38Z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>

          <div className="relative z-10 mt-8 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {isSignUp ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
                >
                  Sign up
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
