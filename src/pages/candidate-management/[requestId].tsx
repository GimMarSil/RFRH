"use client"

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useMsal } from "@azure/msal-react";
import gsap from "gsap";
import { ArrowLeft, Briefcase, Users, Building2, FileText, CalendarDays, Info, ChevronDown, ChevronRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Interface for the recruitment request (similar to dashboard)
interface Pedido {
  id: number;
  company: string;
  department: string;
  function: string;
  estado: string;
  vacancies?: number;
  request_date?: string;
  // Add other relevant fields from your Pedido interface
}

// Interface for a single Candidate
interface Candidate {
  id?: number;
  recruitment_id: number;
  full_name: string;
  email: string;
  phone?: string;
  birth_date?: string;
  nationality?: string;
  location?: string;
  current_position?: string;
  current_employer?: string;
  education?: string;
  languages?: string;
  skills?: string;
  cv_url?: string;
  motivation?: string;
  source?: string;
  application_date?: string;
  stage: string;
  evaluation_notes?: string;
  shortlisted?: boolean;
  status?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Função utilitária para obter as iniciais (primeira e última palavra)
function getInitials(name: string | undefined) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Candidate Stages
const candidateStages = [
  { id: "triagem", title: "Receção e Triagem de Candidaturas", description: "Candidaturas recebidas (email, portal, bolsas, referências)." },
  { id: "avaliacao", title: "Avaliação Curricular e Shortlist", description: "Análise de CVs e seleção inicial." },
  { id: "entrevistas_testes", title: "Entrevistas e/ou Testes Técnicos", description: "Primeiras entrevistas e avaliações técnicas." },
  { id: "entrevistas_finais", title: "Entrevistas Finais com Gestor", description: "Entrevistas com o gestor da vaga." },
  { id: "escolha", title: "Escolha do Candidato", description: "Seleção final e comunicação." },
];

const initialCandidateFormData: Omit<Candidate, 'id' | 'recruitment_id' | 'application_date' | 'created_at' | 'updated_at' | 'created_by'> = {
  full_name: "",
  email: "",
  phone: "",
  birth_date: "",
  nationality: "",
  location: "",
  current_position: "",
  current_employer: "",
  education: "",
  languages: "",
  skills: "",
  cv_url: "",
  motivation: "",
  source: "",
  stage: "triage",
  evaluation_notes: "",
  shortlisted: false,
  status: "active",
};

export default function CandidateManagementPage() {
  const router = useRouter();
  const { requestId } = router.query;
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef(null);
  const { accounts } = useMsal();
  const userName = accounts?.[0]?.name || 'Utilizador';

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Theme state and handling (similar to dashboard)
  const [theme, setTheme] = useState('light');
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const themeOptions = [
    { value: 'light', label: 'Claro', icon: '🌞' },
    { value: 'dark', label: 'Escuro', icon: '🌙' },
    { value: 'color-blind', label: 'Daltónico', icon: '👁️' },
  ];
  const currentTheme = themeOptions.find(opt => opt.value === theme) || themeOptions[0];

  function handleThemeDropdown(themeValue: string) {
    setTheme(themeValue);
    document.documentElement.classList.remove('light', 'dark', 'color-blind');
    document.documentElement.classList.add(themeValue);
    localStorage.setItem('theme', themeValue);
    setShowThemeDropdown(false);
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.remove('light', 'dark', 'color-blind');
    document.documentElement.classList.add(savedTheme);
  }, []);

  // Fetch recruitment request details
  useEffect(() => {
    if (requestId && accounts && accounts.length > 0) {
      const fetchPedidoDetails = async () => {
        setLoading(true);
        setError(null);
        try {
          const user = accounts[0];
          const headers = {
            'Content-Type': 'application/json',
            'userid': user.localAccountId || user.homeAccountId || 'unknown',
            'usergroups': JSON.stringify(user.idTokenClaims?.groups || []),
          };

          const res = await fetch(`/api/recruitment?id=${requestId}`, { headers });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: `Erro ${res.status}: ${res.statusText}` }));
            throw new Error(errorData.message || 'Falha ao carregar detalhes do pedido');
          }
          const data = await res.json();
          setPedido(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      fetchPedidoDetails();
    }
  }, [requestId, accounts]);

  // GSAP Animation
  useEffect(() => {
    if (containerRef.current && !loading) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
      );
    }
  }, [loading]); // Trigger animation after loading finishes

  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [activeModalStage, setActiveModalStage] = useState<string>("triage");
  const [newCandidateData, setNewCandidateData] = useState<Omit<Candidate, 'id' | 'recruitment_id' | 'application_date' | 'created_at' | 'updated_at' | 'created_by'>>(initialCandidateFormData);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [candidatesByStage, setCandidatesByStage] = useState<{ [key: string]: Candidate[] }>({});
  const [loadingCandidates, setLoadingCandidates] = useState<{ [key: string]: boolean }>({});

  // State for View/Edit Candidate Modal
  const [showViewEditModal, setShowViewEditModal] = useState(false);
  const [selectedCandidateForViewEdit, setSelectedCandidateForViewEdit] = useState<Candidate | null>(null);
  const [candidateEditData, setCandidateEditData] = useState<Partial<Candidate>>(initialCandidateFormData); // Using Partial as ID will be there

  // Function to fetch candidates for a specific stage
  const fetchCandidatesForStage = async (stageId: string) => {
    if (!pedido?.id) return;
    setLoadingCandidates(prev => ({ ...prev, [stageId]: true }));
    try {
      const user = accounts?.[0];
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user?.localAccountId || user?.homeAccountId || 'unknown',
        'x-user-groups': JSON.stringify(user?.idTokenClaims?.groups || []),
      };
      const res = await fetch(`/api/candidates?recruitment_id=${pedido.id}&stage=${stageId}`, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `Erro ao buscar candidatos para ${stageId}` }));
        throw new Error(errorData.message);
      }
      const data = await res.json();
      setCandidatesByStage(prev => ({ ...prev, [stageId]: data }));
    } catch (err: any) {
      console.error(`Erro ao buscar candidatos para ${stageId}:`, err);
      setCandidatesByStage(prev => ({ ...prev, [stageId]: [] })); // Set to empty array on error
    } finally {
      setLoadingCandidates(prev => ({ ...prev, [stageId]: false }));
    }
  };

  // Initial fetch for all stages once pedido details are loaded
  useEffect(() => {
    if (pedido?.id && accounts && accounts.length > 0) {
      candidateStages.forEach(stage => {
        fetchCandidatesForStage(stage.id);
      });
    }
  }, [pedido?.id, accounts]); // Dependency on pedido.id and accounts

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    const sourceStageId = source.droppableId;
    const destStageId = destination.droppableId;
    const candidateId = parseInt(draggableId.split('candidate-')[1]); // Assuming draggableId is like "candidate-123"

    // If dropped in the same place
    if (sourceStageId === destStageId && source.index === destination.index) {
      return;
    }
    
    console.log(`Candidate ${candidateId} dragged from stage ${sourceStageId} (index ${source.index}) to stage ${destStageId} (index ${destination.index})`);

    // Optimistically update UI
    setCandidatesByStage(prev => {
      const sourceCandidates = Array.from(prev[sourceStageId] || []);
      const destCandidates = sourceStageId === destStageId ? sourceCandidates : Array.from(prev[destStageId] || []);
      const [movedCandidate] = sourceCandidates.splice(source.index, 1);

      if (!movedCandidate) return prev; // Should not happen

      // Update candidate's stage property before inserting
      const updatedMovedCandidate = { ...movedCandidate, stage: destStageId };

      if (sourceStageId === destStageId) {
        sourceCandidates.splice(destination.index, 0, updatedMovedCandidate);
        return {
          ...prev,
          [sourceStageId]: sourceCandidates,
        };
      } else {
        destCandidates.splice(destination.index, 0, updatedMovedCandidate);
        return {
          ...prev,
          [sourceStageId]: sourceCandidates,
          [destStageId]: destCandidates,
        };
      }
    });

    // Persist change to backend
    updateCandidateStageAPI(candidateId, destStageId);
  };

  const updateCandidateStageAPI = async (candidateId: number, newStage: string) => {
    try {
      const user = accounts?.[0];
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user?.localAccountId || user?.homeAccountId || 'unknown',
        'x-user-name': user?.name || 'Unknown User',
        'x-user-groups': JSON.stringify(user?.idTokenClaims?.groups || []),
      };

      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) {
        const errorResult = await res.json().catch(() => ({ message: "Failed to update candidate stage on server." }));
        throw new Error(errorResult.message);
      }
      console.log(`Candidate ${candidateId} stage updated to ${newStage} on server.`);
      // Optionally, show a success toast or notification
    } catch (error: any) {
      console.error("Error updating candidate stage on server:", error);
      // Revert optimistic update if API call fails?
      // This can be complex, for now, we log error and might show a toast.
      // Consider re-fetching candidates for source/destination stages to ensure consistency.
      setSubmissionStatus({ type: 'error', message: `Falha ao atualizar etapa do candidato: ${error.message}` });
      // To revert, you would need to know the original state before the optimistic update,
      // or refetch the data for the affected stages.
      // For simplicity, a full re-fetch of affected stages is often a good approach on error.
      // fetchCandidatesForStage(sourceStageId); // You'd need to pass sourceStageId to this function or store it
      fetchCandidatesForStage(newStage); // Refetch destination to be sure
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">A carregar dados do pedido...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-background text-destructive p-4">
             <p className="mb-4">Erro ao carregar dados: {error}</p>
             <Button variant="outline" onClick={() => router.push('/recruitmentdashboard')}>
               <ArrowLeft className="h-4 w-4 mr-2" />
               Voltar ao Dashboard
             </Button>
           </div>;
  }

  if (!pedido) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
             <p className="mb-4">Pedido de recrutamento não encontrado.</p>
             <Button variant="outline" onClick={() => router.push('/recruitmentdashboard')}>
               <ArrowLeft className="h-4 w-4 mr-2" />
               Voltar ao Dashboard
             </Button>
           </div>;
  }

  const handleOpenAddCandidateModal = (stageId: string) => {
    setActiveModalStage(stageId);
    setNewCandidateData({ ...initialCandidateFormData, stage: stageId });
    setSubmissionStatus(null);
    setShowAddCandidateModal(true);
  };

  const handleCandidateFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCandidateData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionStatus(null);
    if (!pedido?.id) {
      setSubmissionStatus({ type: 'error', message: 'ID do pedido de recrutamento não encontrado.' });
      return;
    }

    const payload = {
      ...newCandidateData,
      recruitment_id: pedido.id,
    };

    try {
      const user = accounts?.[0];
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user?.localAccountId || user?.homeAccountId || 'unknown',
        'x-user-name': user?.name || 'Unknown User',
        'x-user-groups': JSON.stringify(user?.idTokenClaims?.groups || []),
      };

      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Falha ao adicionar candidato.');
      }
      setSubmissionStatus({ type: 'success', message: 'Candidato adicionado com sucesso!' });
      // Refresh candidate list for the stage
      fetchCandidatesForStage(activeModalStage); // Call the fetch function

      setTimeout(() => {
        setShowAddCandidateModal(false);
      }, 1500); // Close modal after a short delay

    } catch (err: any) {
      setSubmissionStatus({ type: 'error', message: err.message || 'Ocorreu um erro.' });
    }
  };

  const handleOpenViewEditModal = (candidate: Candidate) => {
    setSelectedCandidateForViewEdit(candidate);
    // Ensure all fields from Candidate are present in candidateEditData, falling back to initial if undefined
    const populatedEditData: Partial<Candidate> = {};
    Object.keys(initialCandidateFormData).forEach(key => {
      populatedEditData[key] = candidate[key] !== undefined ? candidate[key] : initialCandidateFormData[key];
    });
    setCandidateEditData({ ...populatedEditData, id: candidate.id }); // include id
    setSubmissionStatus(null); // Reset submission status
    setShowViewEditModal(true);
  };

  const handleCandidateEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCandidateEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateForViewEdit?.id) {
      setSubmissionStatus({ type: 'error', message: 'ID do candidato não encontrado para atualização.' });
      return;
    }
    setSubmissionStatus(null);

    // Remove fields that shouldn't be sent or are managed by DB/backend
    const { id, created_at, updated_at, application_date, recruitment_id, created_by, ...payload } = candidateEditData;

    try {
      const user = accounts?.[0];
      const headers = {
        'Content-Type': 'application/json',
        'x-user-id': user?.localAccountId || user?.homeAccountId || 'unknown',
        'x-user-name': user?.name || 'Unknown User',
        'x-user-groups': JSON.stringify(user?.idTokenClaims?.groups || []),
      };

      const res = await fetch(`/api/candidates/${selectedCandidateForViewEdit.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload), // Send only the updatable fields
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Falha ao atualizar candidato.');
      }
      setSubmissionStatus({ type: 'success', message: 'Candidato atualizado com sucesso!' });
      // Refresh candidate list for the stage
      if (selectedCandidateForViewEdit.stage) {
        fetchCandidatesForStage(selectedCandidateForViewEdit.stage);
      }
      
      setTimeout(() => {
        setShowViewEditModal(false);
      }, 1500);

    } catch (err: any) {
      setSubmissionStatus({ type: 'error', message: err.message || 'Ocorreu um erro ao atualizar.' });
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground">
      <header className="bg-card shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-12 h-12 mr-3">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10C27.909 10 10 27.909 10 50C10 72.091 27.909 90 50 90C72.091 90 90 72.091 90 50C90 27.909 72.091 10 50 10Z" fill="#933037" />
                <path d="M65 35C65 43.284 58.284 50 50 50C41.716 50 35 43.284 35 35C35 26.716 41.716 20 50 20C58.284 20 65 26.716 65 35Z" fill="white" />
                <path d="M30 70C30 59.402 38.85 50 50 50C61.15 50 70 59.402 70 70" stroke="white" strokeWidth="8" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">RH Process Manager</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center space-x-2">
              <div className="rounded-full bg-muted w-8 h-8 flex items-center justify-center text-muted-foreground font-bold">
                {hydrated ? getInitials(userName) : ""}
              </div>
              <div className="relative ml-2">
                <button
                  className="flex items-center px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onClick={() => setShowThemeDropdown(v => !v)}
                  type="button"
                  aria-label="Selecionar tema"
                >
                  <span className="mr-1">{currentTheme.icon}</span>
                  <span className="hidden sm:inline text-sm">{currentTheme.label}</span>
                  <ChevronDown className="ml-1 w-3 h-3" />
                </button>
                {showThemeDropdown && (
                  <div className="absolute right-0 mt-2 w-36 bg-card border border-border rounded shadow-lg z-50">
                    {themeOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={`w-full flex items-center px-3 py-2 text-left hover:bg-muted/50 ${theme === opt.value ? 'font-bold text-primary' : ''}`}
                        onClick={() => handleThemeDropdown(opt.value)}
                        type="button"
                      >
                        <span className="mr-2">{opt.icon}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
          <div className="flex items-center mb-4 sm:mb-0">
            <Briefcase className="h-8 w-8 mr-3 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">Gestão de Candidaturas</h2>
          </div>
          <Button variant="outline" onClick={() => router.push('/recruitmentdashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>

        <Card className="mb-8 bg-card/50">
          <CardHeader>
            <CardTitle className="text-xl">Detalhes do Pedido de Recrutamento #{pedido.id}</CardTitle>
            <CardDescription>A gerir candidaturas para o seguinte pedido:</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              <strong>Função:</strong> <span className="ml-1">{pedido.function}</span>
            </div>
            <div className="flex items-center">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <strong>Departamento:</strong> <span className="ml-1">{pedido.department}</span>
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <strong>Nº de Vagas:</strong> <span className="ml-1">{pedido.vacancies || 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
              <strong>Data do Pedido:</strong> <span className="ml-1">{pedido.request_date ? new Date(pedido.request_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2 text-muted-foreground" />
              <strong>Empresa:</strong> <span className="ml-1">{pedido.company}</span>
            </div>
            <div className="flex items-center">
                 <Badge variant={pedido.estado === 'Aprovado' ? 'default' : 'secondary'} className={pedido.estado === 'Aprovado' ? "bg-green-100 text-green-700" : ""}>{pedido.estado}</Badge>
            </div>
          </CardContent>
        </Card>

        <h3 className="text-xl font-semibold text-foreground mb-4">Etapas do Processo de Candidatura</h3>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {candidateStages.map((stage, index) => (
              <Droppable key={stage.id} droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`p-3 rounded-lg shadow-md ${snapshot.isDraggingOver ? (theme === 'dark' ? 'bg-zinc-700' : 'bg-primary/10') : (theme === 'dark' ? 'bg-zinc-800' : 'bg-card/80')}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className={`font-semibold ${theme === 'dark' ? 'text-zinc-100' : 'text-foreground'}`}>{index + 1}. {stage.title}</h4>
                      {/* Add Candidate button only for the first stage column */}
                      {index === 0 && (
                        <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80 h-7 w-7" onClick={() => handleOpenAddCandidateModal(stage.id)}>
                          <PlusCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                    <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-zinc-400' : 'text-muted-foreground'}`}>{stage.description}</p>
                    <div className="space-y-3 min-h-[150px]">
                      {loadingCandidates[stage.id] ? (
                        <p className={`text-sm ${theme === 'dark' ? 'text-zinc-400' : 'text-muted-foreground'}`}>A carregar...</p>
                      ) : candidatesByStage[stage.id] && candidatesByStage[stage.id].length > 0 ? (
                        candidatesByStage[stage.id].map((candidate, idx) => (
                          <Draggable key={candidate.id} draggableId={`candidate-${candidate.id}`} index={idx}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 rounded shadow cursor-pointer hover:shadow-lg transition-shadow
                                  ${snapshot.isDragging ? (theme === 'dark' ? 'bg-zinc-600 ring-2 ring-primary' : 'bg-primary/20 ring-2 ring-primary') 
                                                      : (theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 border border-zinc-600' : 'bg-slate-50 hover:bg-slate-100 border')}
                                `}
                                onClick={() => handleOpenViewEditModal(candidate)}
                              >
                                <CardTitle className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-zinc-100' : 'text-gray-800'}`}>{candidate.full_name}</CardTitle>
                                <CardDescription className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>{candidate.email}</CardDescription>
                                {candidate.phone && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>Tel: {candidate.phone}</p>}
                                {candidate.current_position && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>Cargo: {candidate.current_position}</p>}
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : (
                        <p className={`text-sm text-center py-4 ${theme === 'dark' ? 'text-zinc-500' : 'text-muted-foreground'}`}>Sem candidatos nesta etapa.</p>
                      )}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>

        {/* Add Candidate Modal */}
        <Dialog open={showAddCandidateModal} onOpenChange={setShowAddCandidateModal}>
          <DialogContent className={`sm:max-w-3xl ${theme === 'dark' ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-gray-900'} max-h-[90vh] flex flex-col`}>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className={`${theme === 'dark' ? 'text-zinc-50' : 'text-gray-900'}`}>Adicionar Novo Candidato</DialogTitle>
              <DialogDescription className={`${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
                A adicionar candidato para a etapa: {candidateStages.find(s => s.id === activeModalStage)?.title || activeModalStage}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCandidateSubmit} className="flex-grow overflow-y-auto space-y-6 py-4 px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <Label htmlFor="full_name" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Nome Completo*</Label>
                  <Input id="full_name" name="full_name" value={newCandidateData.full_name} onChange={handleCandidateFormChange} required 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="email" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Email*</Label>
                  <Input id="email" name="email" type="email" value={newCandidateData.email} onChange={handleCandidateFormChange} required 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="phone" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Telefone</Label> {/* Changed to optional as per image */}
                  <Input id="phone" name="phone" value={newCandidateData.phone} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="current_position" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Função Atual</Label>
                  <Input id="current_position" name="current_position" value={newCandidateData.current_position} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="education" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Educação</Label>
                  <Input id="education" name="education" value={newCandidateData.education} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="source" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Origem</Label>
                  <Input id="source" name="source" value={newCandidateData.source} onChange={handleCandidateFormChange} placeholder="Ex: Portal, LinkedIn, Referência" 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="birth_date" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Data de Nascimento</Label>
                  <Input id="birth_date" name="birth_date" type="date" value={newCandidateData.birth_date} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500 text-zinc-300' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="nationality" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Nacionalidade</Label>
                  <Input id="nationality" name="nationality" value={newCandidateData.nationality} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="location" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Localização (Cidade/País)</Label>
                  <Input id="location" name="location" value={newCandidateData.location} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div>
                  <Label htmlFor="current_employer" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Empresa Atual</Label>
                  <Input id="current_employer" name="current_employer" value={newCandidateData.current_employer} onChange={handleCandidateFormChange} 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="languages" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Línguas</Label>
                  <Textarea id="languages" name="languages" value={newCandidateData.languages} onChange={handleCandidateFormChange} placeholder="Ex: Português (Nativo), Inglês (C1), Francês (B2)" 
                            className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="motivation" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Motivação/Carta de Apresentação</Label>
                  <Textarea id="motivation" name="motivation" value={newCandidateData.motivation} onChange={handleCandidateFormChange} rows={3} 
                            className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="evaluation_notes" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Notas de Avaliação Iniciais</Label>
                  <Textarea id="evaluation_notes" name="evaluation_notes" value={newCandidateData.evaluation_notes} onChange={handleCandidateFormChange} rows={3} 
                            className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div className="flex items-center space-x-2 md:col-span-1">
                  <Switch id="shortlisted" name="shortlisted" checked={newCandidateData.shortlisted} 
                          onCheckedChange={(checked) => setNewCandidateData(prev => ({ ...prev, shortlisted: checked }))} />
                  <Label htmlFor="shortlisted" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Shortlist?</Label>
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="status" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Status Inicial</Label>
                  <Select name="status" value={newCandidateData.status} onValueChange={(value) => setNewCandidateData(prev => ({ ...prev, status: value }))} >
                    <SelectTrigger className={`mt-1 w-full ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent className={`${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                      <SelectItem value="withdrawn">Desistiu</SelectItem>
                      {/* 'hired' status might be set at a later stage */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="skills" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Competências</Label>
                  <Textarea id="skills" name="skills" value={newCandidateData.skills} onChange={handleCandidateFormChange} placeholder="Ex: React, Next.js, Liderança" 
                            className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="cv_url" className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'}`}>Link CV (URL)</Label>
                  <Input id="cv_url" name="cv_url" type="text" value={newCandidateData.cv_url} onChange={handleCandidateFormChange} placeholder="https://linkedin.com/in/... ou link para PDF" 
                         className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'}`}/>
                </div>
                {/* Consider adding other fields like: birth_date, nationality, location, current_employer, motivation, evaluation_notes if needed in this quick add */}
              </div>
              
              {submissionStatus && (
                <div className={`p-3 my-4 rounded-md text-sm ${submissionStatus.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                  {submissionStatus.message}
                </div>
              )}

            </form>
            <DialogFooter className="pt-4 px-6 pb-6 border-t border-border">
                <DialogClose asChild>
                    <Button type="button" variant="outline" className={`${theme === 'dark' ? 'text-zinc-300 border-zinc-600 hover:bg-zinc-700 hover:text-zinc-200' : ''}`}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" className={`${theme === 'dark' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>Adicionar Candidato</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View/Edit Candidate Modal */}
        <Dialog open={showViewEditModal} onOpenChange={setShowViewEditModal}>
          <DialogContent className={`sm:max-w-3xl ${theme === 'dark' ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-gray-900'} max-h-[90vh] flex flex-col`}>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className={`${theme === 'dark' ? 'text-zinc-50' : 'text-gray-900'}`}>
                {selectedCandidateForViewEdit?.stage === candidateStages[4].id ? 'Ver Detalhes do Candidato' : 'Editar Candidato'}
              </DialogTitle>
              <DialogDescription className={`${theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'}`}>
                {selectedCandidateForViewEdit?.full_name} - Etapa: {candidateStages.find(s => s.id === selectedCandidateForViewEdit?.stage)?.title || selectedCandidateForViewEdit?.stage}
              </DialogDescription>
            </DialogHeader>
            {selectedCandidateForViewEdit && (
              <form onSubmit={handleUpdateCandidateSubmit} className="flex-grow overflow-y-auto space-y-6 py-4 px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {Object.entries(initialCandidateFormData).map(([key, initialValue]) => {
                    if (key === 'stage') return null; // Stage is not directly editable here, it's managed by drag-and-drop
                    
                    const labelText = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    const isReadOnly = selectedCandidateForViewEdit?.stage === candidateStages[4].id;
                    const currentValue = candidateEditData[key] !== undefined ? candidateEditData[key] : '';

                    if (key === 'shortlisted') {
                      return (
                        <div key={key} className="flex items-center space-x-2 md:col-span-1">
                          <Switch id={`edit-${key}`} name={key} checked={!!currentValue}
                                  onCheckedChange={(checked) => setCandidateEditData(prev => ({ ...prev, [key]: checked }))} 
                                  disabled={isReadOnly} 
                                  className={`${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`} />
                          <Label htmlFor={`edit-${key}`} className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'} ${isReadOnly ? 'opacity-70' : ''}`}>{labelText}?</Label>
                        </div>
                      );
                    }

                    if (key === 'status') {
                       return (
                        <div key={key} className="md:col-span-1">
                          <Label htmlFor={`edit-${key}`} className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'} ${isReadOnly ? 'opacity-70' : ''}`}>{labelText}</Label>
                          <Select name={key} value={currentValue as string || 'active'} 
                                  onValueChange={(value) => setCandidateEditData(prev => ({ ...prev, [key]: value }))} 
                                  disabled={isReadOnly} >
                            <SelectTrigger className={`mt-1 w-full ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className={`${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : ''}`}>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="rejected">Rejeitado</SelectItem>
                              <SelectItem value="withdrawn">Desistiu</SelectItem>
                              <SelectItem value="hired">Contratado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                       );
                    }
                    
                    const inputType = key === 'birth_date' ? 'date' : key === 'email' ? 'email' : 'text';
                    const isTextarea = ['skills', 'motivation', 'evaluation_notes', 'languages'].includes(key);

                    return (
                      <div key={key} className={(isTextarea || key === 'cv_url') ? 'md:col-span-2' : 'md:col-span-1'}>
                        <Label htmlFor={`edit-${key}`} className={`${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'} ${isReadOnly ? 'opacity-70' : ''}`}>{labelText}{initialCandidateFormData[key] !== undefined && typeof initialCandidateFormData[key] === 'string' && (initialCandidateFormData[key] === '' || initialCandidateFormData[key] === null) && key.endsWith('_name') ? '' : '*'}</Label>
                        {isTextarea ? (
                          <Textarea id={`edit-${key}`} name={key} value={currentValue as string || ''} onChange={handleCandidateEditFormChange} readOnly={isReadOnly}
                                    rows={key === 'skills' || key === 'motivation' ? 3 : 2}
                                    className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''}`}/>
                        ) : (
                          <Input id={`edit-${key}`} name={key} type={inputType} value={currentValue as string || ''} onChange={handleCandidateEditFormChange} readOnly={isReadOnly}
                                 className={`mt-1 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 placeholder-zinc-500' : 'bg-white'} ${isReadOnly ? 'cursor-not-allowed opacity-70' : ''} ${key === 'birth_date' && theme === 'dark' ? 'text-zinc-300' : ''}`}/>
                        )}
                      </div>
                    );
                  })}
                </div>
                {submissionStatus && (
                  <div className={`p-3 my-4 rounded-md text-sm ${submissionStatus.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {submissionStatus.message}
                  </div>
                )}
              </form>
            )}
            <DialogFooter className="pt-4 px-6 pb-6 border-t border-border">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={`${theme === 'dark' ? 'text-zinc-300 border-zinc-600 hover:bg-zinc-700 hover:text-zinc-200' : ''}`}>
                  {selectedCandidateForViewEdit?.stage === candidateStages[4].id ? 'Fechar' : 'Cancelar'}
                </Button>
              </DialogClose>
              {selectedCandidateForViewEdit?.stage !== candidateStages[4].id && (
                <Button type="submit" onClick={handleUpdateCandidateSubmit} className={`${theme === 'dark' ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                  Guardar Alterações
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
} 