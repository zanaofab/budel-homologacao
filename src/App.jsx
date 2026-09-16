import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileCheck2,
  FileDown,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";
import { checklistItems } from "./data/checklist";

const DOCUMENTS = [
  {
    type: "cartao_cnpj",
    label: "Cartão CNPJ",
    description: "Comprovante de inscrição e situação cadastral.",
    required: true,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "alvara",
    label: "Alvará de Localização e Funcionamento",
    description: "Alvará vigente do estabelecimento.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "bombeiro",
    label: "Corpo de Bombeiros",
    description: "Certificado ou documento emitido pelo Corpo de Bombeiros.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "licenca_sanitaria",
    label: "Licença Sanitária",
    description: "Licença sanitária vigente, quando aplicável.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "licenca_operacao",
    label: "Licença de Operação",
    description: "Licença ambiental ou de operação, quando aplicável.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "ibama",
    label: "Certificado de Regularidade (IBAMA)",
    description: "Certificado de regularidade ambiental.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "autorizacao_ambiental",
    label:
      "Autorização Ambiental para Transporte Interestadual de Produtos Perigosos",
    description: "Autorização ambiental, quando aplicável.",
    required: false,
    expires: true,
    manualExpiry: true,
  },
  {
    type: "checklist",
    label: "Checklist F103-04 preenchido",
    description: "Checklist de inspeção de fornecedores preenchido.",
    required: true,
    expires: false,
  },
  {
    type: "fotos_local",
    label: "Fotos do local",
    description: "Fotos do estabelecimento e/ou estrutura fornecida.",
    required: true,
    expires: false,
    multiple: true,
  },
  {
    type: "outros",
    label: "Outros documentos",
    description:
      "Adicione documentos complementares individualmente, informando o título e a validade de cada um.",
    required: false,
    expires: true,
    multiple: true,
    customMetadata: true,
  },
];

