import { useState } from "react";

export default function HistoricoAlteracoes({ recruitmentId }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const fetchHistorico = async () => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/recruitment-log?recruitmentId=${recruitmentId}`);
      if (!res.ok) throw new Error('Erro ao buscar histórico');
      const data = await res.json();
      setHistorico(data);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={fetchHistorico} className="bg-blue-500 text-white px-4 py-2 rounded mb-4">
        Ver Histórico de Alterações
      </button>
      {loading && <p>A carregar histórico...</p>}
      {erro && <p className="text-red-600">{erro}</p>}
      {historico.length > 0 && (
        <table className="min-w-full divide-y divide-gray-200 mt-4">
          <thead>
            <tr>
              <th className="px-4 py-2">Ação</th>
              <th className="px-4 py-2">Alterado por</th>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Antes</th>
              <th className="px-4 py-2">Depois</th>
            </tr>
          </thead>
          <tbody>
            {historico.map(log => (
              <tr key={log.id}>
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2">{log.changed_by}</td>
                <td className="px-4 py-2">{new Date(log.changed_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-w-xs">{log.old_data ? JSON.stringify(log.old_data, null, 2) : "-"}</pre>
                </td>
                <td className="px-4 py-2">
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-w-xs">{log.new_data ? JSON.stringify(log.new_data, null, 2) : "-"}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
} 