"use client"

import { useState, useEffect, useRef } from "react"
import { useMsal, useIsAuthenticated } from "@azure/msal-react" // Import useIsAuthenticated
import gsap from "gsap"
import { useRouter } from "next/router"; // Import useRouter
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Building2,
  Settings,
  Database,
  FileText,
  Bell,
  Globe,
  Shield,
  Workflow,
  PlusCircle,
  Trash2,
  Edit,
  Save,
  RefreshCw,
  Upload,
  Download,
  ArrowLeft, // Import ArrowLeft icon
  Power, // Import Power icon for activate/inactivate
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { toast } from "react-hot-toast"; // Not used in dashboard, can be removed if not used elsewhere

// Função utilitária para obter as iniciais (primeira e última palavra)
function getInitials(name: string | undefined) {
  if (!name) return "";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "Ativo" | "Inativo";
  avatarFallback: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("organization")
  const [managedUsers, setManagedUsers] = useState<User[]>([]);

  const containerRef = useRef(null);
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated(); // Get authentication status
  const userName = accounts?.[0]?.name || 'Utilizador';
  const router = useRouter(); // Initialize router

  // Garantir que só renderiza as iniciais no cliente
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Fetch logged-in user and add to managedUsers
  useEffect(() => {
    if (isAuthenticated && accounts && accounts.length > 0) {
      const currentUserAccount = accounts[0];
      const loggedInUser: User = {
        id: currentUserAccount.localAccountId || currentUserAccount.homeAccountId || "unknown-id",
        name: currentUserAccount.name || "Utilizador Desconhecido",
        email: currentUserAccount.username, // Usually the email
        role: "Desconhecido", // Placeholder
        department: "Desconhecido", // Placeholder
        status: "Ativo",
        avatarFallback: getInitials(currentUserAccount.name),
      };
      // Set the logged-in user as the only user in the list for now
      // Or, if you intend to add more users from another source later, you might use:
      // setManagedUsers(prevUsers => [...prevUsers, loggedInUser]);
      // For now, let's just display the current logged-in user.
      setManagedUsers([loggedInUser]);
    }
  }, [isAuthenticated, accounts]); // Rerun when authentication status or accounts change

  // Temas para dropdown
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
    localStorage.setItem('theme', themeValue); // Save theme to localStorage
    setShowThemeDropdown(false);
  }

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.remove('light', 'dark', 'color-blind');
    document.documentElement.classList.add(savedTheme);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );
    }
  }, []);

  const handleToggleUserStatus = (userId: string) => {
    setManagedUsers(prevUsers =>
      prevUsers.map(user =>
        user.id === userId
          ? { ...user, status: user.status === "Ativo" ? "Inativo" : "Ativo" }
          : user
      )
    );
    // In a real application, you would also make an API call here
    // to update the user status in your backend or Azure AD.
    // For example: await api.updateUserStatus(userId, newStatus);
    // toast.success(`Estado do utilizador alterado com sucesso!`); // If using toast notifications
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background text-foreground">
      <header className="bg-card shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-12 h-12 mr-3">
              {/* Logo SVG from dashboard.tsx */}
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
              {/* Theme Selector */}
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4"> {/* Adjusted mb from 8 to 4 */}
          <h2 className="text-2xl font-bold text-foreground mb-2 sm:mb-0">Configurações</h2> {/* Adjusted mb from 4 to 2 */}
          <Button variant="outline" onClick={() => router.push('/recruitmentdashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
        <p className="text-muted-foreground mb-6"> {/* Added mb-6 for spacing before tabs */}
          Faça a gestão de todas as configurações do sistema HRMS.
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="organization" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Organização</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Utilizadores</span>
              </TabsTrigger>
              <TabsTrigger value="workflows" className="flex items-center gap-2">
                <Workflow className="h-4 w-4" />
                <span>Fluxos de Trabalho</span>
              </TabsTrigger>
              <TabsTrigger value="forms" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Formulários</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Notificações</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Integrações</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Segurança</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Dados</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Sistema</span>
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          {/* Organization Settings */}
          <TabsContent value="organization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Empresa</CardTitle>
                <CardDescription>Configure as informações base da sua organização.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="company-name">Nome da Empresa</label>
                    <Input id="company-name" defaultValue="Grupo Ramos Ferreira" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="tax-id">Número de Identificação Fiscal (NIF)</label>
                    <Input id="tax-id" defaultValue="123456789" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="address">Morada</label>
                    <Input id="address" defaultValue="Rua Principal, 123" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="city">Cidade</label>
                    <Input id="city" defaultValue="Porto" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="country">País</label>
                    <Select defaultValue="pt">
                      <SelectTrigger id="country">
                        <SelectValue placeholder="Selecione um país" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Portugal</SelectItem>
                        <SelectItem value="br">Brasil</SelectItem>
                        <SelectItem value="ao">Angola</SelectItem>
                        <SelectItem value="mz">Moçambique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone">Telefone</label>
                    <Input id="phone" defaultValue="+351 123 456 789" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="logo">Logótipo da Empresa</label>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src="/placeholder.svg?height=80&width=80" alt="Logótipo" />
                      <AvatarFallback>RF</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Carregar Logótipo
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estrutura Organizacional</CardTitle>
                <CardDescription>Faça a gestão de departamentos, cargos e localizações da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="departments">
                    <AccordionTrigger>Departamentos</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Departamento
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Código</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Tecnologias de Informação</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>João Silva</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Recursos Humanos</TableCell>
                                <TableCell>RH</TableCell>
                                <TableCell>Maria Oliveira</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Financeiro</TableCell>
                                <TableCell>FIN</TableCell>
                                <TableCell>Carlos Mendes</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Engenharia</TableCell>
                                <TableCell>ENG</TableCell>
                                <TableCell>Pedro Santos</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Comercial</TableCell>
                                <TableCell>COM</TableCell>
                                <TableCell>Ana Costa</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="positions">
                    <AccordionTrigger>Cargos</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Cargo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Título</TableHead>
                                <TableHead>Departamento</TableHead>
                                <TableHead>Nível</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Engenheiro de Software</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>Sênior</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Analista de RH</TableCell>
                                <TableCell>RH</TableCell>
                                <TableCell>Pleno</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Gestor Financeiro</TableCell>
                                <TableCell>FIN</TableCell>
                                <TableCell>Gerência</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="locations">
                    <AccordionTrigger>Localizações</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Localização
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Morada</TableHead>
                                <TableHead>País</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Sede Porto</TableCell>
                                <TableCell>Rua Principal, 123, Porto</TableCell>
                                <TableCell>Portugal</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Escritório Lisboa</TableCell>
                                <TableCell>Av. da Liberdade, 456, Lisboa</TableCell>
                                <TableCell>Portugal</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Filial Luanda</TableCell>
                                <TableCell>Rua Angola, 789, Luanda</TableCell>
                                <TableCell>Angola</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Settings */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Utilizadores</CardTitle>
                <CardDescription>
                  Visualize e gira o estado dos utilizadores do sistema autenticados via Azure Entra ID.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* "Novo Utilizador" button removed as per requirement */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={`/placeholder.svg?height=32&width=32&text=${user.avatarFallback}`} alt="Avatar" />
                                <AvatarFallback>{user.avatarFallback}</AvatarFallback>
                              </Avatar>
                              <span>{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>{user.department}</TableCell>
                          <TableCell>
                            <Badge
                              variant={user.status === "Ativo" ? "default" : "destructive"}
                              className={user.status === "Ativo"
                                ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"}
                            >
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleToggleUserStatus(user.id)} title={user.status === "Ativo" ? "Inativar Utilizador" : "Ativar Utilizador"}>
                                <Power className={`h-4 w-4 ${user.status === "Ativo" ? 'text-red-500' : 'text-green-500'}`} />
                              </Button>
                              {/* Trash2 button removed */}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Perfis e Permissões</CardTitle>
                <CardDescription>Configure os perfis de acesso e as permissões do sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo Perfil
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome do Perfil</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Nº Utilizadores</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Administrador</TableCell>
                        <TableCell>Acesso total a todas as funcionalidades do sistema.</TableCell>
                        <TableCell>2</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Gestor de RH</TableCell>
                        <TableCell>Acesso a todas as funcionalidades de RH.</TableCell>
                        <TableCell>3</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Gestor</TableCell>
                        <TableCell>Acesso para criar e acompanhar pedidos de recrutamento.</TableCell>
                        <TableCell>8</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Aprovador</TableCell>
                        <TableCell>Acesso para aprovar pedidos e mobilidades.</TableCell>
                        <TableCell>5</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Visualizador</TableCell>
                        <TableCell>Acesso de apenas leitura.</TableCell>
                        <TableCell>12</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflows Settings */}
          <TabsContent value="workflows" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fluxos de Aprovação</CardTitle>
                <CardDescription>Configure os fluxos de aprovação para os diferentes processos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="recruitment">
                    <AccordionTrigger>Fluxo de Recrutamento</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Etapas de Aprovação</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Etapa
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Etapa</TableHead>
                                <TableHead>Aprovador</TableHead>
                                <TableHead>Condição</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>Aprovação do Gestor</TableCell>
                                <TableCell>Gestor do Departamento</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2</TableCell>
                                <TableCell>Aprovação do Diretor</TableCell>
                                <TableCell>Diretor da Área</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>3</TableCell>
                                <TableCell>Aprovação Financeira</TableCell>
                                <TableCell>Diretor Financeiro</TableCell>
                                <TableCell>Se não orçamentada</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>4</TableCell>
                                <TableCell>Aprovação RH</TableCell>
                                <TableCell>Diretor de RH</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                        <div className="flex items-center space-x-2 mt-4">
                          <Switch id="recruitment-parallel" />
                          <label htmlFor="recruitment-parallel">Permitir aprovações em paralelo</label>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="mobility">
                    <AccordionTrigger>Fluxo de Mobilidade</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Etapas de Aprovação</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Etapa
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Etapa</TableHead>
                                <TableHead>Aprovador</TableHead>
                                <TableHead>Condição</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>Aprovação do Gestor de Origem</TableCell>
                                <TableCell>Gestor do Departamento de Origem</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2</TableCell>
                                <TableCell>Aprovação do Gestor de Destino</TableCell>
                                <TableCell>Gestor do Departamento de Destino</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>3</TableCell>
                                <TableCell>Aprovação Financeira</TableCell>
                                <TableCell>Diretor Financeiro</TableCell>
                                <TableCell>Se aumento salarial &gt; 10%</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>4</TableCell>
                                <TableCell>Aprovação RH</TableCell>
                                <TableCell>Diretor de RH</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="termination">
                    <AccordionTrigger>Fluxo de Rescisão</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Etapas de Aprovação</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Etapa
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Etapa</TableHead>
                                <TableHead>Aprovador</TableHead>
                                <TableHead>Condição</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>1</TableCell>
                                <TableCell>Aprovação do Gestor</TableCell>
                                <TableCell>Gestor do Departamento</TableCell>
                                <TableCell>Se iniciado pela empresa</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>2</TableCell>
                                <TableCell>Aprovação Jurídica</TableCell>
                                <TableCell>Departamento Jurídico</TableCell>
                                <TableCell>Se iniciado pela empresa</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>3</TableCell>
                                <TableCell>Aprovação RH</TableCell>
                                <TableCell>Diretor de RH</TableCell>
                                <TableCell>Sempre</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tarefas Automáticas</CardTitle>
                <CardDescription>
                  Configure tarefas que são executadas automaticamente em cada etapa do processo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="onboarding">
                    <AccordionTrigger>Tarefas de Integração (Onboarding)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Lista de Tarefas</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Tarefa
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tarefa</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Criar conta de e-mail</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>3 dias antes do início</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Preparar equipamento</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>2 dias antes do início</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Agendar formação de integração</TableCell>
                                <TableCell>RH</TableCell>
                                <TableCell>1 semana após o início</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="offboarding">
                    <AccordionTrigger>Tarefas de Desvinculação (Offboarding)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Lista de Tarefas</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Tarefa
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tarefa</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead>Prazo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Desativar contas de sistema</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>No último dia</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Recolher equipamentos</TableCell>
                                <TableCell>TI</TableCell>
                                <TableCell>No último dia</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Realizar entrevista de desvinculação</TableCell>
                                <TableCell>RH</TableCell>
                                <TableCell>Até 3 dias após a saída</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forms Settings */}
          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Formulários do Sistema</CardTitle>
                <CardDescription>Personalize os formulários utilizados nos processos de RH.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="recruitment-form">
                    <AccordionTrigger>Formulário de Recrutamento (F-RH-15)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Campos do Formulário</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Campo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome do Campo</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Obrigatório</TableHead>
                                <TableHead>Ordem</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Função/Cargo</TableCell>
                                <TableCell>Texto</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>1</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Departamento/Empresa</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>2</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Tipologia de Recrutamento</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>3</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Nº de vagas para preencher</TableCell>
                                <TableCell>Número</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>4</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Justificação do pedido</TableCell>
                                <TableCell>Área de texto</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>5</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="candidate-form">
                    <AccordionTrigger>Formulário de Seleção de Candidato (F-RH-16)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Campos do Formulário</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Campo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome do Campo</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Obrigatório</TableHead>
                                <TableHead>Ordem</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Candidato Selecionado</TableCell>
                                <TableCell>Texto</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>1</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Justificação da admissão</TableCell>
                                <TableCell>Área de texto</TableCell>
                                <TableCell>Não</TableCell>
                                <TableCell>2</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Data de admissão</TableCell>
                                <TableCell>Data</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>3</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Tipo de Contrato</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>4</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Valor do salário</TableCell>
                                <TableCell>Número</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>5</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="mobility-form">
                    <AccordionTrigger>Formulário de Mobilidade (F-RH-26)</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Campos do Formulário</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Adicionar Campo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome do Campo</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Obrigatório</TableHead>
                                <TableHead>Ordem</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Nome do Colaborador</TableCell>
                                <TableCell>Texto</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>1</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Geografia de Origem</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>2</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Geografia de Destino</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>3</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Tipo de Mobilidade</TableCell>
                                <TableCell>Seleção</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>4</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Justificação da mobilidade</TableCell>
                                <TableCell>Área de texto</TableCell>
                                <TableCell>Sim</TableCell>
                                <TableCell>5</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modelos de Documentos</CardTitle>
                <CardDescription>Faça a gestão dos modelos de documentos gerados pelo sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Novo Modelo
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome do Modelo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Última Atualização</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Contrato de Trabalho</TableCell>
                        <TableCell>Admissão</TableCell>
                        <TableCell>10/05/2025</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Carta de Oferta</TableCell>
                        <TableCell>Admissão</TableCell>
                        <TableCell>08/05/2025</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Acordo de Mobilidade</TableCell>
                        <TableCell>Mobilidade</TableCell>
                        <TableCell>05/05/2025</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Carta de Rescisão</TableCell>
                        <TableCell>Rescisão</TableCell>
                        <TableCell>01/05/2025</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ativo
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de E-mail</CardTitle>
                <CardDescription>Configure as notificações por e-mail enviadas pelo sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="smtp-server">Servidor SMTP</label>
                    <Input id="smtp-server" defaultValue="smtp.empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="smtp-port">Porta</label>
                    <Input id="smtp-port" defaultValue="587" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="smtp-username">Utilizador</label>
                    <Input id="smtp-username" defaultValue="notificacoes@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="smtp-password">Palavra-passe</label>
                    <Input id="smtp-password" type="password" defaultValue="********" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email-from">E-mail de Origem</label>
                    <Input id="email-from" defaultValue="rh@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email-name">Nome de Exibição</label>
                    <Input id="email-name" defaultValue="Recursos Humanos" />
                  </div>
                </div>
                <div className="flex items-center space-x-2 mt-4">
                  <Button variant="outline">Testar Ligação</Button>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Modelos de Notificação</CardTitle>
                <CardDescription>Personalize os modelos de e-mail enviados pelo sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="recruitment-notifications">
                    <AccordionTrigger>Notificações de Recrutamento</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Modelos de E-mail</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Novo Modelo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Assunto</TableHead>
                                <TableHead>Evento</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Pedido Criado</TableCell>
                                <TableCell>Novo Pedido de Recrutamento #{'{ID}'}</TableCell>
                                <TableCell>Criação de Pedido</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Pedido Aprovado</TableCell>
                                <TableCell>Pedido de Recrutamento #{'{ID}'} Aprovado</TableCell>
                                <TableCell>Aprovação de Pedido</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Pedido Rejeitado</TableCell>
                                <TableCell>Pedido de Recrutamento #{'{ID}'} Rejeitado</TableCell>
                                <TableCell>Rejeição de Pedido</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="mobility-notifications">
                    <AccordionTrigger>Notificações de Mobilidade</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Modelos de E-mail</h4>
                          <Button size="sm">
                            <PlusCircle className="h-4 w-4 mr-2" />
                            Novo Modelo
                          </Button>
                        </div>
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Assunto</TableHead>
                                <TableHead>Evento</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>Mobilidade Iniciada</TableCell>
                                <TableCell>Nova Solicitação de Mobilidade #{'{ID}'}</TableCell>
                                <TableCell>Criação de Mobilidade</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Mobilidade Aprovada</TableCell>
                                <TableCell>Mobilidade #{'{ID}'} Aprovada</TableCell>
                                <TableCell>Aprovação de Mobilidade</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Ativo
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>Configure que eventos geram notificações e para quem.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Evento</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Notificação no Sistema</TableHead>
                          <TableHead>Destinatários</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Novo Pedido de Recrutamento</TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>Aprovadores, RH</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Pedido Aprovado/Rejeitado</TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>Requisitante, RH</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Novo Candidato</TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>RH, Requisitante</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Candidato Selecionado</TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>
                            <Switch defaultChecked />
                          </TableCell>
                          <TableCell>Requisitante, TI</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Integrations Settings */}
          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integrações com Sistemas Externos</CardTitle>
                <CardDescription>Configure integrações com outros sistemas da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Última Sincronização</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Active Directory</TableCell>
                        <TableCell>Autenticação</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ligado
                          </Badge>
                        </TableCell>
                        <TableCell>12/05/2025 10:30</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              Configurar
                            </Button>
                            <Button variant="ghost" size="sm">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sincronizar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sistema de Processamento Salarial</TableCell>
                        <TableCell>Exportação de Dados</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ligado
                          </Badge>
                        </TableCell>
                        <TableCell>10/05/2025 15:45</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm">
                              Configurar
                            </Button>
                            <Button variant="ghost" size="sm">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sincronizar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Sistema de Helpdesk</TableCell>
                        <TableCell>Criação de Tickets</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Configuração Pendente
                          </Badge>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Portal de Carreiras</TableCell>
                        <TableCell>Importação de Candidatos</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Desligado
                          </Badge>
                        </TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end">
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Nova Integração
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>APIs e Webhooks</CardTitle>
                <CardDescription>Configure APIs e webhooks para integração com sistemas externos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Chaves de API</h4>
                    <Button size="sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Gerar Nova Chave
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Chave</TableHead>
                          <TableHead>Criada em</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>API Portal de Carreiras</TableCell>
                          <TableCell>••••••••••••••••</TableCell>
                          <TableCell>01/05/2025</TableCell>
                          <TableCell>01/05/2026</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                Mostrar
                              </Button>
                              <Button variant="ghost" size="sm">
                                Revogar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>API Sistema de BI</TableCell>
                          <TableCell>••••••••••••••••</TableCell>
                          <TableCell>15/04/2025</TableCell>
                          <TableCell>15/04/2026</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm">
                                Mostrar
                              </Button>
                              <Button variant="ghost" size="sm">
                                Revogar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Webhooks</h4>
                    <Button size="sm">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Novo Webhook
                    </Button>
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead>Eventos</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Notificação de Admissão</TableCell>
                          <TableCell>https://ti.empresa.com/webhooks/admissao</TableCell>
                          <TableCell>Admissão Confirmada</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Ativo
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Notificação de Rescisão</TableCell>
                          <TableCell>https://ti.empresa.com/webhooks/cessacao</TableCell>
                          <TableCell>Rescisão Confirmada</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Ativo
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Políticas de Segurança</CardTitle>
                <CardDescription>Configure as políticas de segurança do sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex flex-row items-start space-x-3 space-y-0">
                    <div className="flex items-center space-x-2">
                      <Switch id="mfa" />
                      <label htmlFor="mfa">Autenticação de Dois Fatores (2FA)</label>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Exigir autenticação de dois fatores para todos os utilizadores.
                  </p>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label htmlFor="password-policy">Política de Palavras-passe</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="password-complexity" defaultChecked />
                        <label htmlFor="password-complexity">Exigir palavras-passe complexas</label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        As palavras-passe devem ter, no mínimo, 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.
                      </p>
                    </div>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="password-expiry" defaultChecked />
                        <label htmlFor="password-expiry">Expiração de palavras-passe</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label htmlFor="password-expiry-days">Expirar palavras-passe após</label>
                        <Input id="password-expiry-days" className="w-20" defaultValue="90" />
                        <span>dias</span>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label htmlFor="session-timeout">Timeout de Sessão</label>
                    <div className="flex items-center space-x-2">
                      <Input id="session-timeout" className="w-20" defaultValue="30" />
                      <span>minutos de inatividade</span>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label>Restrições de Acesso</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="ip-restriction" />
                        <label htmlFor="ip-restriction">Restringir acesso por IP</label>
                      </div>
                      <Textarea placeholder="Insira os IPs permitidos, um por linha" className="h-20" disabled />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Auditoria e Registos (Logs)</CardTitle>
                <CardDescription>Configure as políticas de auditoria e retenção de registos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="audit-enabled" defaultChecked />
                    <label htmlFor="audit-enabled">Ativar auditoria de ações</label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Registar todas as ações realizadas no sistema para fins de auditoria.
                  </p>

                  <div className="space-y-2 mt-4">
                    <label>Eventos a Auditar</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-login" defaultChecked />
                        <label htmlFor="audit-login">Login/Logout</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-data" defaultChecked />
                        <label htmlFor="audit-data">Alterações de Dados</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-approval" defaultChecked />
                        <label htmlFor="audit-approval">Aprovações/Rejeições</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-export" defaultChecked />
                        <label htmlFor="audit-export">Exportações de Dados</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-settings" defaultChecked />
                        <label htmlFor="audit-settings">Alterações de Configuração</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-user" defaultChecked />
                        <label htmlFor="audit-user">Gestão de Utilizadores</label>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label htmlFor="log-retention">Retenção de Registos</label>
                    <div className="flex items-center space-x-2">
                      <Select defaultValue="365">
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="90">90 dias</SelectItem>
                          <SelectItem value="180">180 dias</SelectItem>
                          <SelectItem value="365">1 ano</SelectItem>
                          <SelectItem value="730">2 anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Registos
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Data Settings */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Dados</CardTitle>
                <CardDescription>Configure as políticas de retenção e cópias de segurança (backups) de dados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label>Política de Retenção de Dados</label>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="retention-candidates">Candidatos não selecionados</label>
                          <Select defaultValue="365">
                            <SelectTrigger id="retention-candidates">
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="90">90 dias</SelectItem>
                              <SelectItem value="180">180 dias</SelectItem>
                              <SelectItem value="365">1 ano</SelectItem>
                              <SelectItem value="730">2 anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="retention-employees">Ex-colaboradores</label>
                          <Select defaultValue="1825">
                            <SelectTrigger id="retention-employees">
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="365">1 ano</SelectItem>
                              <SelectItem value="730">2 anos</SelectItem>
                              <SelectItem value="1825">5 anos</SelectItem>
                              <SelectItem value="3650">10 anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="retention-requests">Pedidos concluídos</label>
                          <Select defaultValue="730">
                            <SelectTrigger id="retention-requests">
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="365">1 ano</SelectItem>
                              <SelectItem value="730">2 anos</SelectItem>
                              <SelectItem value="1825">5 anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="retention-documents">Documentos</label>
                          <Select defaultValue="1825">
                            <SelectTrigger id="retention-documents">
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="730">2 anos</SelectItem>
                              <SelectItem value="1825">5 anos</SelectItem>
                              <SelectItem value="3650">10 anos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="anonymize" defaultChecked />
                        <label htmlFor="anonymize">Anonimizar dados pessoais após o período de retenção.</label>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label>Cópias de Segurança (Backups)</label>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch id="auto-backup" defaultChecked />
                        <label htmlFor="auto-backup">Cópias de segurança automáticas</label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="backup-frequency">Frequência</label>
                          <Select defaultValue="daily">
                            <SelectTrigger id="backup-frequency">
                              <SelectValue placeholder="Selecione a frequência" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hourly">A cada hora</SelectItem>
                              <SelectItem value="daily">Diário</SelectItem>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="backup-retention">Retenção de cópias de segurança</label>
                          <Select defaultValue="30">
                            <SelectTrigger id="backup-retention">
                              <SelectValue placeholder="Selecione o período" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 dias</SelectItem>
                              <SelectItem value="14">14 dias</SelectItem>
                              <SelectItem value="30">30 dias</SelectItem>
                              <SelectItem value="90">90 dias</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Cópia de Segurança Manual
                        </Button>
                        <Button variant="outline">
                          <Upload className="h-4 w-4 mr-2" />
                          Restaurar Cópia de Segurança
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label>Importação/Exportação</label>
                    <div className="flex justify-start gap-2">
                      <Button variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Importar Dados
                      </Button>
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Dados
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conformidade RGPD</CardTitle>
                <CardDescription>Configure as políticas de privacidade e proteção de dados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label>Consentimento e Privacidade</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="privacy-policy" defaultChecked />
                        <label htmlFor="privacy-policy">Exigir aceitação da política de privacidade.</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="data-processing" defaultChecked />
                        <label htmlFor="data-processing">Registar consentimento para processamento de dados.</label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <label htmlFor="privacy-text">Texto da Política de Privacidade</label>
                    <Textarea
                      id="privacy-text"
                      className="min-h-[200px]"
                      defaultValue="A Empresa compromete-se a proteger a privacidade dos dados pessoais dos seus colaboradores e candidatos..."
                    />
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <label>Direitos dos Titulares dos Dados</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="data-access" defaultChecked />
                        <label htmlFor="data-access">Permitir que os titulares dos dados solicitem acesso aos seus dados.</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="data-deletion" defaultChecked />
                        <label htmlFor="data-deletion">Permitir que os titulares dos dados solicitem a eliminação dos seus dados.</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="data-portability" defaultChecked />
                        <label htmlFor="data-portability">
                          Permitir que os titulares dos dados exportem os seus dados (portabilidade).
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* System Settings */}
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>Configure as preferências gerais do sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="system-language">Idioma do Sistema</label>
                    <Select defaultValue="pt">
                      <SelectTrigger id="system-language">
                        <SelectValue placeholder="Selecione o idioma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Português</SelectItem>
                        <SelectItem value="en">Inglês</SelectItem>
                        <SelectItem value="es">Espanhol</SelectItem>
                        <SelectItem value="fr">Francês</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="date-format">Formato de Data</label>
                    <Select defaultValue="dd/mm/yyyy">
                      <SelectTrigger id="date-format">
                        <SelectValue placeholder="Selecione o formato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/mm/yyyy">DD/MM/AAAA</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM/DD/AAAA</SelectItem>
                        <SelectItem value="yyyy-mm-dd">AAAA-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="timezone">Fuso Horário</label>
                    <Select defaultValue="europe_lisbon">
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Selecione o fuso horário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="europe_lisbon">Europa/Lisboa (GMT+0/+1)</SelectItem>
                        <SelectItem value="europe_london">Europa/Londres (GMT+0/+1)</SelectItem>
                        <SelectItem value="america_saopaulo">América/São Paulo (GMT-3)</SelectItem>
                        <SelectItem value="africa_luanda">África/Luanda (GMT+1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="currency">Moeda</label>
                    <Select defaultValue="eur">
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Selecione a moeda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="eur">Euro (€)</SelectItem>
                        <SelectItem value="usd">Dólar Americano ($)</SelectItem>
                        <SelectItem value="brl">Real Brasileiro (R$)</SelectItem>
                        <SelectItem value="aoa">Kwanza Angolano (Kz)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <label>Aparência</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="theme-light"
                        name="theme"
                        value="light"
                        checked={theme === 'light'}
                        onChange={() => handleThemeDropdown('light')}
                        className="h-4 w-4"
                      />
                      <label htmlFor="theme-light">Tema Claro</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="theme-dark" 
                        name="theme" 
                        value="dark" 
                        checked={theme === 'dark'}
                        onChange={() => handleThemeDropdown('dark')}
                        className="h-4 w-4" 
                      />
                      <label htmlFor="theme-dark">Tema Escuro</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        id="theme-system" 
                        name="theme" 
                        value="color-blind" // Assuming system means color-blind here as per dashboard
                        checked={theme === 'color-blind'}
                        onChange={() => handleThemeDropdown('color-blind')}
                        className="h-4 w-4" 
                      />
                      <label htmlFor="theme-system">Daltónico</label> {/* Changed from Seguir Sistema */}
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <label>Preferências de Paginação</label>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="items-per-page">Itens por página</label>
                    <Select defaultValue="10">
                      <SelectTrigger id="items-per-page" className="w-20">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Alterações
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manutenção do Sistema</CardTitle>
                <CardDescription>Ferramentas de manutenção e diagnóstico do sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Limpeza de Cache</h4>
                      <p className="text-sm text-muted-foreground">
                        Limpar a cache do sistema para resolver problemas de desempenho.
                      </p>
                    </div>
                    <Button variant="outline">Limpar Cache</Button>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Otimização da Base de Dados</h4>
                      <p className="text-sm text-muted-foreground">
                        Otimizar a base de dados para melhorar o desempenho.
                      </p>
                    </div>
                    <Button variant="outline">Otimizar BD</Button>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Verificação de Integridade</h4>
                      <p className="text-sm text-muted-foreground">Verificar a integridade dos dados do sistema.</p>
                    </div>
                    <Button variant="outline">Verificar Integridade</Button>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Registos do Sistema</h4>
                      <p className="text-sm text-muted-foreground">
                        Visualizar registos do sistema para diagnóstico de problemas.
                      </p>
                    </div>
                    <Button variant="outline">Ver Registos</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações do Sistema</CardTitle>
                <CardDescription>Informações sobre a versão e o estado do sistema.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium">Versão do Sistema</h4>
                      <p className="text-sm">v1.5.2</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Data da Última Atualização</h4>
                      <p className="text-sm">10/05/2025</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Ambiente</h4>
                      <p className="text-sm">Produção</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Estado</h4>
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-2"></div>
                        <p className="text-sm">Operacional</p>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <h4 className="text-sm font-medium">Licença</h4>
                    <p className="text-sm">Licença Empresarial - Válida até 31/12/2025</p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Verificar Atualizações
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
