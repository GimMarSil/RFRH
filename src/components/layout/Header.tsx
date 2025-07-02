import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import NotificationBell from '../evaluation/NotificationBell';

export default function Header() {
  const router = useRouter();

  return (
    <header className="bg-white shadow">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                Evaluation System
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/evaluation/matrices"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  router.pathname.startsWith('/evaluation/matrices')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Matrices
              </Link>
              <Link
                href="/evaluation/evaluations"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  router.pathname.startsWith('/evaluation/evaluations')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Evaluations
              </Link>
              <Link
                href="/evaluation/self-evaluations"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  router.pathname.startsWith('/evaluation/self-evaluations')
                    ? 'border-indigo-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Self Evaluations
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <NotificationBell />
          </div>
        </div>
      </nav>
    </header>
  );
} 