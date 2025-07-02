import { useEffect, useRef, useState } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import gsap from "gsap";
import { useFuncionario } from "../context/FuncionarioContext";
import { useRouter } from "next/router";
import HistoricoAlteracoes from "../components/HistoricoAlteracoes";
import { Eye, Pencil, Clock, Trash, CheckCircle2, XCircle, Info, FileCheck2, Briefcase } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, Bar } from 'recharts';
import Link from 'next/link';
import Head from 'next/head';
// Importe aqui os ícones e componentes necessários, ou substitua por placeholders se não existirem
// import { Search, UserPlus, UserX, RefreshCw, BarChart2, Briefcase } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { employees, processStats, recentProcesses, searchEmployees } from "@/lib/mock-data";
// import DashboardContent from "./dashboard-content";
// import RecruitmentForm from "./recruitment-form";
// import AdmissionForm from "./admission-form";
// import MobilityForm from "./mobility-form";
// import TerminationForm from "./termination-form";

interface Pedido {
  id: number;
  company: string;
  department: string;
  function: string;
  estado: string; // 'Pendente', 'Aprovado', 'Rejeitado'
  responsible_identification: string | number; // Assuming this can be string or number
  request_date?: string; // Assuming date comes as string initially
  admission_date?: string;
  type?: string;
  vacancies?: number;
  justification?: string;
  pre_identified_candidates?: string;
  recruitment_validated_by?: string;
  hr_intervention?: boolean;
  responsibilities?: string;
  profile?: string;
  contract?: string;
  duration?: string;
  contract_geography?: string;
  salary?: string; // Could be number if always numeric
  premium_type?: string;
  premium_value?: string; // Could be number
  meals?: string;
  card_plafond?: string; // Could be number
  health_insurance?: string;
  mobile?: boolean;
  new_mobile?: boolean;
  car?: boolean;
  laptop?: boolean;
  visit_card?: boolean;
  card_function?: string;
  epi?: boolean;
  work_clothes?: boolean;
  other_equipment?: string;
  expatriation_country?: string;
  annual_trips?: string | number;
  local_housing?: string;
  local_transport?: string;
  expatriation_meals?: string;
  weekly_aid?: string;
  weekly_aid_value?: string; // Could be number
  obs?: string;
  created_at?: string;
  created_by?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  // Add other fields from your data structure as needed
}