const STATUS_LABELS = {
  pending: "Aguardando análise",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

const COMPANY_STATUS_LABELS = {
  draft: "Rascunho",
  submitted: "Enviado para homologação",
  approved: "Homologado",
  rejected: "Correções necessárias",
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function keywordList(value) {
  return String(value || "")
    .split(/[,;|\n]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function adminIsViewOnly(profile) {
  const keywords = keywordList(profile?.admin_keywords);
  return keywords.includes("visualizar");
}

function adminCanReview(profile) {
  if (!profile || profile.role !== "admin") return false;
  if (profile.admin_can_manage_users) return true;
  if (adminIsViewOnly(profile)) return false;
  return true;
}

function adminCanManageUsers(profile) {
  return Boolean(
    profile?.role === "admin" && profile?.admin_can_manage_users === true
  );
}

function adminCanViewCompany(profile, modality) {
  if (!profile || profile.role !== "admin") return false;

  if (profile.admin_can_manage_users) return true;

  const keywords = keywordList(profile.admin_keywords);

  if (!keywords.length) return true;

  if (keywords.includes("visualizar")) return true;

  const normalizedModality = normalizeText(modality);

  return keywords.some((keyword) =>
    normalizedModality.includes(keyword)
  );
}

function daysUntil(dateString) {
  if (!dateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(target.getTime())) return null;

  return Math.ceil((target - today) / 86400000);
}

function expiryStatus(dateString) {
  const days = daysUntil(dateString);

  if (days === null) {
    return {
      className: "",
      label: "Validade não informada",
    };
  }

  if (days < 0) {
    return {
      className: "status-danger",
      label: "Vencido",
    };
  }

  if (days <= 15) {
    return {
      className: "status-warning",
      label: days === 0 ? "Vence hoje" : `Vence em ${days} dia(s)`,
    };
  }

  return {
    className: "status-ok",
    label: "Válido",
  };
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR");
}

function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function getDocumentDefinition(type) {
  return DOCUMENTS.find((item) => item.type === type);
}

function getDocumentFiles(document) {
  if (!document) return [];

  if (Array.isArray(document.files) && document.files.length) {
    return document.files;
  }

  if (document.file_path) {
    return [
      {
        path: document.file_path,
        name: document.original_name || "Documento",
      },
    ];
  }

  return [];
}

function getCompanyStatusLabel(status) {
  return COMPANY_STATUS_LABELS[status] || status || "—";
}

function isValidDate(value) {
  if (!value) return false;

  const date = new Date(`${value}T12:00:00`);

  return !Number.isNaN(date.getTime());
}

function normalizeOtherDocumentFile(file) {
  return {
    path: file?.path || "",
    name: file?.name || "Documento",
    title: file?.title || file?.name || "Documento",
    issue_date: file?.issue_date || "",
    expiry_date: file?.expiry_date || "",
    expiry_text: file?.expiry_text || "",
  };
}

function getOtherDocumentFiles(document) {
  return getDocumentFiles(document).map(normalizeOtherDocumentFile);
}

function hasOtherDocumentExpiry(file) {
  return Boolean(file?.expiry_date || file?.expiry_text);
}

function getOtherDocumentExpiryLabel(file) {
  if (file?.expiry_text) {
    return file.expiry_text;
  }

  if (file?.expiry_date) {
    return formatDate(file.expiry_date);
  }

  return "Validade não informada";
}

function getOtherDocumentExpiryStatus(file) {
  if (!file?.expiry_date) {
    return {
      className: "",
      label: file?.expiry_text
        ? file.expiry_text
        : "Validade não informada",
    };
  }

  return expiryStatus(file.expiry_date);
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState("home");
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(currentSession);

      if (currentSession?.user) {
        await loadProfile(currentSession.user.id);
      }

      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);

      if (newSession?.user) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
        setPage("home");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, admin_keywords, admin_can_manage_users"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(error);
      return;
    }

    setProfile(data);

    if (data?.role === "admin") {
      setPage("admin");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSelectedCompany(null);
    setPage("home");
  }

  if (loading) {
    return (
      <div className="app-loading">
        <RefreshCw size={28} className="spin" />
        <span>Carregando...</span>
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        session={session}
        profile={profile}
        onHome={() => setPage("home")}
        onLogin={() => setPage("login")}
        onSignOut={handleSignOut}
        onAdmin={() => setPage("admin")}
        onSupplier={() => setPage("supplier")}
      />

      {page === "home" && (
        <HomePage
          session={session}
          profile={profile}
          onStart={() => {
            if (session) {
              setPage(profile?.role === "admin" ? "admin" : "supplier");
            } else {
              setPage("login");
            }
          }}
        />
      )}

      {page === "login" && (
        <LoginPage
          onSuccess={async () => {
            const {
              data: { session: currentSession },
            } = await supabase.auth.getSession();

            setSession(currentSession);

            if (currentSession?.user) {
              await loadProfile(currentSession.user.id);
            }
          }}
          onSignup={() => setPage("signup")}
          onBack={() => setPage("home")}
        />
      )}

      {page === "signup" && (
        <SignupPage
          onBack={() => setPage("login")}
          onSuccess={() => setPage("login")}
        />
      )}

      {page === "supplier" && session && profile?.role !== "admin" && (
        <SupplierDashboard
          session={session}
          profile={profile}
          onOpenCompany={(company) => {
            setSelectedCompany(company);
            setPage("company");
          }}
        />
      )}

      {page === "company" && selectedCompany && session && (
        <SupplierCompanyPage
          session={session}
          company={selectedCompany}
          onBack={() => {
            setSelectedCompany(null);
            setPage("supplier");
          }}
        />
      )}

      {page === "admin" && session && profile?.role === "admin" && (
        <AdminDashboard
          session={session}
          adminProfile={profile}
          onOpenCompany={(company) => {
            setSelectedCompany(company);
            setPage("admin-company");
          }}
        />
      )}

      {page === "admin-company" &&
        selectedCompany &&
        session &&
        profile?.role === "admin" && (
          <AdminCompanyPage
            session={session}
            company={selectedCompany}
            adminProfile={profile}
            onBack={() => {
              setSelectedCompany(null);
              setPage("admin");
            }}
          />
        )}
    </div>
  );
}

function Header({
  session,
  profile,
  onHome,
  onLogin,
  onSignOut,
  onAdmin,
  onSupplier,
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          type="button"
          className="brand-button"
          onClick={onHome}
        >
          <img
            src="/budel-logo.png"
            alt="Budel Transportes"
            className="brand-logo"
          />
        </button>

        <div className="header-actions">
          {session && profile?.role === "admin" && (
            <button
              type="button"
              className="header-link"
              onClick={onAdmin}
            >
              <ShieldCheck size={16} />
              Administração
            </button>
          )}

          {session && profile?.role !== "admin" && (
            <button
              type="button"
              className="header-link"
              onClick={onSupplier}
            >
              <FolderOpen size={16} />
              Meus CNPJs
            </button>
          )}

          {!session ? (
            <button
              type="button"
              className="header-link"
              onClick={onLogin}
            >
              <LogIn size={16} />
              Entrar
            </button>
          ) : (
            <button
              type="button"
              className="header-link"
              onClick={onSignOut}
            >
              <LogOut size={16} />
              Sair
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function HomePage({ session, profile, onStart }) {
  return (
    <main className="page">
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <ShieldCheck size={16} />
            Portal de Homologação de Fornecedores
          </div>

          <h1>Homologação de Fornecedores</h1>

          <p>
            Envie e acompanhe a documentação necessária para homologação de
            fornecedores da Budel Transportes.
          </p>

          <button
            type="button"
            className="primary-button hero-button"
            onClick={onStart}
          >
            <Upload size={18} />
            {session
              ? profile?.role === "admin"
                ? "Acessar administração"
                : "Enviar documentos para Homologação"
              : "Enviar documentos para Homologação"}
          </button>
        </div>
      </section>
    </main>
  );
}

function LoginPage({ onSuccess, onSignup, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess();
  }

  return (
    <main className="page">
      <div className="auth-card">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="auth-heading">
          <div className="auth-icon">
            <LogIn size={22} />
          </div>

          <div>
            <h1>Entrar</h1>
            <p>Acesse o portal de homologação.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="form">
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {message && <div className="form-message error">{message}</div>}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={17} className="spin" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={17} />
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>Ainda não possui acesso?</span>

          <button
            type="button"
            className="text-button"
            onClick={onSignup}
          >
            Criar conta de fornecedor
          </button>
        </div>
      </div>
    </main>
  );
}

function SignupPage({ onBack, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();

    setMessage("");

    if (password !== confirmPassword) {
      setMessage("As senhas não são iguais.");
      return;
    }

    if (password.length < 6) {
      setMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="page">
        <div className="auth-card success-card">
          <div className="success-icon">
            <CheckCircle2 size={36} />
          </div>

          <h1>Conta criada!</h1>

          <p>
            Enviamos um e-mail de confirmação para o endereço informado.
            Confirme seu e-mail para acessar o portal.
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={onSuccess}
          >
            <LogIn size={17} />
            Voltar para o login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="auth-card">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="auth-heading">
          <div className="auth-icon">
            <UserPlus size={22} />
          </div>

          <div>
            <h1>Criar conta</h1>
            <p>Cadastre o acesso da sua empresa.</p>
          </div>
        </div>

        <form onSubmit={handleSignup} className="form">
          <label>
            Nome
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <label>
            Confirmar senha
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
            />
          </label>

          {message && <div className="form-message error">{message}</div>}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={17} className="spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus size={17} />
                Criar conta
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
