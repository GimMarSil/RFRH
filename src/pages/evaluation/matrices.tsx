import React, { useEffect, useState, Fragment } from 'react';
import Head from 'next/head';
import MatrixForm from '../../components/evaluation/MatrixForm'; // Adjusted path
import { toast } from 'react-toastify';
import { PlusIcon, PencilSquareIcon, DocumentDuplicateIcon, TrashIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useSelectedEmployee } from '../../contexts/SelectedEmployeeContext'; // Added
import { fetchWithAuth } from '../../lib/apiClient'; // Added
import { InteractionStatus, type AccountInfo } from '@azure/msal-browser'; // Added for enum usage
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/router';

// Types (assuming they might be shared later, keeping here for now)
interface EvaluationCriterion {
  id?: number;
  name: string;
  description?: string;
  weight: number | string;
  is_cutting: boolean;
  // created_by, updated_by could be added if needed on client-side for specific logic
}

interface EvaluationMatrix {
  id?: string; // Changed to string to match UUID from backend
  matrix_id?: string; // Common alternative, ensure consistency with fetched data
  title: string;
  description?: string;
  valid_from: string;
  valid_to: string;
  created_by?: string;
  status: 'active' | 'inactive';
  criteria: EvaluationCriterion[];
  applicable_employee_ids?: string[]; // Added for the new feature
  effective_status?: 'active' | 'inactive'; // Added based on previous work
}

// Added Subordinate type
interface Subordinate {
  id: string;
  name: string;
}

interface Applicability {
  id: number; // This seems to be a numeric PK from its own table
  matrix_id?: string; // Added to potentially link back, if needed
  employee_id: string;
  employee_name?: string;
  valid_from: string;
  valid_to: string;
  status: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) {
    console.warn("formatDate received empty or null dateString");
    return ''; // Or 'N/A' or some other placeholder for empty dates
  }
  try {
    // Test if dateString already contains time information or 'Z'
    const hasTimeOrUTC = dateString.includes('T') || dateString.includes('Z');
    let dateToParse = dateString;

    if (!hasTimeOrUTC && /\d{4}-\d{2}-\d{2}/.test(dateString.substring(0,10))) {
      // If it looks like YYYY-MM-DD without time, append T00:00:00Z for UTC parsing
      dateToParse = dateString.substring(0,10) + 'T00:00:00Z';
      console.log(`formatDate: Appended T00:00:00Z to ${dateString.substring(0,10)}, parsing: ${dateToParse}`);
    } else {
      // If it already has T or Z, or is not in YYYY-MM-DD format, try parsing as is
      console.log(`formatDate: Parsing as is: ${dateToParse}`);
    }

    const date = new Date(dateToParse);
    
    if (isNaN(date.getTime())) {
      console.error("formatDate produced Invalid Date for input:", dateString, "Parsed as:", dateToParse);
      return 'Data Inválida (Parse)'; // More specific error
    }
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch (e) {
    console.error("Error formatting date (exception):", dateString, e);
    return 'Data Inválida (Catch)';
  }
};

