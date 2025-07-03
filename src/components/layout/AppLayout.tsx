import React, { useEffect, useState } from 'react';
import { useSelectedEmployee } from '@/contexts/SelectedEmployeeContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Header from './Header';
import { logger } from '@/lib/logger';

interface Employee {
  employee_number: number;
  Name: string;
}

const AppLayout: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const {
    accounts,
    selectedEmployeeId,
    setSelectedEmployeeId,
    setEmployeeProfileName,
  } = useSelectedEmployee();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!accounts || accounts.length === 0) return;
      setLoading(true);
      try {
        const userId = accounts[0].username;
        const res = await fetch(`/api/employee?userId=${userId}`);
        if (res.ok) {
          const data: Employee[] = await res.json();
          setEmployees(data);
          if (!selectedEmployeeId) {
            const accountId = accounts[0].localAccountId || accounts[0].username;
            const historyKey = `employeeHistory_${accountId}`;
            const historyRaw = localStorage.getItem(historyKey);
            let chosen: Employee | undefined;
            if (historyRaw) {
              try {
                const history: string[] = JSON.parse(historyRaw);
                for (const id of history) {
                  const emp = data.find(e => String(e.employee_number) === id);
                  if (emp) { chosen = emp; break; }
                }
              } catch {}
            }
            if (!chosen && data.length > 0) {
              chosen = data[0];
            }
            if (chosen) {
              setSelectedEmployeeId(String(chosen.employee_number));
              setEmployeeProfileName(chosen.Name);
            } else if (data.length > 1) {
              setShowSelectModal(true);
            }
          }
        } else {
          logger.error('Failed to fetch employees');
        }
      } catch (err) {
        logger.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadEmployees();
  }, [accounts, selectedEmployeeId, setSelectedEmployeeId, setEmployeeProfileName]);

  const handleSelectByIndex = (idx: number) => {
    const emp = employees[idx];
    if (emp) {
      setSelectedEmployeeId(String(emp.employee_number));
      setEmployeeProfileName(emp.Name);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10);
    handleSelectByIndex(idx);
    setShowSelectModal(false);
  };

  return (
    <>
      <Header employees={employees} onChange={handleSelectByIndex} loading={loading} />
      <div className="p-4">
        {children}
      </div>
      <Dialog open={showSelectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar colaborador</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p>A carregar...</p>
          ) : (
            <select className="border p-2" onChange={handleChange} defaultValue="">
              <option value="" disabled>
                -- Escolha o colaborador --
              </option>
              {employees.map((emp, idx) => (
                <option key={emp.employee_number} value={idx}>
                  {emp.Name}
                </option>
              ))}
            </select>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AppLayout;
