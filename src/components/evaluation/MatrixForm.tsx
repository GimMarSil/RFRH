import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller, SubmitHandler } from 'react-hook-form';
import { message } from 'antd';
import { useSelectedEmployee } from '../../contexts/SelectedEmployeeContext';
import { fetchWithAuth, type ApiClientOptions } from '../../lib/apiClient';
import { InteractionStatus } from '@azure/msal-browser';

// Re-using types from matrices.tsx for now, ideally share them
interface EvaluationCriterion {
  id?: number; // Keep id for existing criteria when editing
  name: string;
  description?: string;
  weight: number | string;
  is_cutting: boolean;
}

interface EvaluationMatrix {
  id?: number;
  title: string;
  description?: string;
  valid_from: string;
  valid_to: string;
  created_by?: string; // This will be set by the backend or session
  status: 'active' | 'inactive';
  criteria: EvaluationCriterion[];
  employee_ids?: string[]; // Changed from applicable_employee_ids
}

// Added Subordinate type (can be moved to a shared types file)
interface Subordinate {
  id: string;
  name: string;
}

interface MatrixFormProps {
  matrix?: EvaluationMatrix | null; // For editing existing matrix
  onClose: () => void;
  onSave: (data: EvaluationMatrix) => Promise<void>; // Make onSave async to handle API calls
  subordinatesList?: Subordinate[]; // Added
  selectedApplicableEmployeeIds?: string[]; // Added
  onSelectedApplicableEmployeesChange?: (ids: string[]) => void; // Added
}

const defaultCriterion: EvaluationCriterion = {
  name: '',
  description: '',
  weight: '', // Init with string for input
  is_cutting: false,
};

