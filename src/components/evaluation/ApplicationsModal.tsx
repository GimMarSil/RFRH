import React from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface Applicability {
  id: number;
  employee_id: string;
  employee_name?: string;
  valid_from: string;
  valid_to: string;
  status: string;
}

interface EvaluationMatrix {
  id?: string;
  title: string;
}

interface ApplicationsModalProps {
  open: boolean;
  onClose: () => void;
  matrix?: EvaluationMatrix | null;
  applications: Applicability[];
  formatDate: (date: string) => string;
  getStatus: (app: Applicability) => string;
  onNewVersion: (app: Applicability) => void;
}

const ApplicationsModal: React.FC<ApplicationsModalProps> = ({
  open,
  onClose,
  matrix,
  applications,
  formatDate,
  getStatus,
  onNewVersion,
}) => (
  <Transition.Root show={open} as={React.Fragment}>
    <Dialog as="div" className="relative z-10" onClose={onClose}>
      <Transition.Child
        as={React.Fragment}
        enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
        leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </Transition.Child>
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="relative bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl sm:w-full sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title as="h3" className="text-lg leading-6 font-medium text-gray-900">
                  Aplicações da Matriz: {matrix?.title}
                </Dialog.Title>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <span className="sr-only">Fechar</span>
                  ×
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-gray-500">Nenhuma aplicação encontrada.</td>
                      </tr>
                    ) : (
                      applications.map(app => (
                        <tr key={app.id}>
                          <td className="px-4 py-2 whitespace-nowrap">{app.employee_name || app.employee_id}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{formatDate(app.valid_from)} - {formatDate(app.valid_to)}</td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className={
                              getStatus(app) === 'Ativa' ? 'text-green-700 font-semibold' :
                              getStatus(app) === 'Expirada' ? 'text-yellow-700 font-semibold' :
                              'text-red-700 font-semibold'
                            }>
                              {getStatus(app)}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button onClick={() => onNewVersion(app)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Nova versão para este colaborador">
                              <ArrowPathIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition.Root>
);

export default ApplicationsModal;
