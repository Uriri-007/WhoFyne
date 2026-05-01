'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, User, Upload, LogOut, LogIn } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, profile, isWhitelisted, logout } = useAuth();
  const pathname = usePathname();

  // Hide navbar on login page
  if (pathname === '/login') return null;

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { name: 'Gallery', path: '/', icon: Home },
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-full shadow-2xl flex items-center gap-2 md:gap-4 max-w-[95vw] md:max-w-none transition-colors">
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          prefetch={true}
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 ${
            isActive(item.path)
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg scale-105'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <item.icon className="w-5 h-5" />
          <span className="hidden md:block text-sm font-medium">{item.name}</span>
        </Link>
      ))}

      {isWhitelisted && (
        <Link
          href="/upload"
          prefetch={true}
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 ${
            isActive('/upload')
              ? 'bg-indigo-600 text-white shadow-lg scale-105'
              : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span className="hidden md:block text-sm font-medium">Upload</span>
        </Link>
      )}

      {!user ? (
        <Link
          href="/login"
          className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 ${
            isActive('/login')
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-lg scale-105'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <LogIn className="w-5 h-5" />
          <span className="hidden md:block text-sm font-medium">Sign In</span>
        </Link>
      ) : (
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-200 dark:border-neutral-800 transition-colors">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 transition-colors bg-white dark:bg-neutral-800">
            <img
              src={profile?.avatarUrl || user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
              alt="User"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <button
            onClick={logout}
            className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </nav>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function Footer() {
  return (
    <div className="pt-24 pb-32 px-6 text-center text-neutral-400 text-xs font-mono">
      <p>© 2026 WHOFYNE • CURATED VIBRANCE</p>
    </div>
  );
}
