import React from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface ApplyMatrixModalProps {
  open: boolean;
  employee_id?: string;
  valid_from?: string;
  valid_to?: string;
  onClose: () => void;
  onSubmit: (values: { employeeIds: string[]; validFrom: string; validTo: string }) => void;
}

const ApplyMatrixModal: React.FC<ApplyMatrixModalProps> = ({ open, employee_id, valid_from, valid_to, onClose, onSubmit }) => (
  <Transition.Root show={open} as={React.Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onClose}>
      <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </Transition.Child>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
          <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">Aplicar Nova Matriz</Dialog.Title>
            <form
              onSubmit={async e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const employeeIds = [form.employee_id.value];
                const validFrom = form.valid_from.value;
                const validTo = form.valid_to.value;
                onSubmit({ employeeIds, validFrom, validTo });
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                <input name="employee_id" className="w-full border rounded px-2 py-1" value={employee_id || ''} readOnly />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Válido de</label>
                <input name="valid_from" type="date" className="w-full border rounded px-2 py-1" defaultValue={valid_from || ''} required />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                <input name="valid_to" type="date" className="w-full border rounded px-2 py-1" defaultValue={valid_to || ''} required />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white">Aplicar</button>
              </div>
            </form>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition.Root>
);

export default ApplyMatrixModal;
