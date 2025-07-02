import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Profile() {
  const { instance, accounts } = useMsal();
  const router = useRouter();
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (typeof isAuthenticated === "undefined" || !isAuthenticated || !accounts[0]) return;
    setLoading(true);
    setError(null);
    setEmployeeData(null);
    const fetchEmployeeData = async () => {
      try {
        const response = await fetch(`/api/employee?userId=${accounts[0].username}`);
        if (!response.ok) throw new Error('Failed to fetch employee data');
        const data = await response.json();
        setEmployeeData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployeeData();
  }, [accounts, isAuthenticated]);

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  if (typeof isAuthenticated === "undefined") {
    return <div>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Acesso Negado</h1>
        <p>Por favor, faça login para acessar esta página.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Voltar para Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Perfil do Usuário</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Sair
            </button>
          </div>

          {accounts[0] && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Informações do Azure AD</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Nome:</p>
                  <p>{accounts[0].name}</p>
                </div>
                <div>
                  <p className="font-medium">Email:</p>
                  <p>{accounts[0].username}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-semibold mb-4">Dados do Funcionário</h2>
            {loading ? (
              <p>Carregando dados do funcionário...</p>
            ) : error ? (
              <p className="text-red-600">Erro: {error}</p>
            ) : employeeData ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2">Número</th>
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">Departamento</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Empresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeData.map((employee, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-2">{employee.Number}</td>
                        <td className="px-4 py-2">{employee.Name}</td>
                        <td className="px-4 py-2">{employee.Department}</td>
                        <td className="px-4 py-2">{employee.Active ? 'Ativo' : 'Inativo'}</td>
                        <td className="px-4 py-2">{employee.CompanyName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Nenhum dado de funcionário encontrado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 