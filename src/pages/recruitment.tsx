import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useMsal } from "@azure/msal-react";
import {
  TIPOS_RECRUTAMENTO, SIM_NAO, PAIS_EXPATRIACAO, TIPOS_REFEICAO,
  RECRUTAMENTO_VALIDADO_POR, JUSTIFICACAO_PEDIDO, TIPOS_CONTRATO, DURACOES_CONTRATO, TIPOS_PREMIO, SEGURO_SAUDE
} from "../enums";
import { useFuncionario } from "../context/FuncionarioContext";

interface RecruitmentFormData {
  function: string;
  requestDate: string;
  company: string;
  department: string;
  employee: string;
  admissionDate: string;
  type: string;
  vacancies: number;
  justification: string;
  preIdentifiedCandidates: string;
  responsibleIdentification: string;
  hrIntervention: boolean;
  responsibilities: string;
  profile: string;
  contract: string;
  duration: string;
  contractGeography: string;
  salary: string;
  premiumType: string;
  premiumValue: string;
  meals: string;
  cardPlafond: string;
  healthInsurance: string;
  mobile: boolean;
  newMobile: boolean;
  car: boolean;
  laptop: boolean;
  visitCard: boolean;
  cardFunction: string;
  epi: boolean;
  workClothes: boolean;
  otherEquipment: string;
  expatriationCountry: string;
  localHousing: string;
  localTransport: string;
  expatriationMeals: string;
  annualTrips: string;
  weeklyAid: string;
  weeklyAidValue: string;
  recruitmentValidatedBy: string;
  obs: string;
  estado: string;
}

// Funções utilitárias para mapear campos camelCase <-> snake_case
function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = {};
  for (const key in obj) {
    const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snake] = obj[key];
  }
  return newObj;
}
function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = {};
  for (const key in obj) {
    const camel = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
    newObj[camel] = obj[key];
  }
  return newObj;
}

type Employee = { Active: boolean; CompanyName: string; Department: string; /* ... */ };

