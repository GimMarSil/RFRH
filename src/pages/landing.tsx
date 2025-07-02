import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { gsap } from 'gsap';
import { Back } from 'gsap/all';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useFuncionario } from "../context/FuncionarioContext"; // Adjust path if needed
import { useRouter } from "next/router";
import Link from 'next/link'; // Added Link import
import { useSelectedEmployee } from '@/contexts/SelectedEmployeeContext'; // Added

gsap.registerPlugin(Back);

// Helper function to get initials (from dashboard.tsx)
function getInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const modules = [
  { name: 'Dossiers de Colaboradores', description: 'Dados, ausências, funções', icon: '📁', path: '#' }, // Example placeholder path
  { name: 'Candidaturas e Vagas', description: 'Vagas, triagem, entrevistas', icon: '📄', path: '/recruitmentdashboard' },
  { name: 'Integração de Novos Colaboradores', description: 'Checklists, feedback', icon: '🚀', path: '#' },
  { name: 'Formação & Certificação', description: 'Planos, necessidades, certificados', icon: '🎓', path: '#' },
  { name: 'Desempenho & Feedback', description: 'Avaliações periódicas, autoavaliações', icon: '📊', path: '/evaluation' },
  { name: 'Clima & Saída de Colaboradores', description: 'Satisfação, saída', icon: '😊', path: '#' },
  { name: 'Promoções e Transferências', description: 'Mobilidade interna', icon: '🧭', path: '#' },
  { name: 'Estágios', description: 'Plano, acompanhamento e avaliação', icon: '🎓', path: '#' }, // Note: same icon as Formação
  { name: 'Indicadores RH', description: 'Dashboards e relatórios', icon: '📈', path: '#' },
  { name: 'Administração e Permissões', description: 'Perfis, permissões, templates, integrações', icon: '🔐', path: '#' },
];

