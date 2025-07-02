import { useState, useEffect, FormEvent } from 'react';
import { useSelectedEmployee } from '@/contexts/SelectedEmployeeContext';

interface TrainingSession {
  id: number;
  employee_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string | null;
  trainer: string | null;
}

export default function TrainingPage() {
  const { selectedEmployeeId, systemUserId } = useSelectedEmployee();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    trainer: '',
  });

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchSessions();
    }
  }, [selectedEmployeeId]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/training?employeeId=${selectedEmployeeId}`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch training sessions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !systemUserId) return;
    const payload = {
      employee_id: selectedEmployeeId,
      title: form.title,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      location: form.location || null,
      trainer: form.trainer || null,
      created_by_user_id: systemUserId,
    };
    try {
      const res = await fetch('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setForm({ title: '', description: '', start_date: '', end_date: '', location: '', trainer: '' });
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to create training session', err);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Formação</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="title" value={form.title} onChange={handleChange} placeholder="Título" className="border p-2 w-full" required />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Descrição" className="border p-2 w-full" />
        <div className="flex space-x-2">
          <input type="date" name="start_date" value={form.start_date} onChange={handleChange} className="border p-2 flex-1" required />
          <input type="date" name="end_date" value={form.end_date} onChange={handleChange} className="border p-2 flex-1" />
        </div>
        <input name="location" value={form.location} onChange={handleChange} placeholder="Local" className="border p-2 w-full" />
        <input name="trainer" value={form.trainer} onChange={handleChange} placeholder="Formador" className="border p-2 w-full" />
        <button type="submit" className="bg-black text-white px-4 py-2">Guardar</button>
      </form>

      <h2 className="text-xl font-semibold mt-8">Ações de Formação</h2>
      {loading ? (
        <p>A carregar...</p>
      ) : (
        <ul className="space-y-2 mt-2">
          {sessions.map(s => (
            <li key={s.id} className="border p-2 rounded">
              <p className="font-medium">{s.title} ({s.start_date})</p>
              {s.trainer && <p className="text-sm text-gray-500">{s.trainer}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
