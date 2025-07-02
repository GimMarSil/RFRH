import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus, PublicClientApplication } from '@azure/msal-browser';
import { fetchWithAuth, ApiClientOptions } from '@/lib/apiClient'; // Import fetchWithAuth
import { useSelectedEmployee } from '@/contexts/SelectedEmployeeContext'; // Import the context hook

// Define your API scopes here - this should match the audience/scope configured for your backend API
// e.g., ["api://your-backend-client-id/.default"] or specific permission scopes
// const apiScopes = [process.env.NEXT_PUBLIC_API_SCOPES || "api://YOUR_BACKEND_APP_ID_URI/.default"]; 
// apiScopes is now defined in apiClient.ts, no need to redefine here

interface Subordinate {
  id: string; // EmployeeId from your DB
  name: string;
  email: string;
}

interface UserRoleInfo {
  userId: string; // This is the MSAL/System User ID
  employeeId: string; // This is the Employee ID of the person acting (the manager)
  name: string;
  email: string;
  isManager: boolean;
  subordinates: Subordinate[];
  managers: any[]; // Define more strictly if needed
}

const EvaluateSubordinatePage = () => {
  const router = useRouter();
  const { instance, accounts, inProgress } = useMsal();
  const {
    selectedEmployeeId: contextSelectedEmployeeId, // To distinguish from local state if needed
    setSelectedEmployeeId,
    setSystemUserId,
    setEmployeeProfileName,
    setIsManagerRole,
  } = useSelectedEmployee();

  const [userInfo, setUserInfo] = useState<UserRoleInfo | null>(null); // Still useful for local page display logic
  const [selectedSubordinate, setSelectedSubordinate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (inProgress !== InteractionStatus.None || !accounts[0]) {
        if (!accounts[0] && inProgress === InteractionStatus.None) {
            setError("Utilizador não autenticado. Por favor, faça login.");
            setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      // For the initial user-role-info call, selectedEmployeeId in ApiClientOptions can be null.
      // The backend uses the MSAL token to identify the system user and then their associated employee roles.
      const apiClientOptions: ApiClientOptions = {
        msalInstance: instance as PublicClientApplication,
        selectedEmployeeId: null, // Explicitly null for this initial call
        interactionStatus: inProgress, // Pass the inProgress status from useMsal()
        activeAccount: accounts[0] || null, // Pass the first account as active, or null if none
      };

      try {
        // No need to acquire token manually, fetchWithAuth handles it.
        console.log("Fetching user role info...");
        const data = await fetchWithAuth<UserRoleInfo>(
          '/api/evaluation/user-role-info',
          { method: 'GET' },
          apiClientOptions
        );
        
        setUserInfo(data);
        // Populate the context with fetched user details
        setSystemUserId(data.userId); // This is the authenticated system user (MSAL OID)
        setSelectedEmployeeId(data.employeeId); // This is the manager's Employee ID
        setEmployeeProfileName(data.name); 
        setIsManagerRole(data.isManager);

        console.log("Fetched User Info Subordinates:", data.subordinates);
        console.log("Context updated: selectedEmployeeId:", data.employeeId, "systemUserId:", data.userId);

      } catch (err: any) {
        if (err instanceof InteractionRequiredAuthError) {
          console.warn('Silent token acquisition failed via fetchWithAuth. Interaction required.');
          console.error("InteractionRequiredAuthError details:", err); 
          setError(`Falha na aquisição de token: ${err.message || err.errorMessage}. Interação pode ser necessária.`);
          // Potentially trigger interactive token acquisition here if not handled globally by msal-react or _app.tsx
          // instance.acquireTokenRedirect({ scopes: apiScopes, account: accounts[0] }).catch(console.error);
        } else {
          setError(err.message || 'Falha ao carregar informação do utilizador.');
          console.error("Other error during user-role-info fetch:", err); 
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, accounts, inProgress, /* No context setters here to avoid re-triggering from its own update */]);
  // Note: Removed context setters from dependency array to prevent potential loops if context update triggers useEffect.
  // The setters themselves don't change, only the state they manage. This is a common pattern.
  // If `accounts` or `inProgress` change, it means an auth state change, so refetch is good.

  const handleSubordinateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubordinate(e.target.value);
  };

  const handleProceedToEvaluation = () => {
    if (selectedSubordinate) {
      // The contextSelectedEmployeeId (manager's own employeeId) is implicitly used by API calls on the next page via fetchWithAuth
      router.push(`/evaluation/evaluate/${selectedSubordinate}`);
    } else {
      alert('Por favor, selecione um colaborador.');
    }
  };

  if (isLoading || inProgress !== InteractionStatus.None) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Avaliar Colaborador</h1>
        <p>A carregar informação do utilizador...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Avaliar Colaborador</h1>
        <p className="text-red-500">Erro: {error}</p>
        <Link href="/evaluation" className="text-blue-500 hover:underline">
          Voltar ao Dashboard de Avaliação
        </Link>
      </div>
    );
  }

  if (!userInfo) {
    // This case might be hit if fetchUserInfo returns early due to !accounts[0]
    // or if an error occurred but wasn't caught by the error state for some reason.
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Avaliar Colaborador</h1>
        <p>Não foi possível obter a informação do utilizador. Verifique se está autenticado.</p>
        <Link href="/evaluation" className="text-blue-500 hover:underline">
          Voltar ao Dashboard de Avaliação
        </Link>
      </div>
    );
  }

  if (!userInfo.isManager || userInfo.subordinates.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Avaliar Colaborador</h1>
        </header>
        <p className="text-gray-600">
          Você não tem colaboradores diretos para avaliar ou não tem permissões de gestor.
        </p>
        <div className="mt-6">
          <Link href="/evaluation" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <Link href="/evaluation" className="text-blue-600 hover:text-blue-800 text-sm">
            &larr; Voltar ao Dashboard de Avaliação
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Selecionar Colaborador para Avaliação</h1>
        </header>

        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="mb-6">
            <label htmlFor="subordinate" className="block text-sm font-medium text-gray-700 mb-1">
              Selecione o Colaborador:
            </label>
            <select
              id="subordinate"
              name="subordinate"
              value={selectedSubordinate}
              onChange={handleSubordinateChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="" disabled>-- Escolha um colaborador --</option>
              {userInfo.subordinates.map((subordinate) => (
                <option key={subordinate.id} value={subordinate.id}>
                  {subordinate.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleProceedToEvaluation}
              disabled={!selectedSubordinate}
              className="px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            >
              Prosseguir para Avaliação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EvaluateSubordinatePage; 