import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import NotificationBell from '../evaluation/NotificationBell';
import { useSelectedEmployee } from '@/contexts/SelectedEmployeeContext';

interface HeaderProps {
  employees: { employee_number: number; Name: string }[];
  onChange: (index: number) => void;
  loading: boolean;
}

export default function Header({ employees, onChange, loading }: HeaderProps) {
  const router = useRouter();
  const {
    employeeProfileName,
    selectedEmployeeId,
  } = useSelectedEmployee();

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
          <div className="flex items-center space-x-4">
            {selectedEmployeeId && (
              <span className="text-sm text-gray-700">
                {employeeProfileName}
              </span>
            )}
            {employees.length > 0 && (
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm"
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                value={employees.findIndex(e => String(e.employee_number) === selectedEmployeeId)}
              >
                {employees.map((emp, idx) => (
                  <option key={emp.employee_number} value={idx}>
                    {emp.Name}
                  </option>
                ))}
              </select>
            )}
            {loading && <span className="text-sm text-gray-500">A carregar...</span>}
            <NotificationBell />
          </div>
        </div>
      </nav>
    </header>
  );
} 