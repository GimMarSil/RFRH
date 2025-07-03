import React from 'react';
import {
  PencilSquareIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  TrashIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface EvaluationMatrix {
  id?: string;
  matrix_id?: string;
  title: string;
  description?: string;
  valid_from: string;
  valid_to: string;
  status: 'active' | 'inactive';
  employee?: {
    CompanyName?: string;
    Number?: string;
    Name?: string;
  };
  employee_id?: string;
}

interface Subordinate {
  id: string;
  name: string;
}

interface MatrixTableProps {
  matrices: EvaluationMatrix[];
  isLoading: boolean;
  selectedEmployeeId?: string | null;
  isManager: boolean;
  subordinates: Subordinate[];
  onNewMatrix: () => void;
  onEdit: (matrix: EvaluationMatrix) => void;
  onShowApplications: (matrix: EvaluationMatrix) => void;
  onCopy: (matrix: EvaluationMatrix) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}

const MatrixTable: React.FC<MatrixTableProps> = ({
  matrices,
  isLoading,
  selectedEmployeeId,
  isManager,
  subordinates,
  onNewMatrix,
  onEdit,
  onShowApplications,
  onCopy,
  onDelete,
  formatDate,
}) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Matrizes de Avaliação</h1>
        {selectedEmployeeId && isManager && subordinates && subordinates.length > 0 && (
          <button
            onClick={onNewMatrix}
            className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition duration-150 flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Nova Matriz
          </button>
        )}
        {selectedEmployeeId && isManager && (!subordinates || subordinates.length === 0) && !isLoading && (
          <p className="text-sm text-gray-600">Você é um gestor, mas não tem subordinados diretos associados no momento.</p>
        )}
        {selectedEmployeeId && !isManager && !isLoading && (
          <p className="text-sm text-gray-600">Apenas gestores com subordinados podem criar novas matrizes.</p>
        )}
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validade</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {matrices.length === 0 && !isLoading && selectedEmployeeId ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  Nenhuma matriz de avaliação encontrada.
                </td>
              </tr>
            ) : matrices.length === 0 && !isLoading && !selectedEmployeeId ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  Por favor, selecione um perfil de funcionário para carregar as matrizes.
                </td>
              </tr>
            ) : (
              matrices.map((matrix) => (
                <tr key={matrix.id || matrix.matrix_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{matrix.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">{matrix.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(matrix.valid_from)} - {formatDate(matrix.valid_to)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{matrix.employee?.CompanyName || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{matrix.employee?.Number || matrix.employee_id || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{matrix.employee?.Name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${matrix.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{matrix.status === 'active' ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                    <button
                      onClick={() => onEdit(matrix)}
                      className="text-indigo-600 hover:text-indigo-900 p-1"
                      title="Editar"
                      disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)}
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onShowApplications(matrix)}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="Ver Aplicações"
                      disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)}
                    >
                      <ClipboardDocumentListIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onCopy(matrix)}
                      className="text-gray-500 hover:text-gray-700 p-1"
                      title="Copiar e Prorrogar"
                      disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)}
                    >
                      <CalendarDaysIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const idToDel = matrix.id || matrix.matrix_id;
                        if (idToDel && idToDel !== 'undefined') {
                          onDelete(idToDel);
                        }
                      }}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Inativar"
                      disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id) || matrix.id === 'undefined' || matrix.matrix_id === 'undefined'}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center p-4 text-sm text-gray-500">Carregando...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default MatrixTable;