// Utilitário para traduzir nomes de campos para PT
const fieldLabels = {
  profile: 'Perfil',
  company: 'Empresa',
  contract: 'Contrato',
  duration: 'Duração',
  function: 'Função',
  vacancies: 'Nº Vagas',
  created_at: 'Criado em',
  created_by: 'Criado por',
  department: 'Departamento',
  new_mobile: 'Novo Telemóvel',
  visit_card: 'Cartão de Visita',
  weekly_aid: 'Ajuda Semanal',
  annual_trips: 'Viagens/ano',
  card_plafond: 'Cartão Plafond',
  premium_type: 'Tipo Prémio',
  request_date: 'Data do Pedido',
  work_clothes: 'Vestuário Trabalho',
  salary: 'Salário',
  obs: 'Observações',
  state: 'Estado',
  estado: 'Estado',
  // ...adiciona mais conforme necessário
};
function labelPT(key) {
  return fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Função utilitária para obter as iniciais (primeira e última palavra)
function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// This is a common structure for a tab button, adjust if yours is different
const TabButton = ({ href, children, currentPath }) => {
  const isActive = currentPath === href || (href !== "/recruitmentdashboard" && currentPath.startsWith(href));
  return (
    <Link href={href} legacyBehavior>
      <a
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
          ${isActive
            ? 'bg-black text-white' 
            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
          }
        `}
      >
        {children}
      </a>
    </Link>
  );
};

export default function RecruitmentDashboard() {
  const [activeTab, setActiveTab] = useState("recruitmentdashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { funcionarioSelecionado, setFuncionarioSelecionado } = useFuncionario();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [erroPedidos, setErroPedidos] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoId, setHistoricoId] = useState(null);
  const [historicoDetalhe, setHistoricoDetalhe] = useState(null);
  const [historicoResumo, setHistoricoResumo] = useState([]);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoLog, setHistoricoLog] = useState([]);
  const modalRef = useRef(null);
  const [theme, setTheme] = useState('light');
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [printAudit, setPrintAudit] = useState(null);
  const [pedidoLog, setPedidoLog] = useState(null);
  const userName = accounts?.[0]?.name || 'Utilizador';
  const user = accounts?.[0];
  const userId = user?.username;
  const userGroups = Array.isArray(user?.idTokenClaims?.groups) ? user.idTokenClaims.groups : [];
  const isRH = userGroups.includes("a837ee80-f103-4d51-9869-e3b4da6bdeda");
  console.log("Dashboard User Auth: userGroups", userGroups, "isRH", isRH);
  const [hydrated, setHydrated] = useState(false);

  // State for approval/rejection workflow - MOVED EARLIER
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentProcessingPedidoId, setCurrentProcessingPedidoId] = useState(null);
  const [actionError, setActionError] = useState(null); 
  const [actionSuccess, setActionSuccess] = useState(null);

  // Calculate KPI counts
  const pedidosPendentesCount = pedidos.filter(p => p.estado === 'Pendente').length;
  const pedidosAprovadosCount = pedidos.filter(p => p.estado === 'Aprovado').length;
  const pedidosRejeitadosCount = pedidos.filter(p => p.estado === 'Rejeitado').length;
  // const pedidosEmAndamentoCount = pedidosAprovadosCount; // This will be part of the donut chart

  const estadoChartData = [
    { name: 'Pendentes', value: pedidosPendentesCount, color: '#FDE047' }, // yellow-300
    { name: 'Aprovados', value: pedidosAprovadosCount, color: '#4ADE80' }, // green-400
    { name: 'Rejeitados', value: pedidosRejeitadosCount, color: '#F87171' },  // red-400
  ];

  const chartContainerRef = useRef(null); // Ref for Estado Geral chart
  const deptChartContainerRef = useRef(null); // Ref for Departamento chart
  const monthlyChartContainerRef = useRef(null); // Ref for Pedidos por Mês chart
  const contractTypesChartContainerRef = useRef(null); // Ref for Contract Types chart

  // Process data for Pedidos por Departamento chart
  const pedidosPorDepartamentoData = pedidos.reduce((acc: { [key: string]: number }, pedido: Pedido) => {
    const dept = pedido.department || 'Indefinido';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  const departamentoChartData = Object.entries(pedidosPorDepartamentoData).map(([name, value]) => ({
    name,
    value,
  }));

  // Process data for Pedidos por Mês chart
  const pedidosPorMesData = pedidos.reduce((acc: { [key: string]: number }, pedido: Pedido) => {
    if (pedido.request_date) {
      try {
        const date = new Date(pedido.request_date);
        // Ensure date is valid before proceeding
        if (isNaN(date.getTime())) {
          console.warn("Invalid request_date:", pedido.request_date);
          return acc;
        }
        const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        acc[monthYear] = (acc[monthYear] || 0) + 1;
      } catch (e) {
        console.error("Error processing date for pedido:", pedido.id, pedido.request_date, e);
      }
    }
    return acc;
  }, {});

  const monthlyChartData = Object.entries(pedidosPorMesData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()); // Sort by monthYear

  // Process data for Tipos de Contrato (Aprovados) chart
  const aprovadosPorContratoData = pedidos
    .filter(pedido => pedido.estado === 'Aprovado')
    .reduce((acc: { [key: string]: number }, pedido: Pedido) => {
      const contractType = pedido.contract || 'Indefinido';
      acc[contractType] = (acc[contractType] || 0) + 1;
      return acc;
    }, {});

  const contractTypesChartData = Object.entries(aprovadosPorContratoData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value); // Sort by count descending

  // Simple distinct color generator for department chart (can be improved)
  const generateColor = (index, total) => {
    const hue = (index * (360 / (total + 1))) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Log chart data for debugging
  console.log("Estado Chart Data:", estadoChartData);
  console.log("Departamento Chart Data:", departamentoChartData);
  console.log("Monthly Chart Data:", monthlyChartData);
  console.log("Contract Types Chart Data:", contractTypesChartData);

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: '🌞' },
    { value: 'dark', label: 'Escuro', icon: '🌙' },
    { value: 'color-blind', label: 'Daltónico', icon: '👁️' },
  ];
  const currentTheme = themeOptions.find(opt => opt.value === theme) || themeOptions[0];
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);

  function handleThemeDropdown(themeValue) {
    setTheme(themeValue);
    document.documentElement.classList.remove('light', 'dark', 'color-blind');
    document.documentElement.classList.add(themeValue);
    setShowThemeDropdown(false);
  }

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );
    }
    // Simplified GSAP for debugging
    if (deptChartContainerRef.current) {
      gsap.fromTo(deptChartContainerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.2 });
    }
    if (monthlyChartContainerRef.current) {
      gsap.fromTo(monthlyChartContainerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.4 });
    }
    if (contractTypesChartContainerRef.current) {
      gsap.fromTo(contractTypesChartContainerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.6 });
    }
  }, [pedidos, theme]); // Rerun animation if pedidos data changes or theme

  useEffect(() => {
    const fetchFuncionarios = async () => {
      if (!isAuthenticated || !accounts[0]) return;
      setLoading(true);
      setError(null);
      try {
        const azureUserId = accounts[0]?.username;
        console.log("Fetching employees for Azure AD userId:", azureUserId);
        if (!azureUserId) {
          throw new Error("Azure AD User ID not available.");
        }
        const response = await fetch(`/api/employee?userId=${azureUserId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          console.error("Error response from /api/employee:", response.status, errorData);
          throw new Error(errorData.message || 'Erro ao buscar funcionários');
        }
        const data = await response.json();
        const ativos = data.filter(f => f.Active);
        setFuncionarios(ativos);
        if (ativos.length === 1) setFuncionarioSelecionado(ativos[0]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFuncionarios();
  }, [isAuthenticated, accounts]);

  const fetchPedidos = async () => {
    if (!funcionarioSelecionado || !funcionarioSelecionado.Number) {
      setPedidos([]);
      setLoadingPedidos(false);
      return;
    }
    setLoadingPedidos(true);
    setErroPedidos(null);
    setActionError(null); 
    setActionSuccess(null); 
    try {
      const res = await fetch(`/api/recruitment?userId=${funcionarioSelecionado.Number}`);
      if (!res.ok) throw new Error('Erro ao buscar pedidos');
      let data = await res.json();
      data = data.map(pedido => ({
        ...pedido,
        approved_by: pedido.approved_by || null,
        approved_at: pedido.approved_at || null,
        rejected_by: pedido.rejected_by || null,
        rejected_at: pedido.rejected_at || null,
        rejection_reason: pedido.rejection_reason || null,
      }));
      setPedidos(data);
    } catch (err) {
      setErroPedidos(err.message);
      setPedidos([]);
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [funcionarioSelecionado]);

  useEffect(() => {
    if (showHistoricoModal && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, y: 100, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }
      );
    }
  }, [showHistoricoModal]);

  const handleSelect = (e) => {
    const idx = e.target.value;
    setFuncionarioSelecionado(funcionarios[idx]);
  };

  const handleGoToRecruitment = () => {
    router.push('/recruitment');
  };

  const handleEditPedido = (id) => {
    router.push(`/recruitment?id=${id}`);
  };

  const handleOpenHistorico = async (pedidoId) => {
    const pedido = pedidos.find(p => p.id === pedidoId);
    setPedidoSelecionado(pedido);
    setHistoricoId(pedidoId);
    setShowHistoricoModal(true);
    try {
      const res = await fetch(`/api/recruitment-log?recruitmentId=${pedidoId}`);
      const data = await res.json();
      setHistoricoResumo(data);
      setHistoricoDetalhe(null);
      setHistoricoLog(data);
    } catch (err) {
      setHistoricoResumo([]);
      setHistoricoDetalhe(null);
      setHistoricoLog([]);
    }
  };
  
  const handleOpenDetalhe = (log) => {
    setHistoricoDetalhe(log);
  };

  const handleCloseHistorico = () => {
    setShowHistoricoModal(false);
    setHistoricoDetalhe(null);
    setHistoricoResumo([]);
    setHistoricoLog([]);
  };

  const handleOpenPedido = async (id) => {
    const pedido = pedidos.find(p => p.id === id);
    setPedidoSelecionado(pedido);
    setShowPedidoModal(true);
    console.log("Opening Pedido Modal: pedidoSelecionado", pedido, "Estado do Pedido?", pedido?.estado);
    try {
      const res = await fetch(`/api/recruitment-log?recruitmentId=${id}`);
      const logs = await res.json();
      if (Array.isArray(logs) && logs.length > 0) {
        setPedidoLog(logs[logs.length - 1]);
      } else {
        setPedidoLog(null);
      }
    } catch {
      setPedidoLog(null);
    }
  };

  const handleClosePedido = () => {
    setShowPedidoModal(false);
    setPedidoSelecionado(null);
    setPedidoLog(null);
  };

  function printModalContent() {
    const modalContent = document.getElementById('modal-ver-pedido');
    if (!modalContent) return;
    const printWindow = window.open('', '', 'width=900,height=1200');
    if (printWindow) {
      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(node => node.outerHTML).join('');
      printWindow.document.write(`
        <html>
          <head>
            <title>Impressão</title>
            ${styles}
            <style>
              body {
                font-family: sans-serif;
                padding: 2rem;
                background: #fff;
                color: #000;
              }
              .no-print, .no-print * {
                display: none !important;
              }
              @media print {
                html, body {
                  height: auto !important;
                  overflow: visible !important;
                }
                #modal-ver-pedido {
                  all: unset;
                  display: block;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: auto !important;
                  overflow: visible !important;
                }
                .overflow-y-auto {
                  overflow: visible !important;
                  max-height: none !important;
                }
                .print\:max-h-full {
                  max-height: none !important;
                }
                .print\:overflow-visible {
                  overflow: visible !important;
                }
                .print\:p-0 {
                  padding: 0 !important;
                }
                .print\:shadow-none {
                  box-shadow: none !important;
                }
                .print\:rounded-none {
                  border-radius: 0 !important;
                }
                section, .print-page-break {
                  page-break-inside: avoid;
                }
                .print-page-break {
                  page-break-before: always;
                }
                .pdf-page-break {
                  display: block;
                  page-break-before: always;
                  break-before: page;
                  height: 0;
                  margin: 0;
                  padding: 0;
                  border: none;
                }
                .pdf-section {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                .pdf-header, .pdf-footer {
                  display: none;
                }
              }
              @media print, (min-width: 0) {
                .pdf-header, .pdf-footer {
                  display: block !important;
                }
              }
            </style>
          </head>
          <body>
            <div id="modal-ver-pedido">${modalContent.innerHTML}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    }
  }

  async function exportModalToPDF() {
    const modalContent = document.getElementById('modal-ver-pedido');
    if (!modalContent || !pedidoSelecionado?.id) return;
    const fileName = `F-RH-15 - Pedido #${pedidoSelecionado.id}.pdf`;

    // Importa só no browser!
    const html2pdf = (await import('html2pdf.js')).default;

    // Esconder elementos .no-print
    const noPrintEls = modalContent.querySelectorAll('.no-print');
    noPrintEls.forEach(el => (el as HTMLElement).style.display = 'none');

    // Remover overflow e max-height temporariamente
    const oldOverflow = (modalContent as HTMLElement).style.overflow;
    const oldMaxHeight = (modalContent as HTMLElement).style.maxHeight;
    (modalContent as HTMLElement).style.overflow = 'visible';
    (modalContent as HTMLElement).style.maxHeight = 'none';

    const opt = {
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(modalContent).save().then(() => {
      // Restaurar estilos
      noPrintEls.forEach(el => (el as HTMLElement).style.display = '');
      (modalContent as HTMLElement).style.overflow = oldOverflow;
      (modalContent as HTMLElement).style.maxHeight = oldMaxHeight;
    });
  }

  function handleDeletePedido(id) {
    alert(`Eliminar pedido ${id} (implementar lógica de backend!)`);
  }

  const getAuthHeaders = () => {
    const user = accounts?.[0];
    if (!user) return {};
    return {
      'Content-Type': 'application/json',
      'x-user-id': user.localAccountId || user.homeAccountId || 'unknown',
      'x-user-name': user.name || 'Unknown User',
      'x-user-groups': JSON.stringify(user.idTokenClaims?.groups || []),
    };
  };

  const handleApprovePedido = async (pedidoId) => {
    if (!confirm("Tem a certeza que quer aprovar este pedido?")) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/recruitment/${pedidoId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Falha ao aprovar o pedido.");
      }
      setActionSuccess(result.message);
      fetchPedidos(); 
      setShowPedidoModal(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  const openRejectionModal = (pedidoId) => {
    setCurrentProcessingPedidoId(pedidoId);
    setRejectionReason("");
    setShowRejectionModal(true);
    setActionError(null);
    setActionSuccess(null);
  };

  const handleRejectPedido = async () => {
    if (!currentProcessingPedidoId || !rejectionReason.trim()) {
      alert("Por favor, forneça um motivo para a rejeição.");
      return;
    }
    if (!confirm("Tem a certeza que quer rejeitar este pedido?")) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/recruitment/${currentProcessingPedidoId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Falha ao rejeitar o pedido.");
      }
      setActionSuccess(result.message);
      setShowRejectionModal(false);
      setCurrentProcessingPedidoId(null);
      setRejectionReason("");
      fetchPedidos();
      setShowPedidoModal(false);
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground">
      <Head>
        <title>Dashboard de Processos RH</title>
      </Head>
      <header className="bg-card shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-12 h-12 mr-3">
              {/* Logo SVG */}
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
              {/* Avatar e seletor de utilizador */}
              <div className="rounded-full bg-muted w-8 h-8 flex items-center justify-center text-muted-foreground font-bold">
                {hydrated ? getInitials(userName) : ""}
              </div>
              {/* Dropdown de funcionário no topo direito */}
              {loading ? (
                <span className="text-muted-foreground text-sm">A carregar...</span>
              ) : error ? (
                <span className="text-destructive text-sm">{error}</span>
              ) : (
                <select
                  className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                  value={funcionarios.findIndex(f => f === funcionarioSelecionado)}
                  onChange={handleSelect}
                >
                  <option value="">-- Escolha o funcionário --</option>
                  {funcionarios.map((f, idx) => (
                    <option key={f.Number} value={idx}>
                      {f.Number} | {f.CompanyName} | {f.Name}
                    </option>
                  ))}
                </select>
              )}
              {/* Seletor de tema moderno */}
              <div className="relative ml-2">
                <button
                  className="flex items-center px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onClick={() => setShowThemeDropdown(v => !v)}
                  type="button"
                  aria-label="Selecionar tema"
                >
                  <span className="mr-1">{currentTheme.icon}</span>
                  <span className="hidden sm:inline text-sm">{currentTheme.label}</span>
                  <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4 sm:mb-0">Gestão de Processos RH</h2>
          {/* Tabs e conteúdos podem ser implementados conforme necessário */}
          <div className="w-full sm:w-auto">
            <div className="mb-6 flex space-x-1 border-b border-gray-300 pb-2 flex-wrap">
              <TabButton href="/recruitmentdashboard" currentPath={router.pathname}>Dashboard</TabButton>
              <TabButton href="/recrutamento" currentPath={router.pathname}>Recrutamento</TabButton>
              <TabButton href="/admissao" currentPath={router.pathname}>Admissão</TabButton>
              <TabButton href="/mobilidade" currentPath={router.pathname}>Mobilidade</TabButton>
              <TabButton href="/cessacoes" currentPath={router.pathname}>Cessações</TabButton>
              <TabButton href="/evaluation" currentPath={router.pathname}>Avaliações</TabButton>
            </div>
          </div>
        </div>

        {/* KPI Charts Section - Now a grid for multiple charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Estado Geral dos Pedidos Chart */}
          <div ref={chartContainerRef} className="p-4 bg-card rounded-lg shadow md:col-span-1 min-h-[300px]">
            <h3 className={`text-lg font-semibold mb-2 text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Estado Geral dos Pedidos</h3>
            {estadoChartData.filter(d => d.value > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={estadoChartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    innerRadius={45}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }) => {
                      if (percent < 0.05) return null; // Don't render label for segments less than 5%
                      const RADIAN = Math.PI / 180;
                      // const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      // Adjusted radius to place label more centrally if desired, or use fixed offset for consistency
                      const radius = (outerRadius + innerRadius) / 2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="#374151" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fontSize="12">
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                  >
                    {estadoChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff', borderRadius: '0.5rem', borderColor: theme === 'dark' ? '#3f3f46' : '#e5e7eb' }}
                    itemStyle={{ color: theme === 'dark' ? '#f4f4f5' : '#374151' }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(200,200,200,0.1)' : 'rgba(0,0,0,0.05)'}}
                  />
                  <Legend 
                    iconType="circle" 
                    wrapperStyle={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className={`text-center py-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} style={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563' }}>Sem dados para o gráfico de estados.</p>
            )}
          </div>

          {/* Pedidos por Departamento Chart */}
          <div ref={deptChartContainerRef} className="p-4 bg-card rounded-lg shadow md:col-span-1 min-h-[300px]">
            <h3 className={`text-lg font-semibold mb-2 text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Pedidos por Departamento</h3>
            {departamentoChartData.filter(d => d.value > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={departamentoChartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                  >
                    {departamentoChartData.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-dept-${index}`} fill={generateColor(index, departamentoChartData.filter(d => d.value > 0).length)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff', borderRadius: '0.5rem', borderColor: theme === 'dark' ? '#3f3f46' : '#e5e7eb' }}
                    itemStyle={{ color: theme === 'dark' ? '#f4f4f5' : '#374151' }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(200,200,200,0.1)' : 'rgba(0,0,0,0.05)'}}
                  />
                  {/* <Legend iconType="circle" wrapperStyle={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563', paddingTop: '10px' }} /> */}
                  {/* Legend might be too cluttered for many departments, tooltip is primary */}
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className={`text-center py-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} style={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563' }}>Sem dados para o gráfico de departamentos.</p>
            )}
          </div>

          {/* Pedidos por Mês Chart */}
          <div ref={monthlyChartContainerRef} className="p-4 bg-card rounded-lg shadow md:col-span-1 min-h-[300px]">
            <h3 className={`text-lg font-semibold mb-2 text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Pedidos por Mês</h3>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: theme === 'dark' ? '#a0a0a0' : '#6b7280' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#a0a0a0' : '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff', borderRadius: '0.5rem', borderColor: theme === 'dark' ? '#3f3f46' : '#e5e7eb' }}
                    itemStyle={{ color: theme === 'dark' ? '#f4f4f5' : '#374151' }}
                    cursor={{ stroke: theme === 'dark' ? '#4ADE80' : '#10B981', strokeWidth: 1 }}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
                    }}
                  />
                  <Legend wrapperStyle={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="value" name="Nº Pedidos" stroke={theme === 'dark' ? '#60A5FA' : '#3B82F6'} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className={`text-center py-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} style={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563' }}>Sem dados para o gráfico mensal.</p>
            )}
          </div>

          {/* Tipos de Contrato Mais Solicitados Chart */}
          <div ref={contractTypesChartContainerRef} className="p-4 bg-card rounded-lg shadow md:col-span-1 min-h-[300px]">
            <h3 className={`text-lg font-semibold mb-2 text-center ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Tipos de Contrato (Aprovados)</h3>
            {contractTypesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={contractTypesChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: theme === 'dark' ? '#a0a0a0' : '#6b7280' }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: theme === 'dark' ? '#a0a0a0' : '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#27272a' : '#ffffff', borderRadius: '0.5rem', borderColor: theme === 'dark' ? '#3f3f46' : '#e5e7eb' }}
                    itemStyle={{ color: theme === 'dark' ? '#f4f4f5' : '#374151' }}
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
                  />
                  <Legend wrapperStyle={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563', paddingTop: '10px' }} />
                  <Bar dataKey="value" name="Nº Pedidos Aprovados" >
                    {contractTypesChartData.map((entry, index) => (
                      <Cell key={`cell-contract-${index}`} fill={generateColor(index, contractTypesChartData.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className={`text-center py-10 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`} style={{ color: theme === 'dark' ? '#d1d5db' : '#4b5563' }}>Sem dados de contratos aprovados.</p>
            )}
          </div>
        </div>

        {actionError && <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-200">{actionError}</div>}
        {actionSuccess && <div className="mb-4 p-3 rounded bg-green-100 text-green-700 border-green-200">{actionSuccess}</div>}

        <div className="bg-card rounded-lg shadow p-6 mt-8 text-card-foreground">
          <h3 className="text-lg font-semibold mb-4">Pedidos de Recrutamento Submetidos</h3>
          {loadingPedidos ? (
            <p>A carregar pedidos...</p>
          ) : erroPedidos ? (
            <p className="text-destructive">{erroPedidos}</p>
          ) : Array.isArray(pedidos) && pedidos.length === 0 ? (
            <p>Não existem pedidos submetidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Pedido</th>
                    <th className="px-4 py-2 text-left">Empresa</th>
                    <th className="px-4 py-2 text-left">Departamento</th>
                    <th className="px-4 py-2 text-left">Função</th>
                    <th className="px-4 py-2 text-left">Estado</th>
                    <th className="px-4 py-2 text-left">RIN</th>
                    <th className="px-4 py-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {pedidos.map((pedido) => (
                    <tr key={pedido.id}>
                      <td className="px-4 py-2">{pedido.id}</td>
                      <td className="px-4 py-2">{pedido.company}</td>
                      <td className="px-4 py-2">{pedido.department}</td>
                      <td className="px-4 py-2">{pedido.function}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${ 
                          pedido.estado === 'Aprovado' ? 'bg-green-100 text-green-700' : 
                          pedido.estado === 'Rejeitado' ? 'bg-red-100 text-red-700' : 
                          pedido.estado === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700' 
                        }`}>
                          {pedido.estado}
                        </span>
                        {pedido.estado === 'Aprovado' && pedido.approved_by && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center" title={`Aprovado por ${pedido.approved_by} em ${new Date(pedido.approved_at).toLocaleDateString()}`}>
                            <Info size={12} className="mr-1" /> Por: {pedido.approved_by.split(' ')[0]} ({new Date(pedido.approved_at).toLocaleDateString()})
                          </div>
                        )}
                        {pedido.estado === 'Rejeitado' && pedido.rejected_by && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center" title={`Rejeitado por ${pedido.rejected_by} em ${new Date(pedido.rejected_at).toLocaleDateString()} - Motivo: ${pedido.rejection_reason}`}>
                            <Info size={12} className="mr-1" /> Por: {pedido.rejected_by.split(' ')[0]} ({new Date(pedido.rejected_at).toLocaleDateString()})
                             {/* Consider adding a way to see full reason if long */}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">{pedido.responsible_identification}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2 items-center">
                          <button
                            className="p-1 hover:bg-muted/50 rounded"
                            title="Ver"
                            onClick={() => handleOpenPedido(pedido.id)}
                          >
                            <Eye size={18} />
                          </button>
                          {pedido.estado === 'Aprovado' && (
                            <button
                              className="p-1 hover:bg-primary/10 rounded text-primary"
                              title="Gerir Candidaturas"
                              onClick={() => router.push(`/candidate-management/${pedido.id}`)}
                            >
                              <Briefcase size={18} />
                            </button>
                          )}
                          {(isRH || pedido.responsible_identification == funcionarioSelecionado?.Number) && pedido.estado === 'Pendente' && (
                            <button
                              className="p-1 hover:bg-primary/10 rounded text-primary"
                              title="Editar"
                              onClick={() => handleEditPedido(pedido.id)}
                            >
                              <Pencil size={18} />
                            </button>
                          )}
                          <button
                            className="p-1 hover:bg-accent/50 rounded"
                            title="Histórico"
                            onClick={() => handleOpenHistorico(pedido.id)}
                          >
                            <Clock size={18}/>
                          </button>
                          {(isRH || pedido.responsible_identification == funcionarioSelecionado?.Number) && (
                            <button
                              className="p-1 hover:bg-destructive/10 rounded text-destructive"
                              title="Eliminar"
                              onClick={() => handleDeletePedido(pedido.id)}
                            >
                              <Trash size={18}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rejection Modal */}
        {showRejectionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => { /* Don't close main modal from here */ setShowRejectionModal(false); }}>
            <div 
              className={`p-6 rounded-lg shadow-xl w-full max-w-md ${theme === 'dark' ? 'bg-zinc-800' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Motivo da Rejeição</h3>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Escreva o motivo da rejeição..."
                rows={4}
                className={`w-full p-2 border rounded mb-4 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-white placeholder-zinc-400' : 'border-gray-300 placeholder-gray-500'}`}
              />
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowRejectionModal(false)} 
                  className={`px-4 py-2 rounded ${theme === 'dark' ? 'bg-zinc-600 hover:bg-zinc-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRejectPedido} 
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
                >
                  Rejeitar Pedido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de histórico de alterações */}
        {showHistoricoModal && pedidoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleCloseHistorico}>
            <div
              ref={modalRef}
              className={
                theme === 'dark'
                  ? 'bg-zinc-900 text-zinc-100 rounded-xl shadow-2xl drop-shadow-2xl p-6 max-w-3xl w-full relative max-h-[80vh] flex flex-col'
                  : theme === 'color-blind'
                    ? 'bg-[#fffbe6] text-gray-900 rounded-xl shadow-2xl p-6 max-w-3xl w-full relative max-h-[80vh] flex flex-col'
                    : 'bg-white text-gray-900 rounded-xl shadow-2xl p-6 max-w-3xl w-full relative max-h-[80vh] flex flex-col'
              }
              onClick={e => e.stopPropagation()}
            >
              {/* Cabeçalho do modal de histórico */}
              <div className="flex items-center border-b px-8 py-4 mb-4">
                <img src="/logo_ramos_ferreira.png" alt="Ramos Ferreira" className="h-12 mr-4" style={{objectFit:'contain'}} />
                <div className="flex-1 text-center font-bold text-lg">
                  HISTÓRICO DE ALTERAÇÕES DO PEDIDO
                  {pedidoSelecionado?.id && (
                    <span className="ml-4 text-blue-700 text-base font-mono">Pedido #{pedidoSelecionado?.id}</span>
                  )}
                </div>
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition no-print"
                  onClick={handleCloseHistorico}
                  aria-label="Fechar modal"
                >
                  &times;
                </button>
              </div>
              {/* Tabela de logs */}
              <div className="overflow-y-auto max-h-[60vh]">
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Ação</th>
                      <th className="px-4 py-2">Alterado por</th>
                      <th className="px-4 py-2">Quando</th>
                      <th className="px-4 py-2">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoResumo.map(log => (
                      <tr key={log.id} className={historicoDetalhe?.id === log.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-2">{log.action}</td>
                        <td className="px-4 py-2">{log.changed_by}</td>
                        <td className="px-4 py-2">{new Date(log.changed_at).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <button className="text-blue-600 underline text-xs" onClick={() => handleOpenDetalhe(log)}>
                            Ver detalhe
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Detalhe da alteração */}
                {historicoDetalhe && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h4 className="font-bold mb-2">Detalhe da alteração</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Mostrar apenas campos alterados */}
                      {(() => {
                        const oldData = historicoDetalhe.old_data || {};
                        const newData = historicoDetalhe.new_data || {};
                        const changedFields = Object.keys(newData).filter(key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]));
                        if (changedFields.length === 0) return <div className="col-span-2 text-gray-500">Sem alterações relevantes.</div>;
                        return changedFields.map(key => (
                          <div key={key} className="mb-2">
                            <div className="text-xs font-semibold text-gray-600 mb-1">{labelPT(key)}</div>
                            <div className="flex gap-2 items-center">
                              <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs line-through min-w-[80px]">{oldData[key] === undefined ? '-' : String(oldData[key])}</span>
                              <span className="text-gray-400">→</span>
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs min-w-[80px]">{newData[key] === undefined ? '-' : String(newData[key])}</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <button className="mt-4 text-xs text-blue-600 underline" onClick={() => setHistoricoDetalhe(null)}>Fechar detalhe</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showPedidoModal && pedidoSelecionado && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm" onClick={handleClosePedido}>
            <div
              ref={modalRef}
              className={
                theme === 'dark'
                  ? 'bg-zinc-900 text-zinc-100 rounded-xl shadow-2xl drop-shadow-2xl p-0 max-w-4xl w-full relative max-h-[95vh] flex flex-col'
                  : theme === 'color-blind'
                    ? 'bg-[#fffbe6] text-gray-900 rounded-xl shadow-2xl p-0 max-w-4xl w-full relative max-h-[95vh] flex flex-col'
                    : 'bg-white text-gray-900 rounded-xl shadow-2xl p-0 max-w-4xl w-full relative max-h-[95vh] flex flex-col'
              }
              id="modal-ver-pedido"
              onClick={e => e.stopPropagation()}
            >
              {/* Cabeçalho visível no ecrã */}
              <div className="flex items-center border-b px-8 py-4">
                <img src="/logo_ramos_ferreira.png" alt="Ramos Ferreira" className="h-12 mr-4" style={{objectFit:'contain'}} />
                <div className="flex-1 text-center font-bold text-lg">
                  FICHA DE IDENTIFICAÇÃO DE NECESSIDADE DE RECRUTAMENTO
                  {pedidoSelecionado?.id && (
                    <span className="ml-4 text-blue-700 text-base font-mono">Pedido #{pedidoSelecionado?.id}</span>
                  )}
                </div>
                <div className="text-right text-xs min-w-[100px]">
                  <div>Código: F-RH-15</div>
                  <div>Data: 06/06/2022</div>
                </div>
                {/* Botões de ação */}
                <button onClick={exportModalToPDF} className="ml-4 no-print bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition" title="Exportar para PDF">
                  Exportar para PDF
                </button>
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition no-print"
                  onClick={handleClosePedido}
                  aria-label="Fechar modal"
                >
                  &times;
                </button>
              </div>
              {/* Cabeçalho PDF (primeira página) */}
              <div className="pdf-header" style={{display: 'none'}}>
                <div className="flex items-center border-b px-8 py-4">
                  <img src="/logo_ramos_ferreira.png" alt="Ramos Ferreira" className="h-12 mr-4" style={{objectFit:'contain'}} />
                  <div className="flex-1 text-center font-bold text-lg">
                    FICHA DE IDENTIFICAÇÃO DE NECESSIDADE DE RECRUTAMENTO
                    {pedidoSelecionado?.id && (
                      <span className="ml-4 text-blue-700 text-base font-mono">Pedido #{pedidoSelecionado?.id}</span>
                    )}
                  </div>
                  <div className="text-right text-xs min-w-[100px]">
                    <div>Código: F-RH-15</div>
                    <div>Data: 06/06/2022</div>
                  </div>
                </div>
              </div>
              {/* Corpo do modal: Secções */}
              <div className="overflow-y-auto px-8 py-6 print:p-8 print:overflow-visible">
                {/* Secção: Dados principais */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Função" value={pedidoSelecionado?.function} textClass="pdf-text" />
                    <Field label="Data do pedido de recrutamento" value={pedidoSelecionado?.request_date ? new Date(pedidoSelecionado?.request_date).toLocaleDateString() : ''} textClass="pdf-text" />
                    <Field label="Departamento/Empresa" value={pedidoSelecionado?.department} textClass="pdf-text" />
                    <Field label="Data prevista para admissão" value={pedidoSelecionado?.admission_date ? new Date(pedidoSelecionado?.admission_date).toLocaleDateString() : ''} textClass="pdf-text" />
                    <Field label="Tipologia" value={pedidoSelecionado?.type} textClass="pdf-text" />
                    <Field label="Nº de vagas para preencher" value={pedidoSelecionado?.vacancies} textClass="pdf-text" />
                    <Field label="Justificação do pedido" value={pedidoSelecionado?.justification} textClass="pdf-text" />
                    <Field label="Candidatos pré-identificados" value={pedidoSelecionado?.pre_identified_candidates} textClass="pdf-text" />
                    <Field label="Resp. pela Identificação da Necessidade (RIN)" value={pedidoSelecionado?.responsible_identification} textClass="pdf-text" />
                    <Field label="Recrutamento validado por" value={pedidoSelecionado?.recruitment_validated_by} textClass="pdf-text" />
                    <Field label="Intervenção RH?" value={pedidoSelecionado?.hr_intervention ? 'Sim' : 'Não'} textClass="pdf-text" />
                  </div>
                </section>
                {/* Secção: Responsabilidades e perfil */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="font-semibold mb-1">Responsabilidades e perfil pretendido</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium mb-1">Responsabilidades</div>
                      <div className="border rounded bg-gray-50 p-2 min-h-[80px] whitespace-pre-line pdf-text">{pedidoSelecionado?.responsibilities}</div>
                    </div>
                    <div>
                      <div className="font-medium mb-1">Perfil</div>
                      <div className="border rounded bg-gray-50 p-2 min-h-[80px] whitespace-pre-line pdf-text">{pedidoSelecionado?.profile}</div>
                    </div>
                  </div>
                </section>
                {/* Quebra de página antes de Equipamentos */}
                <div className="pdf-page-break"></div>
                {/* Cabeçalho PDF (segunda página) */}
                <div className="pdf-header" style={{display: 'none'}}>
                  <div className="flex items-center border-b px-8 py-4">
                    <img src="/logo_ramos_ferreira.png" alt="Ramos Ferreira" className="h-12 mr-4" style={{objectFit:'contain'}} />
                    <div className="flex-1 text-center font-bold text-lg">
                      FICHA DE IDENTIFICAÇÃO DE NECESSIDADE DE RECRUTAMENTO
                      {pedidoSelecionado?.id && (
                        <span className="ml-4 text-blue-700 text-base font-mono">Pedido #{pedidoSelecionado?.id}</span>
                      )}
                    </div>
                    <div className="text-right text-xs min-w-[100px]">
                      <div>Código: F-RH-15</div>
                      <div>Data: 06/06/2022</div>
                    </div>
                  </div>
                </div>
                {/* Secção: Condições a oferecer */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="font-semibold mb-1">Condições a oferecer ao candidato selecionado</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Contrato" value={pedidoSelecionado?.contract} textClass="pdf-text" />
                    <Field label="Duração" value={pedidoSelecionado?.duration} textClass="pdf-text" />
                    <Field label="Geografia do contrato" value={pedidoSelecionado?.contract_geography} textClass="pdf-text" />
                    <Field label="Valor do salário (fixa)" value={pedidoSelecionado?.salary} textClass="pdf-text" />
                    <Field label="Tipologia do Prémio" value={pedidoSelecionado?.premium_type} textClass="pdf-text" />
                    <Field label="Valor do prémio" value={pedidoSelecionado?.premium_value} textClass="pdf-text" />
                    <Field label="Refeições" value={pedidoSelecionado?.meals} textClass="pdf-text" />
                    <Field label="Cartão-Plafond" value={pedidoSelecionado?.card_plafond} textClass="pdf-text" />
                    <Field label="Seguro de Saúde" value={pedidoSelecionado?.health_insurance} textClass="pdf-text" />
                  </div>
                </section>
                {/* Secção: Equipamentos e vestuário */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="font-semibold mb-1">Equipamentos e vestuário</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CheckboxField label="Telemóvel" checked={pedidoSelecionado?.mobile} />
                    <CheckboxField label="Solicitar novo n.º" checked={pedidoSelecionado?.new_mobile} />
                    <CheckboxField label="Viatura" checked={pedidoSelecionado?.car} />
                    <CheckboxField label="Portátil" checked={pedidoSelecionado?.laptop} />
                    <CheckboxField label="Cartão de Visita" checked={pedidoSelecionado?.visit_card} />
                    <Field label="Função a constar no cartão" value={pedidoSelecionado?.card_function} textClass="pdf-text" />
                    <CheckboxField label="EPI's" checked={pedidoSelecionado?.epi} />
                    <CheckboxField label="Vestuário de Trabalho" checked={pedidoSelecionado?.work_clothes} />
                    <Field label="Outro(s)" value={pedidoSelecionado?.other_equipment} textClass="pdf-text" />
                  </div>
                </section>
                {/* Secção: Expatriação */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="font-semibold mb-1">Condições de expatriação</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="País" value={pedidoSelecionado?.expatriation_country} textClass="" />
                    <Field label="N.º viagens/ano" value={pedidoSelecionado?.annual_trips} textClass="" />
                    <Field label="Habitação local" value={pedidoSelecionado?.local_housing} textClass="" />
                    <Field label="Transporte local" value={pedidoSelecionado?.local_transport} textClass="" />
                    <Field label="Refeições" value={pedidoSelecionado?.expatriation_meals} textClass="" />
                    <Field label="Ajuda semanal" value={pedidoSelecionado?.weekly_aid} textClass="" />
                    <Field label="Valor ajuda semanal" value={pedidoSelecionado?.weekly_aid_value} textClass="" />
                  </div>
                </section>
                {/* Observações */}
                <section className="pdf-section mb-4 border-b pb-2 print:border-b-2 print:pb-2">
                  <div className="font-semibold mb-1">OBS:</div>
                  <div className="border rounded bg-gray-50 p-2 min-h-[60px] whitespace-pre-line pdf-text">{pedidoSelecionado?.obs}</div>
                </section>
                {/* Estado */}
                <section className="pdf-section mb-4">
                  <div className="font-semibold mb-1">Estado do Pedido</div>
                  <div>{pedidoSelecionado?.estado}</div>
                </section>
              </div>
              {/* Rodapé PDF (segunda página) */}
              <div className="pdf-footer" style={{display: 'none'}}>
                <footer className="w-full border-t px-8 py-2 text-xs flex flex-col md:flex-row justify-between items-center bg-white">
                  <span>GRUPO RAMOS FERREIRA // EMBRACE THE FUTURE</span>
                  <span className="text-right">
                    Última edição por: {pedidoLog?.changed_by || pedidoSelecionado?.created_by || '-'} em {pedidoLog?.changed_at ? new Date(pedidoLog?.changed_at).toLocaleString() : (pedidoSelecionado?.created_at ? new Date(pedidoSelecionado?.created_at).toLocaleString() : '-')}
                    <br />
                    Impresso por: {printAudit?.user || userName} em {printAudit?.date ? printAudit.date.toLocaleString() : new Date().toLocaleString()}
                  </span>
                </footer>
              </div>
              {/* Rodapé */}
              <footer className="w-full border-t px-8 py-4 flex justify-between items-center bg-card print:hidden">
                <div className="text-xs text-muted-foreground">
                  <span>GRUPO RAMOS FERREIRA // EMBRACE THE FUTURE</span>
                  <br />
                  <span className="text-xs">
                    Última edição por: {pedidoLog?.changed_by || pedidoSelecionado?.created_by || '-'} em {pedidoLog?.changed_at ? new Date(pedidoLog?.changed_at).toLocaleString() : (pedidoSelecionado?.created_at ? new Date(pedidoSelecionado?.created_at).toLocaleString() : '-')}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {isRH && pedidoSelecionado?.estado === 'Pendente' && (
                    <>
                      <button 
                        onClick={() => openRejectionModal(pedidoSelecionado.id)}
                        className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white flex items-center">
                        <XCircle size={18} className="mr-2"/> Rejeitar Pedido
                      </button>
                      <button 
                        onClick={() => handleApprovePedido(pedidoSelecionado.id)}
                        className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white flex items-center">
                        <CheckCircle2 size={18} className="mr-2"/> Aprovar Pedido
                      </button>
                    </>
                  )}
                  <button 
                    onClick={handleClosePedido} 
                    className={`px-4 py-2 rounded ${theme === 'dark' ? 'bg-zinc-600 hover:bg-zinc-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`}
                  >
                    Fechar
                  </button>
                </div>
              </footer>
              {/* Footer for PDF (hidden on screen) */}
              <div className="pdf-footer" style={{display: 'none'}}>
                 {/* ... PDF footer content ... */} 
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Componentes auxiliares para campos e checkboxes
function Field({ label, value, textClass }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-600 font-medium mb-1">{label}</span>
      <span className={`border rounded bg-white px-2 py-1 min-h-[32px] print:bg-white print:border-gray-300 ${textClass || ''}`}>{value || '-'}</span>
    </div>
  );
}
function CheckboxField({ label, checked }) {
  return (
    <div className="flex items-center space-x-2">
      <input type="checkbox" checked={checked} readOnly className="accent-blue-600 w-4 h-4" />
      <span className="text-xs">{label}</span>
    </div>
  );
} 