import React from 'react';
import { Dialog, Transition } from '@headlessui/react';

interface ConfirmInactivateModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmInactivateModal: React.FC<ConfirmInactivateModalProps> = ({ open, onCancel, onConfirm }) => (
  <Transition.Root show={open} as={React.Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onCancel}>
      <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </Transition.Child>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
          <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">Inativar aplicação?</Dialog.Title>
            <p className="mb-4">Esta ação irá inativar esta aplicação de matriz. Deseja continuar?</p>
            <div className="flex justify-end gap-2">
              <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Cancelar</button>
              <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">Inativar</button>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition.Root>
);

export default ConfirmInactivateModal;