export default function EvaluationMatricesPage() {
  const [matrices, setMatrices] = useState<EvaluationMatrix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState<EvaluationMatrix | null>(null);
  const [subordinates, setSubordinates] = useState<Subordinate[]>([]); // Added
  const [selectedApplicableEmployees, setSelectedApplicableEmployees] = useState<string[]>([]); // Added
  const [isManager, setIsManager] = useState<boolean>(false); // Added for UI logic
  const [showApplicationsModal, setShowApplicationsModal] = useState(false);
  const [applications, setApplications] = useState<Applicability[]>([]);
  const [selectedMatrixForApps, setSelectedMatrixForApps] = useState<EvaluationMatrix | null>(null);
  const [confirmInactivate, setConfirmInactivate] = useState<{app: Applicability | null, open: boolean}>({app: null, open: false});
  const [applyNewMatrixInfo, setApplyNewMatrixInfo] = useState<{employee_id: string, valid_from: string, valid_to: string} | null>(null);
  const [applyMatrixModal, setApplyMatrixModal] = useState<{open: boolean, employee_id?: string, valid_from?: string, valid_to?: string}>(false);

  const { 
    msalInstance, 
    accounts, 
    inProgress,
    selectedEmployeeId, // Manager's ID, used for context
    systemUserId,       // Authenticated User for Audit
  } = useSelectedEmployee();
  
  const activeAccount = accounts && accounts.length > 0 ? accounts[0] : undefined;
  const interactionStatus = inProgress;

  const router = useRouter();

  // Add immediate redirect if no selectedEmployeeId
  useEffect(() => {
    if (!selectedEmployeeId && !isLoading) {
      console.log('No selected employee ID, redirecting to landing page');
      router.replace('/landing');
    }
  }, [selectedEmployeeId, isLoading, router]);

  // Add authentication check effect
  useEffect(() => {
    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None) {
      console.log('Authentication not ready:', {
        hasMsalInstance: !!msalInstance,
        hasActiveAccount: !!activeAccount,
        interactionStatus
      });
      return;
    }

    if (!selectedEmployeeId) {
      console.log('No selected employee ID, redirecting to landing page');
      router.replace('/landing');
      return;
    }

    // Only proceed with data fetching if we have both authentication and selectedEmployeeId
    fetchMatrices();
  }, [msalInstance, activeAccount, interactionStatus, selectedEmployeeId, router]);

  async function fetchMatrices() {
    if (!selectedEmployeeId) {
      console.warn('fetchMatrices called without selectedEmployeeId');
      return;
    }

    console.log('[MatricesPage] fetchMatrices called with selectedEmployeeId:', selectedEmployeeId);
    setIsLoading(true);
    setError(null);

    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };

      const data = await fetchWithAuth<EvaluationMatrix[]>(
        '/api/evaluation-matrices',
        { method: 'GET' },
        apiClientOpts
      );
      setMatrices(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      console.error('[MatricesPage] Error in fetchMatrices:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch subordinates when manager context is available
  useEffect(() => {
    const fetchSubordinates = async () => {
      const currentActiveAccount = accounts && accounts.length > 0 ? accounts[0] : null;

      // Reset manager status and subordinates if dependencies change, before fetching new ones
      setIsManager(false);
      setSubordinates([]);

      if (msalInstance && currentActiveAccount && inProgress === InteractionStatus.None && selectedEmployeeId) {
        console.log('[MatricesPage] Attempting to fetch subordinates and manager status. Manager ID:', selectedEmployeeId);
        try {
          const apiClientOpts = {
            msalInstance,
            interactionStatus: inProgress,
            activeAccount: currentActiveAccount,
            selectedEmployeeId,
          };
          const roleInfo = await fetchWithAuth<any>( 
            '/api/evaluation/user-role-info', 
            { method: 'GET' },
            apiClientOpts
          );
          if (roleInfo) {
            setSubordinates(roleInfo.subordinates || []);
            setIsManager(roleInfo.isManager || false); // Store isManager
            console.log('[MatricesPage] Fetched user role info:', {isManager: roleInfo.isManager, numSubordinates: roleInfo.subordinates?.length });
          } else {
            setSubordinates([]);
            setIsManager(false);
            console.log('[MatricesPage] No roleInfo received.');
          }
        } catch (err: any) {
          console.error('Failed to fetch subordinates/manager status:', err);
          toast.error('Falha ao buscar lista de subordinados e status de gestor.');
          setSubordinates([]);
          setIsManager(false);
        }
      }
    };

    fetchSubordinates();
  }, [msalInstance, accounts, inProgress, selectedEmployeeId]);

  useEffect(() => {
    console.log('[MatricesPage] useEffect for fetching matrices triggered. Values:', {
        hasMsalInstance: !!msalInstance,
        accountsLength: accounts?.length,
        inProgressStatus: inProgress,
        employeeId: selectedEmployeeId,
    });

    // 1. Wait for MSAL instance and for inProgress to be defined and not in startup/redirect phase.
    if (!msalInstance || inProgress === undefined || inProgress === InteractionStatus.Startup || inProgress === InteractionStatus.HandleRedirect) {
        console.log('[MatricesPage] Waiting for MSAL initialization or redirect/startup to complete. isLoading remains true.');
        // setIsLoading(true); // Implicitly, isLoading is true initially or from previous state
        return; // Exit and wait for these dependencies to change and re-trigger useEffect
    }

    // At this point, MSAL instance is available, and inProgress is not startup/redirect/undefined.
    const currentActiveAccount = accounts && accounts.length > 0 ? accounts[0] : null;

    // 2. Check if interaction is None (i.e., idle and ready)
    if (inProgress === InteractionStatus.None) {
        if (currentActiveAccount && selectedEmployeeId) {
            console.log('[MatricesPage] Conditions fully met (MSAL Ready, InteractionStatus.None, Account, EmployeeID). Calling fetchMatrices().');
            fetchMatrices();
        } else {
            console.log('[MatricesPage] MSAL Ready and InteractionStatus is None, but ActiveAccount or SelectedEmployeeId is missing. Not fetching.');
            setIsLoading(false); // Can stop loading as we won't fetch under these conditions
            if (!currentActiveAccount && msalInstance) { 
                setError("Login necessário ou nenhuma conta ativa encontrada.");
            } else if (!selectedEmployeeId && currentActiveAccount) { 
                setError("Por favor, selecione um perfil de funcionário para carregar as matrizes.");
            }
        }
    } else {
        // Interaction is in progress (e.g., login, acquireToken) but not startup/redirect/undefined.
        // This means user interaction might be required or is ongoing.
        console.log(`[MatricesPage] MSAL interaction is currently '${inProgress}'. Waiting for it to resolve to 'None'. isLoading remains true.`);
        // setIsLoading(true); // Keep loading, as we are actively waiting for an MSAL process
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msalInstance, accounts, inProgress, selectedEmployeeId]); // Re-fetch if context changes

  useEffect(() => {
    // Fallback: se não houver selectedEmployeeId, redireciona para /evaluation
    if (!selectedEmployeeId && !isLoading) {
      router.replace('/evaluation');
    }
  }, [selectedEmployeeId, isLoading, router]);

  const handleOpenNewMatrixForm = () => {
    setEditingMatrix(null);
    setSelectedApplicableEmployees([]); // Clear selections for new form
    setShowFormModal(true);
    setError(null);
  };

  const handleEditMatrix = async (matrixToEdit: EvaluationMatrix) => {
    setIsLoading(true);
    setError(null);
    const matrixId = matrixToEdit.id || matrixToEdit.matrix_id; // Use id or matrix_id

    if (!matrixId || matrixId === "undefined") {
      toast.error("ID da Matriz inválido para edição.");
      console.error("[MatricesPage] handleEditMatrix: ID da matriz inválido:", matrixToEdit);
      setIsLoading(false);
      return;
    }

    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None || !selectedEmployeeId) {
      toast.error("Contexto de autenticação ou funcionário inválido para editar.");
      setIsLoading(false);
      return;
    }
    try {
        const matrixSubordinates = await fetchMatrixApplicability(matrixId);
        setSelectedApplicableEmployees(matrixSubordinates.map(String));
        setEditingMatrix(matrixToEdit);
        setShowFormModal(true);
    } catch (err: any) {
        console.error('[MatricesPage] Error fetching matrix for edit:', err);
        toast.error(err.message);
        setError(err.message); // Set page error if needed, or rely on toast
    } finally {
        setIsLoading(false);
    }
  };

  const fetchMatrixApplicability = async (matrixId: string): Promise<string[]> => {
    if (!matrixId || matrixId === "undefined") {
      console.warn('[MatricesPage] fetchMatrixApplicability: matrixId inválido ou não fornecido.');
      toast.error("Não é possível buscar aplicabilidade: ID da matriz inválido.");
      return [];
    }
    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None || !selectedEmployeeId) {
      console.warn('[MatricesPage] fetchMatrixApplicability: Prerequisites for fetchWithAuth not met.');
      toast.error("Não é possível buscar aplicabilidade da matriz: contexto de autenticação inválido.");
      return [];
    }
    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };
      // Assuming an endpoint like /api/evaluation/matrices/{matrixId}/applicability
      // This endpoint needs to be created if it doesn't exist.
      // For now, this is a placeholder structure.
      // Replace with actual API call if available, or adjust logic.
      // const data = await fetchWithAuth<string[]>(`/api/evaluation/matrices/${matrixId}/applicability`, { method: 'GET' }, apiClientOpts);
      // return data;
      
      // Placeholder: If the matrix object itself contains applicability from the main fetch, use that.
      // This part needs to align with how applicability is fetched/stored.
      // For now, returning empty as the endpoint might not exist.
      console.warn(`[MatricesPage] fetchMatrixApplicability for matrix ${matrixId} - actual API call for applicability not implemented or placeholder used.`);
      const matrix = matrices.find(m => (m.id || m.matrix_id) === matrixId);
      return matrix?.applicable_employee_ids || [];

    } catch (error: any) {
      console.error(`Error fetching applicability for matrix ${matrixId}:`, error);
      toast.error(`Falha ao buscar aplicabilidade para a matriz ${matrixId}.`);
      return [];
    }
  };

  const handleSaveMatrix = async (data: EvaluationMatrix) => {
    if (!selectedEmployeeId) {
      toast.error('Por favor, selecione um funcionário antes de salvar a matriz.');
      // router.replace('/landing'); // Consider if redirect is too aggressive here
      return;
    }
    // Use data.id or data.matrix_id consistently
    const matrixId = data.id || data.matrix_id;

    setIsLoading(true);
    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None) {
      console.error('[MatricesPage] handleSaveMatrix: Prerequisites for fetchWithAuth not met.');
      toast.error("Não é possível salvar a matriz: contexto de autenticação inválido.");
      setIsLoading(false);
      return;
    }

    const url = matrixId ? `/api/evaluation-matrices/${matrixId}` : '/api/evaluation-matrices';
    const method = matrixId ? 'PUT' : 'POST';

    const processedData = {
      ...data,
      criteria: data.criteria.map(c => ({ ...c, weight: Number(c.weight) || 0 })),
    };
    
    console.log('[MatricesPage] Saving matrix with data:', processedData);

    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };
      
      console.log('[MatricesPage] handleSaveMatrix - Preparing to call fetchWithAuth. apiClientOpts:', {
        msalInstanceExists: !!apiClientOpts.msalInstance,
        interactionStatus: apiClientOpts.interactionStatus,
        activeAccountExists: !!apiClientOpts.activeAccount,
        selectedEmployeeId: apiClientOpts.selectedEmployeeId,
        accountDetails: apiClientOpts.activeAccount // Log the whole account object if it exists
      });

      await fetchWithAuth(
        url, 
        { 
          method: method, 
          body: JSON.stringify(processedData) 
        },
        apiClientOpts
      );
      setShowFormModal(false);
      setEditingMatrix(null);
      await fetchMatrices();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      console.error('[MatricesPage] Error saving matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMatrix = async (matrixIdToDelete?: string) => {
    if (!matrixIdToDelete || matrixIdToDelete === "undefined") {
      console.error("[handleDeleteMatrix] ID da matriz é inválido ou não fornecido:", matrixIdToDelete);
      toast.error("Erro ao inativar matriz: ID inválido.");
      setIsLoading(false); // Ensure loading state is reset
      return;
    }
    if (!confirm("Tem certeza que deseja inativar esta matriz?")) {
      setIsLoading(false); // Reset loading if user cancels
      return;
    }

    setIsLoading(true); // Set loading true only after confirmation and ID check
    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None || !selectedEmployeeId) {
      console.error('[MatricesPage] handleDeleteMatrix: Prerequisites for fetchWithAuth not met.');
      toast.error("Não é possível inativar a matriz: contexto de autenticação inválido.");
      setIsLoading(false);
      return;
    }

    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };
      await fetchWithAuth(
        `/api/evaluation-matrices/${matrixIdToDelete}`, 
        { method: 'DELETE' },
        apiClientOpts
      );
      toast.success("Matriz inativada com sucesso!");
      fetchMatrices(); // Refresh list
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
      console.error('[MatricesPage] Error deleting (inactivating) matrix:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMatrix = async (matrixToCopy: EvaluationMatrix) => {
    if (!msalInstance || !activeAccount || interactionStatus !== InteractionStatus.None || !selectedEmployeeId) {
      console.error('[MatricesPage] handleCopyMatrix: Prerequisites for fetchWithAuth not met.');
      toast.error("Não é possível copiar a matriz: contexto de autenticação inválido.");
      return;
    }

    // Ensure matrixToCopy has a valid ID before attempting to use its properties
    const idToCopyFrom = matrixToCopy.id || matrixToCopy.matrix_id;
    if (!idToCopyFrom) {
        console.error("[MatricesPage] handleCopyMatrix: Matriz original não tem ID para copiar.", matrixToCopy);
        toast.error("Erro ao copiar: Matriz original sem ID.");
        return;
    }

    const newMatrixData: EvaluationMatrix = {
      ...matrixToCopy,
      id: undefined, // Remove ID to indicate it's a new matrix
      matrix_id: undefined, // Also clear matrix_id if it exists
      title: `${matrixToCopy.title} (Cópia)`,
      status: 'draft', // New copies start as draft
      // valid_from and valid_to might need adjustment or clearing
      // applicable_employee_ids might also need clearing or specific handling
      applicable_employee_ids: [], // Start with no employees for a copy, or define specific logic
      created_by: undefined, // Will be set by backend
    };
    
    // For criteria, ensure they also don't have IDs if they are to be recreated
    newMatrixData.criteria = Array.isArray(newMatrixData.criteria)
      ? newMatrixData.criteria.map(c => ({ ...c, id: undefined }))
      : [];

    console.log('[MatricesPage] Attempting to save copied matrix:', newMatrixData);
    setShowFormModal(true);
    setEditingMatrix(newMatrixData); // Open form with copied data for potential edits before saving
    setSelectedApplicableEmployees(newMatrixData.applicable_employee_ids || []);


    // Alternative: Directly save the copy (less user-friendly if edits are typically needed)
    /*
    setIsLoading(true);
    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };
      await fetchWithAuth(
        '/api/evaluation-matrices', 
        { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(newMatrixData) 
        },
        apiClientOpts
      );
      toast.success(`Matriz "${matrixToCopy.title}" copiada com sucesso!`);
      fetchMatrices(); // Refresh list
    } catch (err: any) {
      setError(err.message);
      toast.error(`Erro ao copiar matriz: ${err.message}`);
      console.error('[MatricesPage] Error copying matrix:', err);
    } finally {
      setIsLoading(false);
    }
    */
  };

  const handleShowApplications = async (matrix: EvaluationMatrix) => {
    const matrixIdToShow = matrix.id || matrix.matrix_id;
    if (!matrixIdToShow || matrixIdToShow === "undefined") {
      console.error("[MatricesPage] handleShowApplications: ID da matriz inválido:", matrix);
      toast.error("Erro ao ver aplicações: ID da matriz inválido.");
      return;
    }
    setSelectedMatrixForApps(matrix);
    setShowApplicationsModal(true);
    // Fetch applications for this matrix
    try {
      const apiClientOpts = {
        msalInstance,
        interactionStatus,
        activeAccount,
        selectedEmployeeId,
      };
      const data = await fetchWithAuth<Applicability[]>(`/api/evaluation-matrices/${matrixIdToShow}/applicability`, { method: 'GET' }, apiClientOpts);
      setApplications(data);
    } catch (err: any) {
      toast.error('Erro ao buscar aplicações da matriz.');
      setApplications([]);
    }
  };

  const getApplicabilityStatus = (app: Applicability) => {
    const today = new Date();
    const validTo = new Date(app.valid_to);
    if (app.status === 'inactive') return 'Inativa';
    if (app.status === 'active' && validTo < today) return 'Expirada';
    if (app.status === 'active') return 'Ativa';
    return app.status;
  };

  const handleNewVersionForCollaborator = (app: Applicability) => {
    setConfirmInactivate({ app, open: true });
  };

  const confirmInactivateApplicability = async () => {
    if (!confirmInactivate.app) return;
    try {
      const response = await fetch(`/api/evaluation-matrix/applicability/${confirmInactivate.app.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Erro ao inativar aplicação');
      const updated = await response.json();
      setApplications(applications => applications.map(a => a.id === updated.id ? { ...a, ...updated } : a));
      setConfirmInactivate({ app: null, open: false });
      toast.success('Aplicação inativada com sucesso. Pode agora atribuir nova matriz.');
      // Sugestão: já preparar info para aplicar nova matriz
      const nextDay = new Date(updated.inactivated_at);
      nextDay.setDate(nextDay.getDate() + 1);
      setApplyNewMatrixInfo({
        employee_id: updated.employee_id,
        valid_from: nextDay.toISOString().slice(0, 10),
        valid_to: updated.valid_to // ou sugerir um novo período
      });
    } catch (err) {
      toast.error('Erro ao inativar aplicação.');
    }
  };

  const handleApplyNewMatrix = () => {
    if (!applyNewMatrixInfo) return;
    setApplyMatrixModal({
      open: true,
      employee_id: applyNewMatrixInfo.employee_id,
      valid_from: applyNewMatrixInfo.valid_from,
      valid_to: applyNewMatrixInfo.valid_to,
    });
  };

  const handleSubmitApplyMatrix = async (values: {employeeIds: string[], validFrom: string, validTo: string}) => {
    try {
      const response = await fetch('/api/evaluation/matrix/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matrixId: selectedMatrixForApps?.id,
          employeeIds: values.employeeIds,
          validFrom: values.validFrom,
          validTo: values.validTo
        })
      });
      if (!response.ok) throw new Error('Erro ao aplicar nova matriz');
      toast.success('Nova matriz aplicada com sucesso!');
      setApplyMatrixModal(false);
      setApplyNewMatrixInfo(null);
      // Refresh applications list
      if (selectedMatrixForApps) await handleShowApplications(selectedMatrixForApps);
    } catch (err) {
      toast.error('Erro ao aplicar nova matriz.');
    }
  };

  if (!selectedEmployeeId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Redirecionando para seleção de funcionário...</p>
      </div>
    );
  }

  if (isLoading && !matrices.length && !showFormModal) {
    return <p className="text-center p-8">Carregando matrizes...</p>;
  }

  if (error && !isLoading && !showFormModal) {
    return <p className="text-center text-red-500 p-8">{error}</p>;
  }

  return (
    <>
      <Head>
        <title>Matrizes de Avaliação</title>
      </Head>
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Matrizes de Avaliação</h1>
          {selectedEmployeeId && isManager && subordinates && subordinates.length > 0 && (
            <button 
              onClick={handleOpenNewMatrixForm}
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
        
        {error && showFormModal && <p className="mb-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}

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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${matrix.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      `}>
                        {matrix.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1">
                      <button 
                        onClick={() => handleEditMatrix(matrix)} 
                        className="text-indigo-600 hover:text-indigo-900 p-1" 
                        title="Editar" 
                        disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)}
                      >
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleShowApplications(matrix)} 
                        className="text-blue-600 hover:text-blue-900 p-1" 
                        title="Ver Aplicações" 
                        disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)}
                      >
                        <ClipboardDocumentListIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleCopyMatrix(matrix)} 
                        className="text-gray-500 hover:text-gray-700 p-1" 
                        title="Copiar e Prorrogar" 
                        disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id)} // Also disable if original has no ID
                      >
                        <CalendarDaysIcon className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => {
                          const idToDel = matrix.id || matrix.matrix_id;
                          if (idToDel && idToDel !== "undefined") {
                            handleDeleteMatrix(idToDel);
                          } else {
                            console.error("ID inválido no botão Apagar:", matrix);
                            toast.error("Erro: ID da matriz inválido para apagar.");
                          }
                        }}
                        className="text-red-600 hover:text-red-900 p-1" 
                        title="Inativar" 
                        disabled={!selectedEmployeeId || !(matrix.id || matrix.matrix_id) || matrix.id === "undefined" || matrix.matrix_id === "undefined"}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {isLoading && (
                  <tr><td colSpan={6} className="text-center p-4 text-sm text-gray-500">Carregando...</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {showFormModal && (
          <MatrixForm 
            matrix={editingMatrix}
            onClose={() => {
              setShowFormModal(false);
              setEditingMatrix(null);
              setSelectedApplicableEmployees([]); // Clear selection on close
              setError(null); // Clear form-specific error on close
            }}
            onSave={handleSaveMatrix}
            subordinatesList={subordinates} // Pass subordinates
            selectedApplicableEmployeeIds={selectedApplicableEmployees} // Pass selected IDs
            onSelectedApplicableEmployeesChange={setSelectedApplicableEmployees} // Pass setter
          />
        )}

        <Transition.Root show={showApplicationsModal} as={React.Fragment}>
          <Dialog as="div" className="relative z-10" onClose={() => setShowApplicationsModal(false)}>
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
                        Aplicações da Matriz: {selectedMatrixForApps?.title}
                      </Dialog.Title>
                      <button onClick={() => setShowApplicationsModal(false)} className="text-gray-400 hover:text-gray-600">
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
                            <tr><td colSpan={4} className="text-center py-4 text-gray-500">Nenhuma aplicação encontrada.</td></tr>
                          ) : (
                            applications.map(app => (
                              <tr key={app.id}>
                                <td className="px-4 py-2 whitespace-nowrap">{app.employee_name || app.employee_id}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{formatDate(app.valid_from)} - {formatDate(app.valid_to)}</td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <span className={
                                    getApplicabilityStatus(app) === 'Ativa' ? 'text-green-700 font-semibold' :
                                    getApplicabilityStatus(app) === 'Expirada' ? 'text-yellow-700 font-semibold' :
                                    'text-red-700 font-semibold'
                                  }>
                                    {getApplicabilityStatus(app)}
                                  </span>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <button onClick={() => handleNewVersionForCollaborator(app)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Nova versão para este colaborador">
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

        <Transition.Root show={confirmInactivate.open} as={React.Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setConfirmInactivate({ app: null, open: false })}>
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">Inativar aplicação?</Dialog.Title>
                  <p className="mb-4">Esta ação irá inativar esta aplicação de matriz. Deseja continuar?</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setConfirmInactivate({ app: null, open: false })} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Cancelar</button>
                    <button onClick={confirmInactivateApplicability} className="px-4 py-2 rounded bg-red-600 text-white">Inativar</button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {applyMatrixModal.open && (
          <Transition.Root show={applyMatrixModal.open} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => setApplyMatrixModal(false)}>
              <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
              </Transition.Child>
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enterTo="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
                  <Dialog.Panel className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">Aplicar Nova Matriz</Dialog.Title>
                    <form onSubmit={async e => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const employeeIds = [form.employee_id.value];
                      const validFrom = form.valid_from.value;
                      const validTo = form.valid_to.value;
                      await handleSubmitApplyMatrix({ employeeIds, validFrom, validTo });
                    }}>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                        <input name="employee_id" className="w-full border rounded px-2 py-1" value={applyMatrixModal.employee_id || ''} readOnly />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Válido de</label>
                        <input name="valid_from" type="date" className="w-full border rounded px-2 py-1" defaultValue={applyMatrixModal.valid_from || ''} required />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                        <input name="valid_to" type="date" className="w-full border rounded px-2 py-1" defaultValue={applyMatrixModal.valid_to || ''} required />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setApplyMatrixModal(false)} className="px-4 py-2 rounded bg-gray-200 text-gray-700">Cancelar</button>
                        <button type="submit" className="px-4 py-2 rounded bg-green-600 text-white">Aplicar</button>
                      </div>
                    </form>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </Dialog>
          </Transition.Root>
        )}
      </div>
    </>
  );
} 