export default function RecruitmentForm() {
  const [formData, setFormData] = useState<RecruitmentFormData>({
    function: "",
    requestDate: new Date().toISOString().split('T')[0],
    company: "",
    department: "",
    employee: "",
    admissionDate: new Date().toISOString().split('T')[0],
    type: "",
    vacancies: 1,
    justification: "",
    preIdentifiedCandidates: "",
    responsibleIdentification: "",
    hrIntervention: false,
    responsibilities: "",
    profile: "",
    contract: "",
    duration: "",
    contractGeography: "",
    salary: "",
    premiumType: "",
    premiumValue: "",
    meals: "",
    cardPlafond: "",
    healthInsurance: "",
    mobile: false,
    newMobile: false,
    car: false,
    laptop: false,
    visitCard: false,
    cardFunction: "",
    epi: false,
    workClothes: false,
    otherEquipment: "",
    expatriationCountry: "",
    localHousing: "",
    localTransport: "",
    expatriationMeals: "",
    annualTrips: "",
    weeklyAid: "",
    weeklyAidValue: "",
    recruitmentValidatedBy: "",
    obs: "",
    estado: "Pendente"
  });
  const [empresas, setEmpresas] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [funcionariosEmpresa, setFuncionariosEmpresa] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingDepartamentos, setLoadingDepartamentos] = useState(false);
  const router = useRouter();
  const { funcionarioSelecionado } = useFuncionario();
  const [searchFuncionario, setSearchFuncionario] = useState("");
  const [showFuncionarioDropdown, setShowFuncionarioDropdown] = useState(false);
  const funcionarioInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const { accounts } = useMsal();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (!accounts || !accounts[0]) return;
    if (!id) {
      setLoading(false);
      return;
    }
    const user = accounts[0];
    const userId = funcionarioSelecionado?.Number || user.username;
    const userGroups = user.idTokenClaims?.groups || [];
    const fetchData = async () => {
      try {
        // Buscar o pedido de recrutamento
        const pedidoRes = await fetch(`/api/recruitment?id=${id}`, {
          headers: {
            userId: userId,
            userGroups: JSON.stringify(userGroups),
          }
        });
        let pedidoData = await pedidoRes.json();
        if (pedidoRes.status !== 200) {
          throw new Error(pedidoData.message || 'Erro ao carregar dados');
        }
        // Preencher o formulário com os dados do pedido (convertendo para camelCase)
        pedidoData = toCamelCase(pedidoData);
        setFormData({
          ...pedidoData,
          requestDate: pedidoData.requestDate ? pedidoData.requestDate.split('T')[0] : "",
          admissionDate: pedidoData.admissionDate ? pedidoData.admissionDate.split('T')[0] : "",
        });
        // Se a empresa do pedido não existir na lista, adiciona-a
        if (pedidoData.company && !empresas.includes(pedidoData.company)) {
          setEmpresas(prev => [...prev, pedidoData.company]);
        }
      } catch (err) {
        setError(err.message || 'Erro ao carregar o formulário');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [id, accounts, funcionarioSelecionado, empresas]);

  useEffect(() => {
    // Buscar todos os funcionários ativos para extrair empresas e departamentos
    const fetchEmpresas = async () => {
      setLoadingEmpresas(true);
      const res = await fetch("/api/employee?userId=ALL");
      const data = await res.json();
      const ativos = (data as Employee[]).filter((f) => f.Active);
      setAllEmployees(ativos);
      const empresasUnicas = Array.from(new Set(ativos.map((f: Employee) => f.CompanyName).filter(Boolean)));
      setEmpresas(empresasUnicas);
      setLoadingEmpresas(false);
    };
    fetchEmpresas();
  }, []);

  useEffect(() => {
    // Atualizar departamentos quando a empresa muda
    if (!formData.company) {
      setDepartamentos([]);
      setFormData(prev => ({ ...prev, department: "", employee: "" }));
      setFuncionariosEmpresa([]);
      return;
    }
    setLoadingDepartamentos(true);
    const deps = allEmployees
      .filter(f => f.CompanyName === formData.company)
      .map(f => f.Department)
      .filter(Boolean);
    const depsUnicos = Array.from(new Set(deps));
    setDepartamentos(depsUnicos);
    // Atualizar funcionários ativos da empresa
    const funcionarios = allEmployees.filter(f => f.CompanyName === formData.company);
    setFuncionariosEmpresa(funcionarios);
    setLoadingDepartamentos(false);
    setFormData(prev => ({ ...prev, department: "", employee: "" }));
  }, [formData.company, allEmployees]);

  useEffect(() => {
    // Preencher funcionário selecionado do dashboard por defeito
    if (funcionarioSelecionado && formData.company === funcionarioSelecionado.CompanyName) {
      setFormData(prev => ({ ...prev, responsibleIdentification: funcionarioSelecionado.Number }));
      setSearchFuncionario(funcionarioSelecionado.Name);
    }
  }, [funcionarioSelecionado, formData.company]);

  // Filtrar funcionários por nome ou número
  const filteredFuncionarios = funcionariosEmpresa.filter(f => {
    const search = searchFuncionario.toLowerCase();
    return (
      f.Name.toLowerCase().includes(search) ||
      String(f.Number).includes(search)
    );
  });

  // Garantir unicidade de empresas e departamentos
  const empresasUnicas = Array.from(new Set(empresas));
  const departamentosUnicos = Array.from(new Set(departamentos));

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (funcionarioInputRef.current && !funcionarioInputRef.current.contains(event.target)) {
        setShowFuncionarioDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleCheckboxChange = (name, checked) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      const user = accounts?.[0];
      const userId = funcionarioSelecionado?.Number || user?.username;
      const userGroups = user?.idTokenClaims?.groups || [];
      const method = id ? "PUT" : "POST";

      // Preparar os dados antes de converter para snake_case
      const formDataToSend = {
        ...formData,
        // Converter campos numéricos vazios para null
        vacancies: formData.vacancies || null,
        annualTrips: formData.annualTrips || null,
        weeklyAidValue: formData.weeklyAidValue || null,
        // Garantir que campos booleanos sejam booleanos
        hrIntervention: Boolean(formData.hrIntervention),
        mobile: Boolean(formData.mobile),
        newMobile: Boolean(formData.newMobile),
        car: Boolean(formData.car),
        laptop: Boolean(formData.laptop),
        visitCard: Boolean(formData.visitCard),
        epi: Boolean(formData.epi),
        workClothes: Boolean(formData.workClothes),
      };

      // Converter campos para snake_case antes de enviar
      let payload = toSnakeCase({
        ...formDataToSend,
        id,
        userId,
        userGroups,
      });

      // Remover campos de data vazios
      ["request_date", "admission_date"].forEach(field => {
        if (payload[field] === "") delete payload[field];
        // Se existir, garantir formato YYYY-MM-DD
        if (payload[field] && typeof payload[field] === 'string' && payload[field].includes('T')) {
          payload[field] = payload[field].split('T')[0];
        }
      });

      const res = await fetch("/api/recruitment", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        setSaveSuccess("Formulário gravado com sucesso!");
        setSaving(false);
        setShowSuccessModal(true);
      } else {
        setSaveError(result.error || "Erro ao gravar formulário.");
      }
    } catch (err) {
      setSaveError("Erro ao gravar formulário.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloseSuccessModalAndRedirect = () => {
    setShowSuccessModal(false);
    router.push("/recruitmentdashboard");
  };

  const handleCancel = () => {
    if (confirm("Tem a certeza que deseja cancelar e voltar para o dashboard? As alterações não guardadas serão perdidas.")) {
      router.push("/recruitmentdashboard");
    }
  };

  const perfilTooltip = (
    <div className="text-left text-sm leading-relaxed">
      <p className="font-semibold mb-2">Preencha os seguintes tópicos:</p>
      <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
        <li>Função / Categoria</li>
        <li>Habilitações académicas</li>
        <li>N.º de anos de experiência</li>
        <li>Competências técnicas</li>
        <li>Competências informáticas</li>
        <li>Línguas estrangeiras</li>
        <li>Disponibilidade para deslocações</li>
        <li>Soft skills</li>
        <li>Outras...</li>
      </ul>
    </div>
  );
  
  if (loading) return <p>A carregar...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="w-full max-w-4xl mx-auto bg-card rounded-lg shadow p-6 mt-8 text-card-foreground">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 mr-3">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 10C27.909 10 10 27.909 10 50C10 72.091 27.909 90 50 90C72.091 90 90 72.091 90 50C90 27.909 72.091 10 50 10Z" fill="#933037" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-foreground">FICHA DE IDENTIFICAÇÃO DE NECESSIDADE DE RECRUTAMENTO</h1>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>F-RH-15</p>
          <p>06/06/2022</p>
        </div>
      </div>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="function" className="block font-medium mb-1">Função</label>
            <input id="function" name="function" value={formData.function} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required />
          </div>
          <div>
            <label htmlFor="requestDate" className="block font-medium mb-1">Data do pedido de recrutamento</label>
            <input id="requestDate" name="requestDate" type="date" value={formData.requestDate ? formData.requestDate : ""} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="company" className="block font-medium mb-1">Empresa</label>
            <select id="company" name="company" value={formData.company} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required>
              <option value="">-- Selecione a empresa --</option>
              {loadingEmpresas ? <option>Carregar empresas...</option> : empresasUnicas.map((empresa) => (
                <option key={empresa} value={empresa}>{empresa}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="department" className="block font-medium mb-1">Departamento</label>
            <select id="department" name="department" value={formData.department} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required disabled={!formData.company || loadingDepartamentos}>
              <option value="">-- Selecione o departamento --</option>
              {departamentosUnicos.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
              <option value="novo">O departamento ainda não existe, clique aqui para criar um</option>
            </select>
            {formData.department === "novo" && (
              <input type="text" name="department" placeholder="Novo departamento" className="w-full border border-border rounded p-2 mt-2 bg-background text-foreground" onChange={handleChange} required />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" ref={funcionarioInputRef}>
            <label htmlFor="responsibleIdentification" className="block font-medium mb-1">Resp. pela Identificação da Necessidade (RIN)</label>
            <input
              id="responsibleIdentification"
              name="responsibleIdentification"
              autoComplete="off"
              value={searchFuncionario || (formData.responsibleIdentification ? funcionariosEmpresa.find(f => f.Number === formData.responsibleIdentification)?.Name || formData.responsibleIdentification : "")}
              onChange={e => {
                setSearchFuncionario(e.target.value);
                setShowFuncionarioDropdown(true);
                setFormData(prev => ({ ...prev, responsibleIdentification: "" }));
              }}
              onFocus={() => setShowFuncionarioDropdown(true)}
              className="w-full border border-border rounded p-2 bg-background text-foreground"
              placeholder="Pesquise por nome ou número..."
              required
            />
            {showFuncionarioDropdown && filteredFuncionarios.length > 0 && (
              <ul className="absolute z-10 bg-card border border-border rounded w-full max-h-48 overflow-auto mt-1 shadow-lg">
                {filteredFuncionarios.map(f => (
                  <li
                    key={f.Number}
                    className="px-3 py-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, responsibleIdentification: f.Number }));
                      setSearchFuncionario(f.Name);
                      setShowFuncionarioDropdown(false);
                    }}
                  >
                    {f.Number} | {f.Name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="admissionDate" className="block font-medium mb-1">Data prevista para admissão</label>
            <input id="admissionDate" name="admissionDate" type="date" value={formData.admissionDate ? formData.admissionDate : ""} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block font-medium mb-1">Tipologia</label>
            <select id="type" name="type" value={formData.type} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required>
              <option value="">-- Selecione a tipologia --</option>
              {TIPOS_RECRUTAMENTO.map((tipo) => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vacancies" className="block font-medium mb-1">Nº de vagas para preencher</label>
            <input id="vacancies" name="vacancies" type="number" min={1} value={formData.vacancies} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="justification" className="block font-medium mb-1">Justificação do pedido</label>
            <select id="justification" name="justification" value={formData.justification} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required>
              <option value="">-- Selecione --</option>
              {JUSTIFICACAO_PEDIDO.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preIdentifiedCandidates" className="block font-medium mb-1">Candidatos pré-identificados, no caso de admissões</label>
            <select id="preIdentifiedCandidates" name="preIdentifiedCandidates" value={formData.preIdentifiedCandidates} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required>
              <option value="">-- Selecione --</option>
              {SIM_NAO.map(opt => (
                <option key={String(opt.label)} value={String(opt.value)}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="recruitmentValidatedBy" className="block font-medium mb-1">Recrutamento validado por</label>
            <select id="recruitmentValidatedBy" name="recruitmentValidatedBy" value={formData.recruitmentValidatedBy || ""} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" required>
              <option value="">-- Selecione --</option>
              {RECRUTAMENTO_VALIDADO_POR.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="block font-medium mb-1">É necessária intervenção dos Serviços Partilhados (RH) no processo Recrutamento e Seleção?</label>
          <div className="flex space-x-4 mt-2">
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="hrInterventionYes" checked={formData.hrIntervention} onChange={e => handleCheckboxChange("hrIntervention", e.target.checked)} />
              <label htmlFor="hrInterventionYes">Sim</label>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="hrInterventionNo" checked={!formData.hrIntervention} onChange={e => handleCheckboxChange("hrIntervention", !e.target.checked)} />
              <label htmlFor="hrInterventionNo">Não</label>
            </div>
          </div>
        </div>
        <div className="bg-muted p-4 rounded mt-6">
          <h3 className="text-md font-medium text-foreground mb-4 flex items-center gap-2">
            Responsabilidades e perfil pretendido
            <span className="relative group cursor-pointer">
              <svg width="18" height="18" fill="currentColor" className="text-muted-foreground inline-block"><circle cx="9" cy="9" r="8" stroke="gray" strokeWidth="2" fill="white"/><text x="9" y="13" textAnchor="middle" fontSize="10" fill="gray">i</text></svg>
              <span className="absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-card border border-border rounded shadow-lg p-2 text-xs text-foreground opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                {perfilTooltip}
              </span>
            </span>
          </h3>
          <p className="text-xs text-muted-foreground italic mb-4">Nota: Será com base nesta informação que será divulgada a oferta de emprego para o exterior</p>
          <div>
            <label htmlFor="responsibilities" className="block font-medium mb-1">Responsabilidades</label>
            <textarea id="responsibilities" name="responsibilities" value={formData.responsibilities} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" rows={4} required />
          </div>
          <div className="mt-3">
            <label htmlFor="profile" className="block font-medium mb-1">Perfil</label>
            <textarea id="profile" name="profile" value={formData.profile} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" rows={8} placeholder="- Função/Categoria;
- Habilitações académicas;
- n.º de anos de experiência;
- competências técnicas;
- competências informáticas;
- línguas estrangeiras;
- disponibilidade para deslocações;
- soft skills;
- outras..." required />
          </div>
        </div>
        {/* Secção: Condições a oferecer ao candidato selecionado */}
        <div className="bg-muted p-4 rounded mt-6">
          <h3 className="text-md font-medium text-foreground mb-4">Condições a oferecer ao candidato selecionado</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">Contrato</label>
              <select name="contract" value={formData.contract} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {TIPOS_CONTRATO.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Duração</label>
              <select name="duration" value={formData.duration} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {DURACOES_CONTRATO.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Geografia de celebração do contrato</label>
              <select name="contractGeography" value={formData.contractGeography} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione o país --</option>
                {PAIS_EXPATRIACAO.filter(p => p.ativo).map(pais => (
                  <option key={pais.value} value={pais.value}>{pais.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block font-medium mb-1">Valor do salário - componente fixa</label>
              <input name="salary" value={formData.salary} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
            <div>
              <label className="block font-medium mb-1">Tipologia do Prémio</label>
              <select name="premiumType" value={formData.premiumType} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {TIPOS_PREMIO.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Valor do prémio</label>
              <input name="premiumValue" value={formData.premiumValue} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block font-medium mb-1">Refeições</label>
              <select name="meals" value={formData.meals} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {TIPOS_REFEICAO.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Cartão-Plafond</label>
              <select name="cardPlafond" value={formData.cardPlafond} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {SIM_NAO.map(opt => (
                  <option key={String(opt.label)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Seguro de Saúde</label>
              <select name="healthInsurance" value={formData.healthInsurance} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione --</option>
                {SEGURO_SAUDE.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {/* Secção: Equipamentos e vestuário */}
        <div className="bg-muted p-4 rounded mt-6">
          <h3 className="text-md font-medium text-foreground mb-4">Equipamentos e vestuário</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center space-x-2"><input type="checkbox" name="mobile" checked={formData.mobile} onChange={handleChange} /> <span>Telemóvel</span></div>
              <div className="flex items-center space-x-2 mt-2"><input type="checkbox" name="car" checked={formData.car} onChange={handleChange} /> <span>Viatura</span></div>
              <div className="flex items-center space-x-2 mt-2"><input type="checkbox" name="visitCard" checked={formData.visitCard} onChange={handleChange} /> <span>Cartão de Visita</span></div>
            </div>
            <div>
              <div className="flex items-center space-x-2"><input type="checkbox" name="newMobile" checked={formData.newMobile} onChange={handleChange} /> <span>Solicitar novo n.º</span></div>
              <div className="flex items-center space-x-2 mt-2"><input type="checkbox" name="laptop" checked={formData.laptop} onChange={handleChange} /> <span>Portátil</span></div>
              <div className="mt-2"><label className="block font-medium mb-1">Função a constar no cartão</label><input name="cardFunction" value={formData.cardFunction} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" /></div>
            </div>
            <div>
              <div className="flex items-center space-x-2"><input type="checkbox" name="epi" checked={formData.epi} onChange={handleChange} /> <span>EPI's</span></div>
              <div className="flex items-center space-x-2 mt-2"><input type="checkbox" name="workClothes" checked={formData.workClothes} onChange={handleChange} /> <span>Vestuário de Trabalho</span></div>
              <div className="mt-2"><label className="block font-medium mb-1">Outro(s)</label><input name="otherEquipment" value={formData.otherEquipment} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" /></div>
            </div>
          </div>
        </div>
        {/* Secção: Condições de expatriação */}
        <div className="bg-muted p-4 rounded mt-6">
          <h3 className="text-md font-medium text-foreground mb-4">Condições de expatriação</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium mb-1">País</label>
              <select name="expatriationCountry" value={formData.expatriationCountry} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground">
                <option value="">-- Selecione o país --</option>
                {PAIS_EXPATRIACAO.filter(p => p.ativo).map(pais => (
                  <option key={pais.value} value={pais.value}>{pais.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">N.º viagens/ano</label>
              <input name="annualTrips" type="number" min={0} value={formData.annualTrips} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
            <div>
              <label className="block font-medium mb-1">Habitação local</label>
              <input name="localHousing" value={formData.localHousing} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block font-medium mb-1">Transporte local</label>
              <input name="localTransport" value={formData.localTransport} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
            <div>
              <label className="block font-medium mb-1">Refeições</label>
              <input name="expatriationMeals" value={formData.expatriationMeals} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
            <div>
              <label className="block font-medium mb-1">Ajuda semanal</label>
              <input name="weeklyAid" value={formData.weeklyAid} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <div>
              <label className="block font-medium mb-1">Valor ajuda semanal</label>
              <input name="weeklyAidValue" value={formData.weeklyAidValue} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" />
            </div>
          </div>
        </div>
        {/* Observações */}
        <div className="mt-6">
          <label htmlFor="obs" className="block font-medium mb-1">OBS:</label>
          <textarea id="obs" name="obs" value={formData.obs} onChange={handleChange} className="w-full border border-border rounded p-2 bg-background text-foreground" rows={3} />
        </div>
        <div className="flex justify-between items-center mt-6">
          <p className="text-xs text-muted-foreground">GRUPO RAMOS FERREIRA / / EMBRACE THE FUTURE</p>
          <div className="flex justify-end space-x-4">
            <button type="button" className="border border-border px-4 py-2 rounded bg-background text-foreground" onClick={handleCancel}>Cancelar</button>
            <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded" disabled={saving}>
              {saving ? "A gravar..." : "Submeter"}
            </button>
          </div>
        </div>
        {saveSuccess && <p className="text-green-600 mt-2">{saveSuccess}</p>}
        {saveError && <p className="text-red-600 mt-2">{saveError}</p>}
      </form>
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Formulário gravado com sucesso!</h2>
            <p>Deseja voltar para o dashboard?</p>
            <div className="mt-4 flex justify-end space-x-4">
              <button className="bg-primary text-primary-foreground px-4 py-2 rounded" onClick={handleCloseSuccessModalAndRedirect}>Sim</button>
              <button className="bg-background text-foreground px-4 py-2 rounded" onClick={handleCancel}>Não</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 