const MatrixForm: React.FC<MatrixFormProps> = ({ matrix, onClose, onSave, subordinatesList, selectedApplicableEmployeeIds, onSelectedApplicableEmployeesChange }) => {
  const [subordinatesWithActiveMatrix, setSubordinatesWithActiveMatrix] = useState<string[]>([]);
  const {
    msalInstance,
    accounts,
    inProgress,
    selectedEmployeeId: currentSelectedEmployeeId,
  } = useSelectedEmployee();
  const activeAccount = accounts && accounts.length > 0 ? accounts[0] : null;
  const interactionStatus = inProgress;

  const { register, control, handleSubmit, formState: { errors, isSubmitting }, watch, setValue, reset } = useForm<EvaluationMatrix>({
    defaultValues: matrix ? 
      { 
        ...matrix, 
        criteria: matrix.criteria?.map(c => ({...c, weight: String(c.weight)})) || [defaultCriterion],
        employee_ids: matrix.employee_ids || [] // Initialize from prop
      } :
      { 
        title: '', description: '', valid_from: '', valid_to: '', status: 'active', criteria: [defaultCriterion],
        employee_ids: [] // Initialize as empty array
      },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "criteria",
  });

  const criteriaValues = watch("criteria");
  const totalWeight = criteriaValues.reduce((sum, crit) => sum + parseFloat(String(crit.weight) || '0'), 0);

  useEffect(() => {
    if (matrix) {
      const transformedCriteria = matrix.criteria?.map(c => ({ ...c, weight: String(c.weight) })) || [defaultCriterion];
      reset({ 
        ...matrix, 
        criteria: transformedCriteria,
        employee_ids: matrix.employee_ids || [] 
      });
    } else {
      reset({ 
        title: '', description: '', valid_from: '', valid_to: '', status: 'active', criteria: [defaultCriterion],
        employee_ids: []
      });
    }
  }, [matrix, reset]);

  useEffect(() => {
    // Buscar quais subordinados já têm matriz ativa
    const fetchActiveMatrixForSubs = async () => {
      if (!subordinatesList || subordinatesList.length === 0) return;
      if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None || !currentSelectedEmployeeId) {
        console.warn('[MatrixForm] fetchActiveMatrixForSubs: MSAL context not ready or no selected employee ID.');
        return;
      }

      const ids = subordinatesList.map(s => String(s.id));
      if (ids.length === 0) return;

      try {
        const apiClientOpts: ApiClientOptions = {
          msalInstance,
          interactionStatus,
          activeAccount,
          selectedEmployeeId: currentSelectedEmployeeId,
        };
        const data = await fetchWithAuth<{ activeEmployeeIds?: string[] }>(
          `/api/evaluation-matrices?activeMatrixCheck=${ids.join(',')}`,
          { method: 'GET' },
          apiClientOpts
        );
        setSubordinatesWithActiveMatrix((data?.activeEmployeeIds || []).map(String));
      } catch (error) {
        console.error('Erro ao verificar matrizes ativas:', error);
      }
    };
    fetchActiveMatrixForSubs();
  }, [subordinatesList, msalInstance, activeAccount, interactionStatus, currentSelectedEmployeeId]);

  // Debug logs para garantir tipos corretos
  console.log('subordinatesWithActiveMatrix:', subordinatesWithActiveMatrix);
  console.log('typeof subordinatesWithActiveMatrix[0]:', typeof subordinatesWithActiveMatrix[0]);
  console.log('subordinatesList ids:', subordinatesList?.map(s => s.id));
  console.log('typeof subordinatesList[0].id:', typeof subordinatesList?.[0]?.id);

  // Handle subordinate selection change for checkboxes
  const handleSubordinateSelection = (subordinateId: string | number) => {
    if (!onSelectedApplicableEmployeesChange || !selectedApplicableEmployeeIds) return;

    const idStr = String(subordinateId);
    const currentSelection = selectedApplicableEmployeeIds.map(String);
    const newSelection = currentSelection.includes(idStr)
      ? currentSelection.filter(id => id !== idStr)
      : [...currentSelection, idStr];
    onSelectedApplicableEmployeesChange(newSelection);
    setValue('employee_ids', newSelection); // Update react-hook-form state as well
  };

  const onSubmit: SubmitHandler<EvaluationMatrix> = async (formData) => {
    // formData comes from react-hook-form, it includes title, description, criteria etc.
    // We need to ensure `employee_ids` is also correctly part of the data passed to onSave.
    // The `selectedApplicableEmployeeIds` state holds the current selection from checkboxes.

    const processedCriteria = formData.criteria.map(c => ({
      ...c,
      weight: parseFloat(String(c.weight) || '0'),
      // id should be preserved if present (for existing criteria during edit)
      id: c.id
    }));

    const dataToSave: EvaluationMatrix = {
      // If editing, include the matrix id
      id: matrix?.id, // matrix is the prop passed for editing
      title: formData.title,
      description: formData.description,
      valid_from: formData.valid_from,
      valid_to: formData.valid_to,
      status: formData.status,
      criteria: processedCriteria,
      // Use the state `selectedApplicableEmployeeIds` which is managed by checkbox interactions
      employee_ids: selectedApplicableEmployeeIds || [],
    };

    // The filter for subordinatesWithActiveMatrix seems to be specific to a different workflow previously.
    // For a generic save, we pass what's selected.
    // The parent component's onSave (handleSaveMatrix) will handle the actual API call.
    // if (dataToSave.employee_ids.length === 0 && !matrix?.id) {
    //   message.warning('Nenhum colaborador selecionado para aplicar a nova matriz.');
    //   // Decide if we should return or allow saving a matrix without direct applicability
    //   // return; 
    // }

    // Call the onSave prop (which is handleSaveMatrix in the parent component)
    try {
      await onSave(dataToSave);
      // onClose(); // onSave in parent (handleSaveMatrix) already handles closing modal and fetching matrices
    } catch (error) { 
      // Error handling is done in handleSaveMatrix, which uses toast.error(err.message)
      // If MatrixForm needs its own specific error display beyond what onSave does, add it here.
      // For now, assume onSave's error handling is sufficient.
      console.error("[MatrixForm] onSubmit: Error during onSave call:", error);
      // message.error("Falha ao salvar a matriz a partir do formulário."); // Avoid double toasting if onSave also toasts
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
      <div className="relative bg-white rounded-lg shadow-xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">{matrix ? 'Editar Matriz' : 'Nova Matriz de Avaliação'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Título da Matriz</label>
            <input 
              type="text" 
              id="title" 
              {...register("title", { required: "Título é obrigatório" })} 
              className={`mt-1 block w-full px-3 py-2 border ${errors.title ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição</label>
            <textarea 
              id="description" 
              {...register("description")} 
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="valid_from" className="block text-sm font-medium text-gray-700">Válida de</label>
              <input 
                type="date" 
                id="valid_from" 
                {...register("valid_from", { required: "Data de início da validade é obrigatória" })} 
                className={`mt-1 block w-full px-3 py-2 border ${errors.valid_from ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
              />
              {errors.valid_from && <p className="mt-1 text-xs text-red-500">{errors.valid_from.message}</p>}
            </div>
            <div>
              <label htmlFor="valid_to" className="block text-sm font-medium text-gray-700">Válida até</label>
              <input 
                type="date" 
                id="valid_to" 
                {...register("valid_to", { required: "Data de fim da validade é obrigatória" })} 
                className={`mt-1 block w-full px-3 py-2 border ${errors.valid_to ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
              />
              {errors.valid_to && <p className="mt-1 text-xs text-red-500">{errors.valid_to.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
            <select 
              id="status" 
              {...register("status")} 
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="active">Ativa</option>
              <option value="inactive">Inativa</option>
            </select>
          </div>

          {/* Subordinates Selection - Added Section */}
          {subordinatesList && subordinatesList.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-700 mb-2">Aplicar Matriz para Subordinados:</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                {subordinatesList.map(subordinate => {
                  const hasActiveMatrix = subordinatesWithActiveMatrix.includes(String(subordinate.id));
                  return (
                    <div key={subordinate.id} className={`flex items-center ${hasActiveMatrix ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        id={`subordinate-${subordinate.id}`}
                        value={String(subordinate.id)}
                        checked={selectedApplicableEmployeeIds?.map(String).includes(String(subordinate.id)) || false}
                        onChange={() => handleSubordinateSelection(subordinate.id)}
                        className={`h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2 ${
                          hasActiveMatrix ? 'cursor-not-allowed bg-gray-100' : ''
                        }`}
                        disabled={hasActiveMatrix}
                      />
                      <label 
                        htmlFor={`subordinate-${subordinate.id}`} 
                        className={`text-sm text-gray-700 ${hasActiveMatrix ? 'cursor-not-allowed' : ''}`}
                      >
                        {subordinate.name}
                      </label>
                      {hasActiveMatrix && (
                        <span className="ml-2 text-xs text-red-500">Já possui matriz ativa</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {(!selectedApplicableEmployeeIds || selectedApplicableEmployeeIds.length === 0) && !matrix && (
                <p className="mt-1 text-xs text-gray-500">Nenhum subordinado selecionado. A matriz será criada sem aplicabilidade direta inicial.</p>
              )}
            </div>
          )}
          {subordinatesList && subordinatesList.length === 0 && !matrix && (
             <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                    Nenhum subordinado encontrado para este gestor ou a lista ainda não foi carregada.
                    A matriz será criada sem aplicabilidade direta inicial.
                </p>
            </div>
          )}

          <hr className="my-6"/>

          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-3">Critérios de Avaliação</h3>
          {fields.map((field, index) => (
            <div key={field.id} className="p-4 border border-gray-200 rounded-md space-y-3 mb-3">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-gray-800">Critério {index + 1}</h4>
                {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="text-red-500 hover:text-red-700 text-sm">
                      Remover Critério
                    </button>
                )}
              </div>
              <div>
                <label htmlFor={`criteria.${index}.name`} className="block text-xs font-medium text-gray-600">Nome do Critério</label>
                <input 
                  type="text" 
                  {...register(`criteria.${index}.name` as const, { required: "Nome do critério é obrigatório" })} 
                  className={`mt-1 block w-full px-2 py-1 border ${errors.criteria?.[index]?.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm text-sm`}
                />
                {errors.criteria?.[index]?.name && <p className="mt-1 text-xs text-red-500">{errors.criteria?.[index]?.name?.message}</p>}
              </div>
              <div>
                <label htmlFor={`criteria.${index}.description`} className="block text-xs font-medium text-gray-600">Descrição do Critério</label>
                <textarea 
                  {...register(`criteria.${index}.description` as const)} 
                  rows={2}
                  className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                 <div>
                    <label htmlFor={`criteria.${index}.weight`} className="block text-xs font-medium text-gray-600">Peso (%)</label>
                    <Controller
                        name={`criteria.${index}.weight` as const}
                        control={control}
                        rules={{ required: "Peso é obrigatório", min: { value: 0, message: "Peso não pode ser negativo"}, max: {value: 100, message: "Peso não pode exceder 100"} }}
                        render={({ field: { onChange, onBlur, value, name } }) => (
                            <input 
                                type="number"
                                value={value}
                                onChange={e => onChange(parseFloat(e.target.value) || '')}
                                onBlur={onBlur}
                                name={name}
                                className={`mt-1 block w-full px-2 py-1 border ${errors.criteria?.[index]?.weight ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm text-sm`}
                            />
                        )}
                    />
                    {errors.criteria?.[index]?.weight && <p className="mt-1 text-xs text-red-500">{errors.criteria?.[index]?.weight?.message}</p>}
                 </div>
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    {...register(`criteria.${index}.is_cutting` as const)} 
                    id={`criteria.${index}.is_cutting`}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
                  />
                  <label htmlFor={`criteria.${index}.is_cutting`} className="text-sm text-gray-700">É de Corte?</label>
                </div>
              </div>
            </div>
          ))}
          <button 
            type="button" 
            onClick={() => append(defaultCriterion)} 
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Adicionar Critério
          </button>

          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
            Peso Total dos Critérios: <span className={`font-bold ${totalWeight !== 100 ? 'text-red-600' : 'text-green-600'}`}>{totalWeight.toFixed(2)}%</span>
            {totalWeight !== 100 && <p className="text-xs text-red-500">A soma dos pesos deve ser 100%.</p>}
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
            >
              {isSubmitting ? (matrix ? 'Salvando...' : 'Criando...') : (matrix ? 'Salvar Alterações' : 'Criar Matriz')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatrixForm; 