const LandingPage: React.FC = () => {
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);

  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { funcionarioSelecionado, setFuncionarioSelecionado } = useFuncionario();
  const router = useRouter();
  const { setSelectedEmployeeId, setSystemUserId, setEmployeeProfileName, setIsManagerRole } = useSelectedEmployee(); // Added

  const [funcionarios, setFuncionarios] = useState<any[]>([]); // Define type for funcionario if available
  const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
  const [errorFuncionarios, setErrorFuncionarios] = useState(null);
  const [theme, setTheme] = useState('light');
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const userName = accounts?.[0]?.name || 'Utilizador';

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: '🌞' },
    { value: 'dark', label: 'Escuro', icon: '🌙' },
    { value: 'color-blind', label: 'Daltónico', icon: '👁️' },
  ];
  const currentTheme = themeOptions.find(opt => opt.value === theme) || themeOptions[0];

  useEffect(() => {
    setHydrated(true);
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);
    document.documentElement.classList.remove('light', 'dark', 'color-blind'); // Clear any existing
    document.documentElement.classList.add(storedTheme);
  }, []);

  useEffect(() => {
    const fetchFuncionarios = async () => {
      if (!isAuthenticated || !accounts[0]) {
        setLoadingFuncionarios(false);
        return;
      }
      setLoadingFuncionarios(true);
      setErrorFuncionarios(null);
      try {
        const azureUserId = accounts[0]?.username;
        if (!azureUserId) {
          console.warn("Azure AD User ID not available for employee fetching.");
          setFuncionarios([]);
          setLoadingFuncionarios(false);
          return;
        }
        const response = await fetch(`/api/employee?userId=${azureUserId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || 'Erro ao buscar funcionários');
        }
        const data = await response.json();
        const ativos = data.filter(f => f.Active);
        setFuncionarios(ativos);
        if (!funcionarioSelecionado && ativos.length === 1) {
          setFuncionarioSelecionado(ativos[0]);
        } else if (funcionarioSelecionado) {
          const foundInList = ativos.some(f => f.Number === funcionarioSelecionado.Number);
          if (!foundInList && ativos.length > 0) {
            setFuncionarioSelecionado(ativos[0]);
          } else if (!foundInList) {
            setFuncionarioSelecionado(null);
          }
        }
      } catch (err) {
        setErrorFuncionarios(err.message);
        setFuncionarios([]);
      } finally {
        setLoadingFuncionarios(false);
      }
    };
    if (isAuthenticated) fetchFuncionarios(); // Fetch only if authenticated
  }, [isAuthenticated, accounts, funcionarioSelecionado, setFuncionarioSelecionado]);

  // Effect to update SelectedEmployeeContext when FuncionarioContext changes
  useEffect(() => {
    if (funcionarioSelecionado && typeof funcionarioSelecionado.employee_number === 'number') {
      const employeeIdStr = funcionarioSelecionado.employee_number.toString();
      console.log(`[LandingPage] FuncionarioSelecionado valid, updating SelectedEmployeeContext with ID: ${employeeIdStr}`, funcionarioSelecionado);
      setSelectedEmployeeId(employeeIdStr);
      setEmployeeProfileName(funcionarioSelecionado.Name);
      
      const msalUser = accounts?.[0];
      if (msalUser) {
        setSystemUserId(msalUser.localAccountId || msalUser.homeAccountId || null); 
      } else {
        setSystemUserId(null);
      }
    } else if (funcionarioSelecionado) {
      // Log se funcionarioSelecionado existe mas employee_number não é válido
      console.warn('[LandingPage] FuncionarioSelecionado exists but employee_number is invalid:', funcionarioSelecionado);
      setSelectedEmployeeId(null); // Garante que fica nulo se o ID não for válido
      setEmployeeProfileName(null);
      setIsManagerRole(false);
    } else {
      console.log('[LandingPage] FuncionarioSelecionado deselected, clearing parts of SelectedEmployeeContext.');
      setSelectedEmployeeId(null);
      setEmployeeProfileName(null);
      setIsManagerRole(false);
    }
  }, [funcionarioSelecionado, setSelectedEmployeeId, setEmployeeProfileName, setSystemUserId, setIsManagerRole, accounts]);

  function handleThemeDropdown(themeValue) {
    setTheme(themeValue);
    localStorage.setItem('theme', themeValue);
    document.documentElement.classList.remove('light', 'dark', 'color-blind');
    document.documentElement.classList.add(themeValue);
    setShowThemeDropdown(false);
  }

  const handleSelectFuncionario = (e) => {
    const selectedIndex = e.target.value;
    if (selectedIndex === "") {
      setFuncionarioSelecionado(null);
    } else {
      setFuncionarioSelecionado(funcionarios[selectedIndex]);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && hydrated) { // Ensure hydrated before running GSAP logic
      cardsRef.current.forEach((card) => {
        if (!card) return;
        gsap.killTweensOf(card); // Kill existing tweens before reapplying
        const tl = gsap.timeline({ paused: true });
        tl.to(card, { scale: 1.05, y: -5, duration: 0.2, ease: 'power1.out' });
        card.addEventListener('mouseenter', () => tl.play());
        card.addEventListener('mouseleave', () => tl.reverse());
        card.addEventListener('mousemove', (e: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          const rotateX = (y / rect.height) * -15; // Slightly reduced rotation
          const rotateY = (x / rect.width) * 15;   // Slightly reduced rotation
          gsap.to(card, {
            rotationX: rotateX,
            rotationY: rotateY,
            transformPerspective: 700, // Slightly increased perspective
            ease: 'power1.out',
            duration: 0.3,
          });
        });
        card.addEventListener('mouseleave', () => {
          gsap.to(card, {
            rotationX: 0,
            rotationY: 0,
            ease: Back.easeOut.config(1.7),
            duration: 0.7,
          });
        });
      });
      return () => {
        cardsRef.current.forEach((card) => {
          if (card) {
            gsap.killTweensOf(card);
            // Consider removing event listeners here if they are not automatically handled by GSAP or React unmount
          }
        });
      };
    }
  }, [hydrated, theme]); // Re-run GSAP if hydrated or theme changes (for re-styling)

  useEffect(() => {
    document.body.className = '';
    const mainElement = document.querySelector('main');
    
    if (theme === 'dark') {
      document.body.classList.add('bg-zinc-900');
      if (mainElement) mainElement.className = 'min-h-screen flex flex-col items-center justify-start p-4 sm:p-8 pt-20 bg-zinc-900 text-gray-100';
    } else if (theme === 'color-blind') {
      document.body.classList.add('bg-amber-50');
      if (mainElement) mainElement.className = 'min-h-screen flex flex-col items-center justify-start p-4 sm:p-8 pt-20 bg-amber-50 text-gray-900';
    } else {
      document.body.classList.add('bg-gray-100');
      if (mainElement) mainElement.className = 'min-h-screen flex flex-col items-center justify-start p-4 sm:p-8 pt-20 bg-gray-100 text-gray-800';
    }
    
    return () => {
      document.body.className = '';
      if (mainElement) mainElement.className = '';
    };
  }, [theme]);

  return (
    <>
      <Head>
        <title>Portal RH - Bem-vindo</title>
        <meta name="description" content="Bem-vindo ao Portal RH" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={`shadow sticky top-0 z-50 ${theme === 'dark' ? 'bg-zinc-800 text-gray-100' : theme === 'color-blind' ? 'bg-amber-100 text-gray-900' : 'bg-white text-gray-800'}`}>
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 mr-2 sm:mr-3">
              <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10C27.909 10 10 27.909 10 50C10 72.091 27.909 90 50 90C72.091 90 90 72.091 90 50C90 27.909 72.091 10 50 10Z" fill="#933037" />
                <path d="M65 35C65 43.284 58.284 50 50 50C41.716 50 35 43.284 35 35C35 26.716 41.716 20 50 20C58.284 20 65 26.716 65 35Z" fill="white" />
                <path d="M30 70C30 59.402 38.85 50 50 50C61.15 50 70 59.402 70 70" stroke="white" strokeWidth="8" />
              </svg>
            </div>
            <h1 className={`text-lg sm:text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Portal RH</h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className={`rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm ${theme === 'dark' ? 'bg-zinc-700 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>
              {hydrated ? getInitials(userName) : ""}
            </div>
            {loadingFuncionarios ? (
              <span className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>A carregar...</span>
            ) : errorFuncionarios ? (
              <span className="text-red-500 text-xs sm:text-sm">Erro</span>
            ) : (
              <select
                className={`text-xs sm:text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-zinc-700 border-zinc-600 text-gray-200' : 'bg-white border-gray-300 text-gray-700'}`}
                value={funcionarioSelecionado ? funcionarios.findIndex(f => f.employee_number === funcionarioSelecionado.employee_number) : ""}
                onChange={handleSelectFuncionario}
                disabled={funcionarios.length === 0}
              >
                <option value="">-- Selecionar --</option>
                {funcionarios.map((f, idx) => (
                  <option key={f.employee_number || idx} value={idx}>
                    {f.Name} ({f.CompanyName})
                  </option>
                ))}
              </select>
            )}
            <div className="relative">
              <button
                className={`flex items-center px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 ${theme === 'dark' ? 'bg-zinc-700 hover:bg-zinc-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                onClick={() => setShowThemeDropdown(v => !v)}
                type="button"
                aria-label="Selecionar tema"
              >
                <span className="mr-1 text-sm sm:text-base">{currentTheme.icon}</span>
                <span className="hidden sm:inline text-xs sm:text-sm">{currentTheme.label}</span>
                <svg className="ml-1 w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showThemeDropdown && (
                <div className={`absolute right-0 mt-2 w-36 border rounded shadow-lg z-50 ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-gray-200'}`}>
                  {themeOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`w-full flex items-center px-3 py-2 text-left text-xs sm:text-sm ${theme === 'dark' ? 'hover:bg-zinc-700 text-gray-200' : 'hover:bg-gray-100 text-gray-800'} ${theme === opt.value ? (theme === 'dark' ? 'font-bold text-blue-400' : 'font-bold text-blue-600') : ''}`}
                      onClick={() => handleThemeDropdown(opt.value)}
                      type="button"
                    >
                      <span className="mr-2 text-sm sm:text-base">{opt.icon}</span> {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main> {/* className is now set by useEffect based on theme */}
        <div ref={cardsContainerRef} className="text-center mb-10 sm:mb-12">
          {/* <h1 className={`text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
            Módulos do Portal RH
          </h1> */}
          <p className={`text-md sm:text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            {funcionarioSelecionado ? `Bem-vindo(a), ${funcionarioSelecionado.Name}.` : "Bem-vindo(a)!"} Selecione um módulo para começar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 sm:gap-6 w-full max-w-screen-2xl px-2">
          {modules.map((module, index) => {
            const cardContent = (
              <div
                ref={(el) => {
                  if (el) cardsRef.current[index] = el;
                }}
                className={`h-64 p-5 sm:p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col items-center justify-center text-center ${module.path && module.path !== '#' ? 'cursor-pointer' : 'cursor-default'} ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-white hover:bg-gray-50'}`}
                style={{ willChange: 'transform' }}
              >
                <div className={`text-4xl sm:text-5xl mb-3 sm:mb-4 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{module.icon}</div>
                <h2 className={`text-lg sm:text-xl font-semibold mb-1 sm:mb-2 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-700'}`}>{module.name}</h2>
                <p className={`text-xs sm:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{module.description}</p>
              </div>
            );

            if (module.path && module.path !== '#') {
              return (
                <Link key={module.name} href={module.path} passHref legacyBehavior>
                  <a className="block no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-xl">
                    {cardContent}
                  </a>
                </Link>
              );
            }
            return (
              <div key={module.name}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
};

export default LandingPage; 