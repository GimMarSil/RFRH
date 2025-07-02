import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ClipboardListIcon, // For Matrizes
  UserGroupIcon,     // For Avaliar Subordinados
  CollectionIcon,    // For Minhas Avaliações (or similar)
  ClockIcon,         // For Pendentes
  CheckCircleIcon,   // For Concluídas
  DocumentTextIcon,  // For Balanços Pendentes
  PlusCircleIcon,    // For Nova Matriz
  AdjustmentsHorizontalIcon, // for Matrizes de Avaliação button
  IdentificationIcon, // for Minhas Avaliações button
} from '@heroicons/react/24/outline';

// Placeholder data for summary cards - replace with actual data fetching later
const summaryData = {
  pendingReviews: 1,
  completedReviews: 2,
  pendingBalances: 2,
};

const EvaluationDashboardPage = () => {
  const [activeTab, setActiveTab] = useState<'gestor' | 'colaborador'>('gestor');

  // TODO: Fetch actual data based on user role (manager/employee) and their ID
  // For now, using placeholder data and simple role switching.

  return (
    <>
      <Head>
        <title>Avaliação de Desempenho</title>
      </Head>

      <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">Avaliação de Desempenho</h1>
          <div className="flex space-x-3">
            <Link href="/evaluation/matrices" legacyBehavior>
              <a className="bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-md shadow-sm text-sm font-medium flex items-center">
                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2 text-gray-500" />
                Matrizes de Avaliação
              </a>
            </Link>
            <button 
              onClick={() => alert('Navegar para Minhas Avaliações (placeholder)')}
              className="bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md shadow-sm text-sm font-medium flex items-center"
            >
              <IdentificationIcon className="h-5 w-5 mr-2" />
              Minhas Avaliações
            </button>
          </div>
        </div>

        {/* Summary Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avaliações Pendentes</p>
              <p className="text-3xl font-semibold text-gray-800">{summaryData.pendingReviews}</p>
              <p className="text-xs text-gray-400">Avaliações a aguardar preenchimento</p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-500" />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Avaliações Concluídas</p>
              <p className="text-3xl font-semibold text-gray-800">{summaryData.completedReviews}</p>
              <p className="text-xs text-gray-400">Avaliações finalizadas este mês</p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Balanços Pendentes</p>
              <p className="text-3xl font-semibold text-gray-800">{summaryData.pendingBalances}</p>
              <p className="text-xs text-gray-400">F-RH-04 a aguardar preenchimento</p>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        {/* Tabs for Gestor / Colaborador */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('gestor')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === 'gestor'
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Gestor
              </button>
              <button
                onClick={() => setActiveTab('colaborador')}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === 'colaborador'
                      ? 'border-black text-black'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                Colaborador
              </button>
            </nav>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          {activeTab === 'gestor' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-1">Ações do Gestor</h2>
              <p className="text-sm text-gray-500 mb-6">Gerencie as avaliações dos seus subordinados.</p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <Link href="/evaluation/evaluate" legacyBehavior>
                  <a className="w-full sm:w-auto flex-1 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                    Avaliar Colaboradores
                  </a>
                </Link>
                <Link href="/evaluation/matrices" legacyBehavior>
                  <a className="w-full sm:w-auto flex-1 bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">
                    Nova Matriz de Avaliação
                  </a>
                </Link>
              </div>
              {/* TODO: Add table/list of pending evaluations for manager view here */}
            </div>
          )}

          {activeTab === 'colaborador' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-1">Ações do Colaborador</h2>
              <p className="text-sm text-gray-500 mb-6">Acompanhe o seu desempenho e preencha os seus formulários.</p>
              {/* TODO: Add content for Colaborador view */}
              <p className="text-center text-gray-500 py-8">Conteúdo do colaborador em desenvolvimento.</p>
            </div>
          )}
        </div>

      </div>
    </>
  );
};

export default EvaluationDashboardPage; 