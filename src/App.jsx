import React, { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  ArrowLeft,
  Bell,
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
    expires: false,
  },
  {
    type: "alvara",
    label: "Alvará de Localização e Funcionamento",
    description: "Alvará vigente do estabelecimento.",
    required: false,
    expires: true,
  },
  {
    type: "bombeiro",
    label: "Corpo de Bombeiros",
    description:
      "Certificado ou documento emitido pelo Corpo de Bombeiros.",
    required: false,
    expires: true,
  },
  {
    type: "licenca_sanitaria",
    label: "Licença Sanitária",
    description: "Licença sanitária vigente, quando aplicável.",
    required: false,
    expires: true,
  },
  {
    type: "licenca_operacao",
    label: "Licença de Operação",
    description: "Licença ambiental ou de operação, quando aplicável.",
    required: false,
    expires: true,
  },
  {
    type: "ibama",
    label: "Certificado de Regularidade (IBAMA)",
    description: "Certificado de regularidade ambiental.",
    required: false,
    expires: true,
  },
  {
    type: "autorizacao_ambiental",
    label:
      "Autorização Ambiental para Transporte Interestadual de Produtos Perigosos",
    description: "Autorização ambiental, quando aplicável.",
    required: false,
    expires: true,
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
      "Documentos complementares que julgar necessários.",
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

async function recordAdminActivity(type, companyId) {
  if (!type || !companyId) return;

  const { error } = await supabase.rpc(
    "create_budel_admin_activity",
    {
      p_type: type,
      p_company_id: companyId,
    }
  );

  if (error) {
    console.error("Não foi possível registrar a notificação administrativa:", error);
  }
}

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
    profile?.role === "admin" &&
      profile?.admin_can_manage_users === true
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
      label: "Sem validade informada",
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
      label:
        days === 0
          ? "Vence hoje"
          : `Vence em ${days} dia(s)`,
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
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 14);

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

  if (
    Array.isArray(document.files) &&
    document.files.length
  ) {
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
  const expiryType =
    file?.expiry_type === "definitive" ||
    file?.expiry_text?.trim() === "Licença definitiva"
      ? "definitive"
      : file?.expiry_date
      ? "date"
      : "";

  return {
    path: file?.path || "",
    name: file?.name || "Documento",
    title: file?.title || file?.name || "Documento",
    expiry_date: file?.expiry_date || "",
    expiry_type: expiryType,
    expiry_text:
      expiryType === "definitive"
        ? "Licença definitiva"
        : "",
  };
}

function getOtherDocumentFiles(document) {
  return getDocumentFiles(document).map(
    normalizeOtherDocumentFile
  );
}

function getDocumentExpiryType(document) {
  if (
    document?.expiry_text?.trim() ===
    "Licença definitiva"
  ) {
    return "definitive";
  }

  if (document?.expiry_date) {
    return "date";
  }

  return "";
}

function getOtherDocumentExpiryLabel(file) {
  if (
    file?.expiry_type === "definitive" ||
    file?.expiry_text?.trim() ===
      "Licença definitiva"
  ) {
    return "Licença definitiva";
  }

  if (file?.expiry_date) {
    return formatDate(file.expiry_date);
  }

  return "Validade não informada";
}

function getOtherDocumentExpiryStatus(file) {
  if (
    file?.expiry_type === "definitive" ||
    file?.expiry_text?.trim() ===
      "Licença definitiva"
  ) {
    return {
      className: "status-ok",
      label: "Licença definitiva",
    };
  }

  if (!file?.expiry_date) {
    return {
      className: "",
      label: "Validade não informada",
    };
  }

  return expiryStatus(file.expiry_date);
}

function getDocumentExpiryStatus(document) {
  if (getDocumentExpiryType(document) === "definitive") {
    return {
      className: "status-ok",
      label: "Licença definitiva",
    };
  }

  if (document?.expiry_date) {
    return expiryStatus(document.expiry_date);
  }

  return null;
}

const NAVIGATION_STORAGE_KEY = "budel_navigation";

function readSavedNavigation() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAVIGATION_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return null;
    return saved;
  } catch {
    return null;
  }
}

function saveNavigation(page, companyId = null) {
  try {
    localStorage.setItem(
      NAVIGATION_STORAGE_KEY,
      JSON.stringify({ page, companyId })
    );
  } catch {
    // Se o navegador bloquear o armazenamento, a navegação continua normalmente.
  }
}

function App() {
  const savedNavigation = readSavedNavigation();

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(savedNavigation?.page || "home");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [supplierNotificationsOpen, setSupplierNotificationsOpen] = useState(false);
  const [supplierNotificationCount, setSupplierNotificationCount] = useState(0);
  const [adminNotificationsOpen, setAdminNotificationsOpen] = useState(false);
  const [adminNotificationCount, setAdminNotificationCount] = useState(0);

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
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);

        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setPage("home");
        }
      }
    );

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

    const saved = readSavedNavigation();
    const isAdmin = data?.role === "admin";
    const savedCompanyPage =
      saved?.page === (isAdmin ? "admin-company" : "company") &&
      saved?.companyId;

    if (savedCompanyPage) {
      const { data: savedCompany, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", saved.companyId)
        .maybeSingle();

      if (!companyError && savedCompany) {
        if (!isAdmin && savedCompany.owner_id !== userId) {
          saveNavigation("supplier", null);
          setPage("supplier");
          return;
        }

        setSelectedCompany(savedCompany);
        setPage(saved.page);
        return;
      }
    }

    const defaultPage = isAdmin ? "admin" : "supplier";
    setSelectedCompany(null);
    setPage(defaultPage);
    saveNavigation(defaultPage, null);
  }

  function navigateTo(nextPage, company = null) {
    setSelectedCompany(company);
    setPage(nextPage);
    saveNavigation(nextPage, company?.id || null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();

    setSelectedCompany(null);
    setPage("home");
    saveNavigation("home", null);
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
      <style>{`
        .app input:not([type="checkbox"]):not([type="radio"]),
        .app textarea,
        .app select {
          border-radius: 10px !important;
        }

        .app input[type="date"] {
          border-radius: 10px !important;
        }

        .app button,
        .app .primary-button,
        .app .secondary-button,
        .app .small-button {
          border-radius: 10px;
        }

        .app .document-validity-options {
          gap: 8px;
          flex-wrap: wrap;
        }

        .app .selected-file {
          border-radius: 10px;
        }

        .supplier-page-title {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .supplier-page-title h1 {
          margin: 0;
        }

        .notification-bell {
          position: relative;
          width: 42px;
          height: 42px;
          min-width: 42px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d9dde3;
          background: #fff;
          color: #374151;
          cursor: pointer;
          box-shadow: none;
        }

        .notification-bell:hover {
          background: #f7f8fa;
        }

        .header-notification-bell {
          flex: 0 0 auto;
        }

        .notification-popover {
          position: fixed;
          top: 76px;
          right: 24px;
          width: min(460px, calc(100vw - 32px));
          max-height: 70vh;
          overflow: auto;
          z-index: 20;
          margin: 0 !important;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
        }

        .notification-count {
          position: absolute;
          top: -7px;
          right: -7px;
          min-width: 21px;
          height: 21px;
          padding: 0 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #e74c5b;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          border: 2px solid #fff;
        }

        .app .document-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .admin-filter-bar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 18px 0 26px;
        }

        .admin-company-section {
          margin-bottom: 34px;
        }

        .admin-section-heading,
        .admin-notification-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .admin-section-heading h2 {
          margin: 0;
        }

        .compact-empty-state {
          padding: 20px;
        }

        .admin-notification-center {
          display: block;
          margin-bottom: 22px;
        }

        .admin-notification-header p {
          margin: 4px 0 0;
        }

        .admin-notification-list {
          display: grid;
          gap: 8px;
        }

        .admin-notification-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border: 1px solid #d9dde3;
          border-radius: 10px;
          background: #fff;
          text-align: left;
          cursor: pointer;
        }

        .admin-notification-item span {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .admin-notification-item small {
          color: #6b7280;
        }

        .page {
          position: relative;
        }

        @media (max-width: 640px) {
          .notification-popover {
            top: 70px;
            right: 12px;
            width: min(460px, calc(100vw - 24px));
            max-height: 72vh;
          }
        }
      `}</style>

      <Header
        session={session}
        profile={profile}
        onHome={() => navigateTo("home")}
        onLogin={() => navigateTo("login")}
        onSignOut={handleSignOut}
        onAdmin={() => navigateTo("admin")}
        onSupplier={() => {
          navigateTo("supplier");
          setSupplierNotificationsOpen(false);
        }}
        supplierNotificationCount={supplierNotificationCount}
        onOpenSupplierNotifications={() => {
          navigateTo("supplier");
          setSupplierNotificationsOpen(true);
        }}
        adminNotificationCount={adminNotificationCount}
        onOpenAdminNotifications={() => {
          navigateTo("admin");
          setAdminNotificationsOpen(true);
        }}
      />

      {page === "home" && (
        <HomePage
          session={session}
          profile={profile}
          onStart={() => {
            if (session) {
              navigateTo(
                profile?.role === "admin"
                  ? "admin"
                  : "supplier"
              );
            } else {
              navigateTo("login");
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
              await loadProfile(
                currentSession.user.id
              );
            }
          }}
          onSignup={() => navigateTo("signup")}
          onBack={() => navigateTo("home")}
        />
      )}

      {page === "signup" && (
        <SignupPage
          onBack={() => navigateTo("login")}
          onSuccess={() => navigateTo("login")}
        />
      )}

      {page === "supplier" &&
        session &&
        profile?.role !== "admin" && (
          <SupplierDashboard
            session={session}
            profile={profile}
            notificationsOpen={supplierNotificationsOpen}
            onNotificationsOpen={() => setSupplierNotificationsOpen(true)}
            onNotificationsClose={() => setSupplierNotificationsOpen(false)}
            onNotificationCountChange={setSupplierNotificationCount}
            onOpenCompany={(company) => {
              navigateTo("company", company);
            }}
          />
        )}

      {page === "company" &&
        selectedCompany &&
        session && (
          <SupplierCompanyPage
            session={session}
            company={selectedCompany}
            onBack={() => {
              navigateTo("supplier");
            }}
          />
        )}

      {page === "admin" &&
        session &&
        profile?.role === "admin" && (
          <AdminDashboard
            session={session}
            adminProfile={profile}
            notificationsOpen={adminNotificationsOpen}
            onNotificationsOpen={() => setAdminNotificationsOpen(true)}
            onNotificationsClose={() => setAdminNotificationsOpen(false)}
            onNotificationCountChange={setAdminNotificationCount}
            onOpenCompany={(company) => {
              navigateTo("admin-company", company);
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
              navigateTo("admin");
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
  supplierNotificationCount,
  onOpenSupplierNotifications,
  adminNotificationCount,
  onOpenAdminNotifications,
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
          {session &&
            profile?.role === "admin" && (
              <>
                <button
                  type="button"
                  className="notification-bell header-notification-bell"
                  aria-label="Abrir notificações administrativas"
                  title="Notificações"
                  onClick={onOpenAdminNotifications}
                >
                  <Bell size={20} />
                  {adminNotificationCount > 0 && (
                    <span className="notification-count">
                      {adminNotificationCount > 99 ? "99+" : adminNotificationCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="header-link"
                  onClick={onAdmin}
                >
                  <ShieldCheck size={16} />
                  Administração
                </button>
              </>
            )}

          {session &&
            profile?.role !== "admin" && (
              <>
                <button
                  type="button"
                  className="notification-bell header-notification-bell"
                  aria-label="Abrir notificações"
                  title="Notificações"
                  onClick={onOpenSupplierNotifications}
                >
                  <Bell size={20} />
                  {supplierNotificationCount > 0 && (
                    <span className="notification-count">
                      {supplierNotificationCount > 99 ? "99+" : supplierNotificationCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  className="header-link"
                  onClick={onSupplier}
                >
                  <FolderOpen size={16} />
                  Meus CNPJs
                </button>
              </>
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

function HomePage({
  session,
  profile,
  onStart,
}) {
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
            Envie e acompanhe a documentação necessária
            para homologação de fornecedores da Budel
            Transportes.
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

function LoginPage({
  onSuccess,
  onSignup,
  onBack,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } =
      await supabase.auth.signInWithPassword({
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
            <p>
              Acesse o portal de homologação.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleLogin}
          className="form"
        >
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />
          </label>

          {message && (
            <div className="form-message error">
              {message}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw
                  size={17}
                  className="spin"
                />
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
          <span>
            Ainda não possui acesso?
          </span>

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

function SignupPage({
  onBack,
  onSuccess,
}) {
  const [name, setName] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");
  const [success, setSuccess] =
    useState(false);

  async function handleSignup(event) {
    event.preventDefault();

    setMessage("");

    if (password !== confirmPassword) {
      setMessage(
        "As senhas não são iguais."
      );
      return;
    }

    if (password.length < 6) {
      setMessage(
        "A senha deve ter pelo menos 6 caracteres."
      );
      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo:
            window.location.origin,
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
            Enviamos um e-mail de confirmação
            para o endereço informado.
            Confirme seu e-mail para acessar
            o portal.
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
            <p>
              Cadastre o acesso da sua empresa.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSignup}
          className="form"
        >
          <label>
            Nome
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              required
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />
          </label>

          <label>
            Confirmar senha
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value
                )
              }
              required
            />
          </label>

          {message && (
            <div className="form-message error">
              {message}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw
                  size={17}
                  className="spin"
                />
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

function SupplierDashboard({
  session,
  profile,
  onOpenCompany,
  notificationsOpen,
  onNotificationsOpen,
  onNotificationsClose,
  onNotificationCountChange,
}) {
  const [companies, setCompanies] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [showCreate, setShowCreate] =
    useState(false);
  const [message, setMessage] =
    useState("");

  async function loadCompanies() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      setMessage(error.message);
    } else {
      setCompanies(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, [session.user.id]);

  async function deleteCompany(company) {
    const confirmed = window.confirm(
      `Excluir o CNPJ ${company.cnpj}? Essa ação não poderá ser desfeita.`
    );

    if (!confirmed) return;

    const { error } =
      await supabase
        .from("companies")
        .delete()
        .eq("id", company.id)
        .eq("owner_id", session.user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadCompanies();
  }

  return (
    <main className="page">
      <div className="dashboard-heading">
        <div>
          <div className="section-kicker">
            Portal do fornecedor
          </div>

          <div className="supplier-page-title">
            <h1>Meus CNPJs</h1>

          </div>

          <p>
            {profile?.full_name
              ? `Olá, ${profile.full_name}.`
              : "Gerencie suas empresas e documentos."}
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            setShowCreate(true)
          }
        >
          <Plus size={17} />
          Cadastrar CNPJ
        </button>
      </div>

      {message && (
        <div className="form-message error">
          {message}
        </div>
      )}

      {companies.length > 0 && (
        <SupplierNotificationCenter
          session={session}
          companies={companies}
          isOpen={notificationsOpen}
          onOpen={onNotificationsOpen}
          onOpenCompany={onOpenCompany}
          onCountChange={onNotificationCountChange}
          onClose={onNotificationsClose}
        />
      )}

      {loading ? (
        <div className="loading-box">
          <RefreshCw
            size={22}
            className="spin"
          />
          Carregando...
        </div>
      ) : companies.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={38} />

          <h2>Nenhum CNPJ cadastrado</h2>

          <p>
            Cadastre o primeiro CNPJ para começar o processo de
            homologação.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setShowCreate(true)
            }
          >
            <Plus size={17} />
            Cadastrar CNPJ
          </button>
        </div>
      ) : (
        <div className="company-grid">
          {companies.map((company) => (
            <article
              className="company-card"
              key={company.id}
            >
              <button
                type="button"
                className="company-card-main"
                onClick={() =>
                  onOpenCompany(company)
                }
              >
                <div className="company-icon">
                  <FileCheck2 size={23} />
                </div>

                <div className="company-content">
                  <h2>
                    {company.legal_name}
                  </h2>

                  <p>
                    {formatCnpj(
                      company.cnpj
                    )}
                  </p>

                  <div className="company-modality">
                    {company.modality ||
                      "Serviço/atividade não informado"}
                  </div>

                  <div className="company-card-status">
                    <StatusBadge
                      status={
                        company.submission_status
                      }
                      label={getCompanyStatusLabel(
                        company.submission_status
                      )}
                    />
                  </div>
                </div>

                <ChevronRight
                  size={20}
                  className="company-arrow"
                />
              </button>

              <button
                type="button"
                className="delete-company-button"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteCompany(company);
                }}
              >
                <Trash2 size={15} />
                Excluir CNPJ
              </button>
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCompanyModal
          session={session}
          onClose={() =>
            setShowCreate(false)
          }
          onCreated={async (company) => {
            setShowCreate(false);
            await loadCompanies();
            onOpenCompany(company);
          }}
        />
      )}
    </main>
  );
}


function SupplierNotificationCenter({
  session,
  companies,
  onOpenCompany,
  onCountChange,
  onClose,
  onOpen,
  isOpen,
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      if (!companies.length) {
        if (active) {
          setNotifications([]);
          onCountChange?.(0);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const companyIds = companies.map((company) => company.id);

      const { data: documents, error } = await supabase
        .from("documents")
        .select("*")
        .in("company_id", companyIds);

      if (!active) return;

      if (error) {
        console.error(error);
        setNotifications([]);
        setLoading(false);
        return;
      }

      const companyMap = new Map(
        companies.map((company) => [company.id, company])
      );

      const items = [];

      companies.forEach((company) => {
        if (company.submission_status === "approved") {
          items.push({
            id: `company-approved-${company.id}`,
            type: "approved",
            title: "CNPJ homologado",
            text: `${company.legal_name} foi homologada pela Budel.`,
            company,
          });
        }

        if (company.submission_status === "rejected") {
          items.push({
            id: `company-rejected-${company.id}`,
            type: "rejected",
            title: "Correções necessárias",
            text:
              company.review_notes ||
              `${company.legal_name} precisa de correções antes de uma nova análise.`,
            company,
          });
        }
      });

      (documents || []).forEach((document) => {
        const company = companyMap.get(document.company_id);
        if (!company) return;

        const definition = getDocumentDefinition(document.type);
        const documentName =
          definition?.label ||
          (document.type === "outros"
            ? "Outros documentos"
            : document.type);

        if (document.review_status === "approved") {
          items.push({
            id: `document-approved-${document.id}`,
            type: "approved",
            title: "Documento aprovado",
            text: `${documentName} de ${company.legal_name} foi aprovado.`,
            company,
          });
        }

        if (document.review_status === "rejected") {
          items.push({
            id: `document-rejected-${document.id}`,
            type: "rejected",
            title: "Documento rejeitado",
            text:
              document.review_notes ||
              `${documentName} de ${company.legal_name} foi rejeitado e precisa de correção.`,
            company,
          });
        }

        if (document.not_available) {
          if (document.review_status === "pending") {
            items.push({
              id: `document-missing-${document.id}`,
              type: "pending",
              title: "Documento aguardando análise",
              text: `${documentName} foi informado como "Não possuímos essa documentação" e está aguardando análise da Budel.`,
              company,
            });
          }
        }

        if (document.not_available) return;

        if (document.type === "outros") {
          getOtherDocumentFiles(document).forEach((file, index) => {
            if (!file?.expiry_date) return;

            const days = daysUntil(file.expiry_date);
            if (days === null || days > 15) return;

            items.push({
              id: `expiry-${document.id}-${index}`,
              type: "expiry",
              title:
                days < 0
                  ? "Documento vencido"
                  : days === 0
                  ? "Documento vence hoje"
                  : "Documento próximo do vencimento",
              text: `${file.title || file.name || "Outro documento"} — ${
                days < 0
                  ? `vencido há ${Math.abs(days)} dia(s)`
                  : days === 0
                  ? "vence hoje"
                  : `vence em ${days} dia(s)`
              }.`,
              company,
            });
          });
          return;
        }

        if (definition?.expires && document.expiry_date) {
          const days = daysUntil(document.expiry_date);
          if (days !== null && days <= 15) {
            items.push({
              id: `expiry-${document.id}`,
              type: "expiry",
              title:
                days < 0
                  ? "Documento vencido"
                  : days === 0
                  ? "Documento vence hoje"
                  : "Documento próximo do vencimento",
              text: `${documentName} — ${
                days < 0
                  ? `vencido há ${Math.abs(days)} dia(s)`
                  : days === 0
                  ? "vence hoje"
                  : `vence em ${days} dia(s)`
              }.`,
              company,
            });
          }
        }
      });

      items.sort((a, b) => {
        const priority = {
          rejected: 0,
          expiry: 1,
          pending: 2,
          approved: 3,
        };
        return (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
      });

      setNotifications(items);
      // Se a caixinha já estiver aberta, as notificações já foram visualizadas.
      // O contador só aparece novamente quando a caixinha estiver fechada e houver novos avisos.
      if (!isOpen) {
        onCountChange?.(items.length);
      }
      setLoading(false);
    }

    loadNotifications();

    return () => {
      active = false;
    };
  }, [companies, isOpen]);

  useEffect(() => {
    if (isOpen) {
      onCountChange?.(0);
    }
  }, [isOpen]);

  const visibleNotifications = notifications;

  if (!isOpen) return null;

  return (
    <section className="notice-card info notification-popover supplier-notification-popover" style={{ display: "block" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Bell size={20} />
          <div>
            <strong>Central de notificações</strong>
            <p style={{ marginBottom: 0 }}>
              Todas as atualizações dos seus CNPJs em um só lugar.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="status-badge">
            {notifications.length} aviso(s)
          </span>
          <button
            type="button"
            className="secondary-button small-button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-box" style={{ marginTop: "16px" }}>
          <RefreshCw size={18} className="spin" />
          Carregando notificações...
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "16px" }}>
          <CheckCircle2 size={28} />
          <h2>Nenhuma notificação</h2>
          <p>Não há avisos nesta categoria no momento.</p>
        </div>
      ) : (
        <div
          className="documents-list"
          style={{ marginTop: "16px" }}
        >
          {visibleNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="notice-card"
              style={{
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                border: "1px solid var(--viz-border, #ddd)",
                background: "transparent",
              }}
              onClick={() => {
                onClose?.();
                onOpenCompany(notification.company);
              }}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.text}</p>
                <span className="text-button">
                  Abrir CNPJ
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CreateCompanyModal({
  session,
  onClose,
  onCreated,
}) {
  const [legalName, setLegalName] =
    useState("");
  const [cnpj, setCnpj] =
    useState("");
  const [modality, setModality] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");

  async function handleCreate(event) {
    event.preventDefault();

    setMessage("");

    const cleanCnpj =
      cnpj.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      setMessage(
        "Informe um CNPJ válido com 14 números."
      );
      return;
    }

    setLoading(true);

    const { data, error } =
      await supabase
        .from("companies")
        .insert({
          owner_id: session.user.id,
          legal_name: legalName.trim(),
          cnpj: cleanCnpj,
          modality: modality.trim(),
          submission_status: "draft",
        })
        .select()
        .single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    onCreated(data);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="modal-heading">
          <div className="modal-icon">
            <Plus size={20} />
          </div>

          <div>
            <h2>Cadastrar CNPJ</h2>
            <p>
              Informe os dados da empresa.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="form"
        >
          <label>
            Razão Social
            <input
              value={legalName}
              onChange={(event) =>
                setLegalName(
                  event.target.value
                )
              }
              required
            />
          </label>

          <label>
            CNPJ
            <input
              value={formatCnpj(cnpj)}
              onChange={(event) =>
                setCnpj(
                  event.target.value
                )
              }
              placeholder="00.000.000/0000-00"
              required
            />
          </label>

          <label>
            Serviço/atividade fornecida à Budel
            <textarea
              value={modality}
              onChange={(event) =>
                setModality(
                  event.target.value
                )
              }
              placeholder="Ex.: Lavagem de caminhões, manutenção de suspensão, solda..."
              rows={4}
              required
            />
          </label>

          {message && (
            <div className="form-message error">
              {message}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw
                    size={16}
                    className="spin"
                  />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salvar CNPJ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SupplierCompanyPage({
  session,
  company,
  onBack,
}) {
  const [documents, setDocuments] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");
  const [saving, setSaving] =
    useState(false);
  const [submissionLoading, setSubmissionLoading] =
    useState(false);

  async function loadDocuments() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("documents")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      setMessage(error.message);
    } else {
      setDocuments(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [company.id]);

  async function saveDocument(payload) {
    setSaving(true);
    setMessage("");

    const existing =
      documents.find(
        (item) =>
          item.type === payload.type
      );

    const files =
      payload.not_available
        ? []
        : payload.files ||
          getDocumentFiles(existing);

    const firstFile =
      files?.[0] || null;

    const hasNewFiles =
      Boolean(payload.files?.length);

    const wasRejected =
      existing?.review_status ===
      "rejected";

    const updateData = {
      company_id: company.id,
      type: payload.type,

      file_path:
        firstFile?.path || null,

      original_name:
        firstFile?.name || null,

      files,

      issue_date: null,

      expiry_date:
        payload.expiry_type === "definitive"
          ? null
          : payload.expiry_date || null,

      expiry_text:
        payload.expiry_type === "definitive"
          ? "Licença definitiva"
          : "",

      not_available:
        Boolean(payload.not_available),

      notes:
        payload.notes ||
        existing?.notes ||
        null,

      review_status:
        wasRejected &&
        (hasNewFiles ||
          payload.not_available)
          ? "pending"
          : existing?.review_status ||
            "pending",

      reviewed_at:
        wasRejected &&
        (hasNewFiles ||
          payload.not_available)
          ? null
          : existing?.reviewed_at ||
            null,

      reviewed_by:
        wasRejected &&
        (hasNewFiles ||
          payload.not_available)
          ? null
          : existing?.reviewed_by ||
            null,

      review_notes:
        wasRejected &&
        (hasNewFiles ||
          payload.not_available)
          ? null
          : existing?.review_notes ||
            null,
    };

    const { error } =
      await supabase
        .from("documents")
        .upsert(
          updateData,
          {
            onConflict:
              "company_id,type",
          }
        );

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return false;
    }

    await loadDocuments();

    setSaving(false);
    return true;
  }

  async function uploadFiles(
    type,
    files
  ) {
    const uploaded = [];

    for (const file of files) {
      const safeName =
        file.name
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            ""
          )
          .replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

      const path = `${session.user.id}/${company.id}/${type}/${Date.now()}_${safeName}`;

      const { error } =
        await supabase.storage
          .from(
            "supplier-documents"
          )
          .upload(
            path,
            file,
            {
              upsert: false,
            }
          );

      if (error) {
        throw error;
      }

      uploaded.push({
        path,
        name: file.name,
      });
    }

    return uploaded;
  }

  async function handleDocumentSave(
    type,
    data
  ) {
    try {
      if (
        type === "outros"
      ) {
        let otherFiles =
          data.otherFiles || [];

        const newFileObjects =
          otherFiles.filter(
            (item) => item.file
          );

        if (
          newFileObjects.length
        ) {
          const uploaded =
            await uploadFiles(
              type,
              newFileObjects.map(
                (item) => item.file
              )
            );

          let uploadIndex = 0;

          otherFiles =
            otherFiles.map(
              (item) => {
                if (!item.file) {
                  return item;
                }

                const uploadedFile =
                  uploaded[
                    uploadIndex
                  ];

                uploadIndex += 1;

                return {
                  ...item,
                  path:
                    uploadedFile.path,
                  name:
                    uploadedFile.name,
                  file: null,
                };
              }
            );
        }

        const cleanedFiles =
          otherFiles.map(
            (file) => ({
              path:
                file.path || "",
              name:
                file.name ||
                "Documento",
              title:
                file.title ||
                file.name ||
                "Documento",
              expiry_date:
                file.expiry_type === "definitive"
                  ? ""
                  : file.expiry_date || "",
              expiry_type:
                file.expiry_type === "definitive"
                  ? "definitive"
                  : "date",
              expiry_text:
                file.expiry_type === "definitive"
                  ? "Licença definitiva"
                  : "",
            })
          );

        await saveDocument({
          ...data,
          type,
          files:
            cleanedFiles,
          not_available:
            Boolean(
              data.not_available
            ),
        });

        return;
      }

      let files =
        data.files || [];

      if (
        data.fileObjects?.length
      ) {
        const uploaded =
          await uploadFiles(
            type,
            data.fileObjects
          );

        files = [
          ...files,
          ...uploaded,
        ];
      }

      await saveDocument({
        ...data,
        type,
        files,
      });
    } catch (error) {
      setMessage(
        error.message ||
          "Não foi possível enviar o arquivo."
      );

      setSaving(false);
    }
  }

  async function submitForApproval() {
    setSubmissionLoading(true);
    setMessage("");

    const missing = [];

    for (const item of DOCUMENTS) {
      const document =
        documents.find(
          (doc) =>
            doc.type === item.type
        );

      const files =
        getDocumentFiles(
          document
        );

      if (item.required) {
        if (
          !files.length ||
          document?.not_available
        ) {
          missing.push(
            `${item.label} — documento obrigatório`
          );
          continue;
        }
      } else if (
        !files.length &&
        !document?.not_available
      ) {
        missing.push(
          `${item.label} — envie o documento ou marque "Não possuímos"`
        );
        continue;
      }

      if (
        item.type === "outros"
      ) {
        if (
          document?.not_available
        ) {
          continue;
        }

        if (!files.length) {
          missing.push(
            `${item.label} — envie pelo menos um documento ou marque "Não possuímos"`
          );
          continue;
        }

        files.forEach(
          (file, index) => {
            const number =
              index + 1;

            if (
              !file?.title?.trim()
            ) {
              missing.push(
                `${item.label} — documento ${number}: informe o título`
              );
            }

            if (
              file?.expiry_type !== "date" &&
              file?.expiry_type !== "definitive"
            ) {
              missing.push(
                `${item.label} — documento ${number}: selecione "Vencimento" ou "Licença definitiva"`
              );
            }

            if (file?.expiry_type === "date") {
              if (
                !file?.expiry_date ||
                !isValidDate(file.expiry_date)
              ) {
                missing.push(
                  `${item.label} — documento ${number}: informe uma data de vencimento válida`
                );
              } else {
                const days =
                  daysUntil(file.expiry_date);

                if (
                  days !== null &&
                  days < 0
                ) {
                  missing.push(
                    `${item.label} — documento ${number}: documento vencido`
                  );
                }
              }
            }
          }
        );

        continue;
      }

      if (
        item.expires &&
        files.length
      ) {
        const documentExpiryType =
          getDocumentExpiryType(document);

        if (
          documentExpiryType !== "date" &&
          documentExpiryType !== "definitive"
        ) {
          missing.push(
            `${item.label} — selecione "Vencimento" ou "Licença definitiva"`
          );
        }

        if (
          documentExpiryType === "date"
        ) {
          if (
            !document?.expiry_date ||
            !isValidDate(
              document.expiry_date
            )
          ) {
            missing.push(
              `${item.label} — informe uma data de vencimento válida`
            );
          } else {
            const days =
              daysUntil(
                document.expiry_date
              );

            if (
              days !== null &&
              days < 0
            ) {
              missing.push(
                `${item.label} — documento vencido`
              );
            }
          }
        }
      }
    }

    if (missing.length) {
      setMessage(
        `Não é possível enviar para homologação. Corrija:\n• ${missing.join(
          "\n• "
        )}`
      );

      setSubmissionLoading(false);
      return;
    }

    const wasCorrection =
      company.submission_status === "rejected";

    const {
      data,
      error,
    } = await supabase
      .from("companies")
      .update({
        submission_status:
          "submitted",
        submitted_at:
          new Date().toISOString(),
      })
      .eq("id", company.id)
      .eq(
        "owner_id",
        session.user.id
      )
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      setSubmissionLoading(false);
      return;
    }

    Object.assign(
      company,
      data
    );

    await recordAdminActivity(
      wasCorrection ? "correction" : "submission",
      company.id
    );

    setMessage(
      "Documentação enviada para homologação com sucesso."
    );

    setSubmissionLoading(false);

    setTimeout(() => {
      onBack();
    }, 700);
  }

  return (
    <main className="page">
      <div className="dashboard-heading">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            Meus CNPJs
          </button>

          <div className="section-kicker">
            Fornecedor
          </div>

          <h1>
            {company.legal_name}
          </h1>

          <p>
            CNPJ:{" "}
            {formatCnpj(
              company.cnpj
            )}
            <br />
            Serviço/atividade:{" "}
            {company.modality ||
              "Não informado"}
          </p>
        </div>

        <StatusBadge
          status={
            company.submission_status
          }
          label={getCompanyStatusLabel(
            company.submission_status
          )}
        />
      </div>

      {company.submission_status ===
        "rejected" && (
        <div className="notice-card warning">
          <AlertCircle size={20} />

          <div>
            <strong>
              Correções necessárias
            </strong>

            <p>
              Alguns documentos ou informações precisam ser corrigidos.
              Após corrigir, envie novamente para homologação.
            </p>

            {company.review_notes && (
              <p>
                <strong>
                  Observação da Budel:
                </strong>{" "}
                {company.review_notes}
              </p>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className="form-message info pre-line">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-box">
          <RefreshCw
            size={22}
            className="spin"
          />
          Carregando documentos...
        </div>
      ) : (
        <div className="documents-list">
          {DOCUMENTS.map(
            (item) => (
              <SupplierDocumentCard
                key={item.type}
                item={item}
                document={documents.find(
                  (doc) =>
                    doc.type ===
                    item.type
                )}
                onSave={(data) =>
                  handleDocumentSave(
                    item.type,
                    data
                  )
                }
                saving={saving}
              />
            )
          )}
        </div>
      )}

      <div className="submit-section">
        <div>
          <h2>
            Finalizar envio
          </h2>

          <p>
            Confira todos os documentos e envie a documentação para
            análise da Budel.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={
            submitForApproval
          }
          disabled={
            submissionLoading ||
            company.submission_status ===
              "submitted" ||
            company.submission_status ===
              "approved"
          }
        >
          {submissionLoading ? (
            <>
              <RefreshCw
                size={17}
                className="spin"
              />
              Enviando...
            </>
          ) : company.submission_status ===
            "submitted" ? (
            <>
              <Check size={17} />
              Enviado para homologação
            </>
          ) : (
            <>
              <Send size={17} />
              Enviar para homologação
            </>
          )}
        </button>
      </div>
    </main>
  );
}

function SupplierDocumentCard({
  item,
  document,
  onSave,
  saving,
}) {
  const isOther =
    item.type === "outros";

  const [files, setFiles] =
    useState([]);

  const [expiryDate, setExpiryDate] =
    useState(
      document?.expiry_date || ""
    );

  const [expiryType, setExpiryType] =
    useState(
      getDocumentExpiryType(document)
    );

  const [notAvailable, setNotAvailable] =
    useState(
      Boolean(document?.not_available)
    );

  const [fileObjects, setFileObjects] =
    useState([]);

  const [otherFiles, setOtherFiles] =
    useState([]);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const currentFiles =
      getDocumentFiles(document);

    setFiles(currentFiles);
    setExpiryDate(
      document?.expiry_date || ""
    );
    setExpiryType(
      getDocumentExpiryType(document)
    );
    setNotAvailable(
      Boolean(document?.not_available)
    );
    setFileObjects([]);

    if (isOther) {
      const normalized =
        getOtherDocumentFiles(document).map(
          (file, index) => ({
            ...file,
            localId:
              `existing-${index}-${file.path}`,
            file: null,
          })
        );

      setOtherFiles(normalized);
    } else {
      setOtherFiles([]);
    }

    setMessage("");
  }, [document, isOther]);

  function handleFiles(event) {
    const selected = Array.from(
      event.target.files || []
    );

    if (!selected.length) return;

    if (item.multiple) {
      setFileObjects((current) => [
        ...current,
        ...selected,
      ]);
    } else {
      setFileObjects([selected[0]]);
    }

    setNotAvailable(false);
    event.target.value = "";
  }

  function handleOtherFiles(event) {
    const selected = Array.from(
      event.target.files || []
    );

    if (!selected.length) return;

    setOtherFiles((current) => [
      ...current,
      ...selected.map((file, index) => ({
        localId:
          `new-${Date.now()}-${index}`,
        file,
        path: "",
        name: file.name,
        title: file.name,
        expiry_date: "",
        expiry_type: "",
        expiry_text: "",
      })),
    ]);

    setNotAvailable(false);
    event.target.value = "";
  }

  function updateOtherFile(
    localId,
    field,
    value
  ) {
    setOtherFiles((current) =>
      current.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: value,
              ...(field === "expiry_type"
                ? value === "definitive"
                  ? {
                      expiry_date: "",
                      expiry_text:
                        "Licença definitiva",
                    }
                  : value === "date"
                  ? { expiry_text: "" }
                  : {
                      expiry_date: "",
                      expiry_text: "",
                    }
                : {}),
              ...(field === "expiry_date" &&
              value
                ? {
                    expiry_type: "date",
                    expiry_text: "",
                  }
                : {}),
            }
          : item
      )
    );
  }

  function removeOtherFile(localId) {
    setOtherFiles((current) =>
      current.filter(
        (item) => item.localId !== localId
      )
    );
  }

  function removeSelectedFile(index) {
    setFileObjects((current) =>
      current.filter(
        (_file, fileIndex) =>
          fileIndex !== index
      )
    );
  }

  async function handleSave() {
    setMessage("");

    if (isOther) {
      if (
        !otherFiles.length &&
        !notAvailable
      ) {
        setMessage(
          'Adicione pelo menos um documento ou marque "Não possuímos essa documentação".'
        );
        return;
      }

      if (notAvailable) {
        const success = await onSave({
          otherFiles: [],
          files: [],
          not_available: true,
          expiry_type: "",
          expiry_date: "",
        });

        if (success !== false) {
          setOtherFiles([]);
          setFileObjects([]);
        }
        return;
      }

      for (
        let index = 0;
        index < otherFiles.length;
        index += 1
      ) {
        const file = otherFiles[index];

        if (!file.title?.trim()) {
          setMessage(
            `Documento ${index + 1}: informe o título.`
          );
          return;
        }

        if (
          file.expiry_type !== "date" &&
          file.expiry_type !== "definitive"
        ) {
          setMessage(
            `Documento ${index + 1}: selecione "Vencimento" ou "Licença definitiva".`
          );
          return;
        }

        if (file.expiry_type === "date") {
          if (
            !file.expiry_date ||
            !isValidDate(file.expiry_date)
          ) {
            setMessage(
              `Documento ${index + 1}: informe uma data de vencimento válida.`
            );
            return;
          }

          if (daysUntil(file.expiry_date) < 0) {
            setMessage(
              `Documento ${index + 1}: a data de vencimento já passou.`
            );
            return;
          }
        }

        if (!file.path && !file.file) {
          setMessage(
            `Documento ${index + 1}: arquivo não encontrado.`
          );
          return;
        }
      }

      const success = await onSave({
        otherFiles,
        files: otherFiles.filter(
          (file) => file.path
        ),
        not_available: false,
        expiry_type: "",
        expiry_date: "",
      });

      if (success !== false) {
        setFileObjects([]);
      }
      return;
    }

    if (
      item.required &&
      !files.length &&
      !fileObjects.length
    ) {
      setMessage(
        "Este documento é obrigatório."
      );
      return;
    }

    if (
      !item.required &&
      !files.length &&
      !fileObjects.length &&
      !notAvailable
    ) {
      setMessage(
        'Envie o documento ou marque "Não possuímos essa documentação".'
      );
      return;
    }

    if (
      item.expires &&
      (files.length || fileObjects.length) &&
      !notAvailable
    ) {
      if (
        expiryType !== "date" &&
        expiryType !== "definitive"
      ) {
        setMessage(
          'Selecione "Vencimento" ou "Licença definitiva".'
        );
        return;
      }

      if (expiryType === "date") {
        if (
          !expiryDate ||
          !isValidDate(expiryDate)
        ) {
          setMessage(
            "Informe uma data de vencimento válida."
          );
          return;
        }

        if (daysUntil(expiryDate) < 0) {
          setMessage(
            "A data de vencimento informada já passou."
          );
          return;
        }
      }
    }

    const success = await onSave({
      files,
      fileObjects,
      expiry_type: item.expires
        ? expiryType
        : "",
      expiry_date:
        item.expires &&
        expiryType === "date"
          ? expiryDate
          : "",
      not_available: notAvailable,
    });

    if (success !== false) {
      setFileObjects([]);
    }
  }

  const status =
    item.expires && !isOther
      ? getDocumentExpiryStatus(document)
      : null;

  const rejected =
    document?.review_status === "rejected";

  return (
    <article className="document-card">
      <div className="document-top">
        <div className="document-title">
          <div className="document-icon">
            {item.type === "fotos_local" ? (
              <ImageIcon size={21} />
            ) : (
              <FileText size={21} />
            )}
          </div>

          <div>
            <h3>
              {item.label}{" "}
              {item.required && (
                <span className="required-mark">
                  *
                </span>
              )}
            </h3>

            <p>{item.description}</p>
          </div>
        </div>

        <div className="document-status-group">
          {status && (
            <span
              className={`status-badge ${status.className}`}
            >
              {status.label}
            </span>
          )}

          {document?.review_status && (
            <span
              className={`status-badge ${
                document.review_status === "approved"
                  ? "status-ok"
                  : document.review_status === "rejected"
                  ? "status-danger"
                  : ""
              }`}
            >
              {STATUS_LABELS[document.review_status]}
            </span>
          )}
        </div>
      </div>

      <div className="document-body">
        {rejected && (
          <div className="notice-card warning">
            <AlertCircle size={18} />
            <div>
              <strong>Documento rejeitado</strong>
              {document.review_notes && (
                <p>{document.review_notes}</p>
              )}
              <p>
                Envie uma nova versão para análise.
              </p>
            </div>
          </div>
        )}

        {isOther ? (
          <>
            <label className="upload-area">
              <Upload size={25} />
              {otherFiles.length ? (
                <>
                  <strong>
                    {otherFiles.length} documento(s)
                    selecionado(s)
                  </strong>
                  <span>Clique para adicionar mais</span>
                </>
              ) : (
                <>
                  <strong>
                    Clique para selecionar os arquivos
                  </strong>
                  <span>
                    Você pode adicionar vários documentos
                  </span>
                </>
              )}
              <input
                type="file"
                multiple
                onChange={handleOtherFiles}
              />
            </label>

            {otherFiles.length > 0 && (
              <div className="selected-files">
                {otherFiles.map((file, index) => {
                  const fileStatus =
                    getOtherDocumentExpiryStatus(file);

                  return (
                    <div
                      className="other-document-editor"
                      key={
                        file.localId ||
                        `${file.path}-${index}`
                      }
                    >
                      <div className="selected-file">
                        <FileText size={16} />
                        <span>{file.name}</span>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            removeOtherFile(
                              file.localId
                            )
                          }
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <label>
                        Título do documento
                        <input
                          type="text"
                          value={file.title || ""}
                          onChange={(event) =>
                            updateOtherFile(
                              file.localId,
                              "title",
                              event.target.value
                            )
                          }
                          placeholder="Ex.: Licença Ambiental"
                        />
                      </label>

                      <div className="document-validity-row">
                        <div>
                          <span className="document-validity-label">
                            Validade
                          </span>
                          <div className="document-validity-options">
                            <button
                              type="button"
                              className={
                                file.expiry_type === "date"
                                  ? "primary-button small-button"
                                  : "secondary-button small-button"
                              }
                              onClick={() =>
                                updateOtherFile(
                                  file.localId,
                                  "expiry_type",
                                  "date"
                                )
                              }
                            >
                              Vencimento
                            </button>
                            <button
                              type="button"
                              className={
                                file.expiry_type === "definitive"
                                  ? "primary-button small-button"
                                  : "secondary-button small-button"
                              }
                              onClick={() =>
                                updateOtherFile(
                                  file.localId,
                                  "expiry_type",
                                  "definitive"
                                )
                              }
                            >
                              Licença definitiva
                            </button>
                          </div>
                        </div>

                        {file.expiry_type === "date" && (
                          <label>
                            Data de vencimento
                            <input
                              type="date"
                              value={file.expiry_date || ""}
                              onChange={(event) =>
                                updateOtherFile(
                                  file.localId,
                                  "expiry_date",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        )}
                      </div>

                      {file.expiry_type && (
                        <div className="required-document-notice">
                          <Info size={15} />
                          Validade: {fileStatus.label}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="required-document-notice">
              <Info size={15} />
              Para cada documento, selecione "Vencimento" e informe a data, ou selecione "Licença definitiva".
            </div>
          </>
        ) : (
          <>
            <label className="upload-area">
              <Upload size={25} />
              {fileObjects.length ? (
                <>
                  <strong>
                    {fileObjects.length} arquivo(s)
                    selecionado(s)
                  </strong>
                  <span>Clique para alterar</span>
                </>
              ) : files.length ? (
                <>
                  <strong>
                    {files.length} arquivo(s) já enviado(s)
                  </strong>
                  <span>
                    Clique para adicionar/substituir
                  </span>
                </>
              ) : (
                <>
                  <strong>
                    Clique para selecionar {""}
                    {item.multiple
                      ? "os arquivos"
                      : "o arquivo"}
                  </strong>
                  <span>
                    PDF, JPG, PNG ou outro formato permitido
                  </span>
                </>
              )}
              <input
                type="file"
                multiple={Boolean(item.multiple)}
                onChange={handleFiles}
              />
            </label>

            {fileObjects.length > 0 && (
              <div className="selected-files">
                {fileObjects.map((file, index) => (
                  <div
                    className="selected-file"
                    key={`${file.name}-${index}`}
                  >
                    <FileText size={16} />
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() =>
                        removeSelectedFile(index)
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && !fileObjects.length && (
              <div className="selected-files">
                {files.map((file, index) => (
                  <div
                    className="selected-file"
                    key={`${file.path}-${index}`}
                  >
                    <FileText size={16} />
                    <span>{file.name}</span>
                  </div>
                ))}
              </div>
            )}

            {item.expires && (
              <div className="document-validity-row">
                <div>
                  <span className="document-validity-label">
                    Validade
                  </span>
                  <div className="document-validity-options">
                    <button
                      type="button"
                      className={
                        expiryType === "date"
                          ? "primary-button small-button"
                          : "secondary-button small-button"
                      }
                      onClick={() => {
                        setExpiryType("date");
                        setNotAvailable(false);
                      }}
                    >
                      Vencimento
                    </button>
                    <button
                      type="button"
                      className={
                        expiryType === "definitive"
                          ? "primary-button small-button"
                          : "secondary-button small-button"
                      }
                      onClick={() => {
                        setExpiryType("definitive");
                        setExpiryDate("");
                        setNotAvailable(false);
                      }}
                    >
                      Licença definitiva
                    </button>
                  </div>
                </div>

                {expiryType === "date" && (
                  <label>
                    Data de vencimento
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(event) =>
                        setExpiryDate(
                          event.target.value
                        )
                      }
                    />
                  </label>
                )}
              </div>
            )}

            {item.expires && (
              <div className="required-document-notice">
                <Info size={15} />
                Selecione "Vencimento" para informar a data ou "Licença definitiva" quando o documento não tiver vencimento.
              </div>
            )}
          </>
        )}

        {!item.required && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notAvailable}
              onChange={(event) => {
                const checked = event.target.checked;
                setNotAvailable(checked);
                if (checked) {
                  setFileObjects([]);
                  setExpiryType("");
                  setExpiryDate("");
                  if (isOther) {
                    setOtherFiles([]);
                  }
                }
              }}
            />
            Não possuímos essa documentação
          </label>
        )}

        {item.required && (
          <div className="required-document-notice">
            <Info size={15} />
            Este documento é obrigatório.
          </div>
        )}

        {message && (
          <div className="form-message error">
            {message}
          </div>
        )}

        <div className="document-actions">
          {item.type === "checklist" && (
            <a
              className="secondary-button small-button"
              href="/checklist/F103-04 - CheckList de Inspeção de Fornecedores.docx"
              download
            >
              <Download size={16} />
              Baixar F103-04
            </a>
          )}

          <button
            type="button"
            className="secondary-button small-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw
                  size={15}
                  className="spin"
                />
                Salvando...
              </>
            ) : (
              <>
                <Save size={15} />
                Salvar documento
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

function AdminDashboard({
  session,
  adminProfile,
  notificationsOpen,
  onNotificationsOpen,
  onNotificationsClose,
  onNotificationCountChange,
  onOpenCompany,
}) {
  const [companies, setCompanies] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [message, setMessage] =
    useState("");
  const [showCreateAdmin, setShowCreateAdmin] =
    useState(false);

  const [companyFilter, setCompanyFilter] =
    useState("all");

  const canManageUsers =
    adminCanManageUsers(
      adminProfile
    );

  const canReview =
    adminCanReview(
      adminProfile
    );

  const viewOnly =
    adminIsViewOnly(
      adminProfile
    );

  async function loadCompanies() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("companies")
        .select("*")
        .neq(
          "submission_status",
          "draft"
        )
        .order(
          "submitted_at",
          {
            ascending: false,
            nullsFirst: false,
          }
        );

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const visible =
      (data || []).filter(
        (company) =>
          adminCanViewCompany(
            adminProfile,
            company.modality
          )
      );

    setCompanies(
      visible
    );

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, [
    adminProfile?.id,
    adminProfile?.admin_keywords,
    adminProfile?.admin_can_manage_users,
  ]);

  const companiesInApproval = companies.filter(
    (company) => company.submission_status !== "approved"
  );

  const homologatedCompanies = companies.filter(
    (company) => company.submission_status === "approved"
  );

  const visibleCompanies =
    companyFilter === "pending"
      ? companiesInApproval
      : companyFilter === "approved"
      ? homologatedCompanies
      : companies;

  async function exportExcel() {
    if (!companies.length)
      return;

    try {
      setMessage("");

      const companyIds =
        companies.map(
          (company) =>
            company.id
        );

      const profileIds = [
        ...new Set(
          companies
            .flatMap((company) => [
              company.owner_id,
              company.reviewed_by,
            ])
            .filter(Boolean)
        ),
      ];

      const [
        {
          data: documentsData,
          error: documentsError,
        },
        {
          data: profilesData,
          error: profilesError,
        },
      ] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .in(
            "company_id",
            companyIds
          ),

        supabase
          .from("profiles")
          .select(
            "id, full_name, email"
          )
          .in(
            "id",
            profileIds
          ),
      ]);

      if (documentsError)
        throw documentsError;

      if (profilesError)
        throw profilesError;

      const documentsByCompany =
        {};

      (
        documentsData || []
      ).forEach(
        (document) => {
          if (
            !documentsByCompany[
              document.company_id
            ]
          ) {
            documentsByCompany[
              document.company_id
            ] = {};
          }

          documentsByCompany[
            document.company_id
          ][document.type] =
            document;
        }
      );

      const profilesById =
        {};

      (
        profilesData || []
      ).forEach(
        (profile) => {
          profilesById[
            profile.id
          ] = profile;
        }
      );

      const rows =
        companies.map(
          (company) => {
            const owner =
              profilesById[
                company.owner_id
              ] || {};

            const companyDocuments =
              documentsByCompany[
                company.id
              ] || {};

            const row = {
              "Nome do fornecedor":
                owner.full_name ||
                "",

              "E-mail do fornecedor":
                owner.email || "",

              "Razão Social":
                company.legal_name ||
                "",

              CNPJ:
                formatCnpj(
                  company.cnpj
                ),

              "Serviço/atividade":
                company.modality ||
                "",

              "Status da homologação":
                getCompanyStatusLabel(
                  company.submission_status
                ),

              "Data de envio":
                formatDate(
                  company.submitted_at?.slice(
                    0,
                    10
                  )
                ),

              "Data de análise":
                formatDate(
                  company.reviewed_at?.slice(
                    0,
                    10
                  )
                ),

              "Aprovado por":
                company.submission_status === "approved"
                  ? profilesById[company.reviewed_by]?.full_name ||
                    profilesById[company.reviewed_by]?.email ||
                    ""
                  : "",

              "Observação geral":
                company.review_notes ||
                "",
            };

            DOCUMENTS.forEach(
              (item) => {
                const document =
                  companyDocuments[
                    item.type
                  ];

                const documentFiles =
                  getDocumentFiles(
                    document
                  );

                if (
                  item.type ===
                  "outros"
                ) {
                  const otherFiles =
                    getOtherDocumentFiles(
                      document
                    );

                  row[
                    `${item.label} - Documento`
                  ] =
                    otherFiles.length
                      ? otherFiles
                          .map(
                            (
                              file
                            ) =>
                              file.name
                          )
                          .join(
                            " | "
                          )
                      : document?.not_available
                      ? "Não possui documentação"
                      : "";

                  row[
                    `${item.label} - Data de vencimento`
                  ] =
                    otherFiles.length
                      ? otherFiles
                          .map(
                            (
                              file
                            ) =>
                              `${file.title}: ${getOtherDocumentExpiryLabel(
                                file
                              )}`
                          )
                          .join(
                            " | "
                          )
                      : document?.not_available
                      ? "Não possui documentação"
                      : "";

                  row[
                    `${item.label} - Status`
                  ] =
                    document?.not_available
                      ? "Não possui documentação"
                      : otherFiles.length
                      ? otherFiles
                          .map(
                            (
                              file,
                              index
                            ) => {
                              const status =
                                getOtherDocumentExpiryStatus(
                                  file
                                );

                              return `${index + 1}. ${file.title}: ${status.label}`;
                            }
                          )
                          .join(
                            " | "
                          )
                      : "Não enviado";

                  row[
                    `${item.label} - Observação`
                  ] =
                    otherFiles.length
                      ? otherFiles
                          .map(
                            (
                              file,
                              index
                            ) =>
                              `${index + 1}. Título: ${file.title} | Arquivo: ${file.name} | Validade: ${getOtherDocumentExpiryLabel(
                                file
                              )}`
                          )
                          .join(
                            "\n"
                          )
                      : document?.not_available
                      ? "Não possuímos essa documentação"
                      : "";

                  row[
                    `${item.label} - Aprovado por`
                  ] =
                    document?.review_status === "approved"
                      ? profilesById[document.reviewed_by]?.full_name ||
                        profilesById[document.reviewed_by]?.email ||
                        ""
                      : "";

                  return;
                }

                row[
                  `${item.label} - Documento`
                ] =
                  documentFiles
                    .map(
                      (file) =>
                        file.name
                    )
                    .join(" | ");

                row[
                  `${item.label} - Data de vencimento`
                ] =
                  !item.expires
                    ? ""
                    : getDocumentExpiryType(document) ===
                    "definitive"
                    ? "Licença definitiva"
                    : formatDate(
                        document?.expiry_date
                      );

                row[
                  `${item.label} - Status`
                ] =
                  document?.not_available
                    ? "Não possui documentação"
                    : document?.review_status
                    ? STATUS_LABELS[
                        document
                          .review_status
                      ] ||
                      document.review_status
                    : documentFiles.length
                    ? "Aguardando análise"
                    : "Não enviado";

                row[
                  `${item.label} - Observação`
                ] =
                  document?.review_notes ||
                  "";

                row[
                  `${item.label} - Aprovado por`
                ] =
                  document?.review_status === "approved"
                    ? profilesById[document.reviewed_by]?.full_name ||
                      profilesById[document.reviewed_by]?.email ||
                      ""
                    : "";
              }
            );

            return row;
          }
        );

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      worksheet["!cols"] = [
        { wch: 28 },
        { wch: 34 },
        { wch: 32 },
        { wch: 20 },
        { wch: 38 },
        { wch: 24 },
        { wch: 15 },
        { wch: 15 },
        { wch: 35 },
        { wch: 28 },

        ...DOCUMENTS.flatMap(
          (item) =>
            item.type ===
            "outros"
              ? [
                  { wch: 35 },
                  { wch: 45 },
                  { wch: 35 },
                  { wch: 70 },
                  { wch: 28 },
                ]
              : [
                  { wch: 35 },
                  { wch: 20 },
                  { wch: 24 },
                  { wch: 35 },
                  { wch: 28 },
                ]
        ),
      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Homologação"
      );

      XLSX.writeFile(
        workbook,
        `relatorio-homologacao-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error?.message ||
          "Não foi possível gerar o relatório para Excel."
      );
    }
  }

  return (
    <main className="page">
      <div className="dashboard-heading">
        <div>
          <div className="section-kicker">
            Área administrativa
          </div>

          <h1>
            Homologação de fornecedores
          </h1>

          <p>
            Empresas que já foram enviadas para análise.
          </p>
        </div>

        <div className="dashboard-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={
              exportExcel
            }
            disabled={
              !companies.length
            }
          >
            <FileDown size={17} />
            Exportar para Excel
          </button>

          {canManageUsers && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setShowCreateAdmin(
                  true
                )
              }
            >
              <UserPlus size={17} />
              Cadastrar administrador
            </button>
          )}
        </div>
      </div>

      {viewOnly && (
        <div className="notice-card info">
          <Eye size={19} />

          <div>
            <strong>
              Modo somente visualização
            </strong>

            <p>
              Você pode consultar as empresas e documentos, mas não pode
              aprovar ou rejeitar.
            </p>
          </div>
        </div>
      )}

      {!canReview &&
        !viewOnly && (
          <div className="notice-card info">
            <KeyRound size={19} />

            <div>
              <strong>
                Acesso por categoria
              </strong>

              <p>
                Você visualiza as empresas relacionadas às palavras-chave
                cadastradas no seu perfil.
              </p>
            </div>
          </div>
        )}

      <AdminActivityNotificationCenter
        session={session}
        isOpen={notificationsOpen}
        onOpen={onNotificationsOpen}
        onClose={onNotificationsClose}
        onCountChange={onNotificationCountChange}
        onOpenCompany={onOpenCompany}
      />

      {message && (
        <div className="form-message error">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-box">
          <RefreshCw
            size={22}
            className="spin"
          />
          Carregando empresas...
        </div>
      ) : companies.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={38} />

          <h2>
            Nenhuma empresa disponível
          </h2>

          <p>
            No momento não há empresas enviadas para homologação dentro
            do seu acesso.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-bar">
            <button
              type="button"
              className={companyFilter === "all" ? "primary-button small-button" : "secondary-button small-button"}
              onClick={() => setCompanyFilter("all")}
            >
              Todos ({companies.length})
            </button>
            <button
              type="button"
              className={companyFilter === "pending" ? "primary-button small-button" : "secondary-button small-button"}
              onClick={() => setCompanyFilter("pending")}
            >
              Em aprovação ({companiesInApproval.length})
            </button>
            <button
              type="button"
              className={companyFilter === "approved" ? "primary-button small-button" : "secondary-button small-button"}
              onClick={() => setCompanyFilter("approved")}
            >
              Homologados ({homologatedCompanies.length})
            </button>
          </div>

          {companyFilter === "all" ? (
            <>
              <AdminCompanySection
                title="Em aprovação"
                companies={companiesInApproval}
                onOpenCompany={onOpenCompany}
              />
              <AdminCompanySection
                title="Homologados"
                companies={homologatedCompanies}
                onOpenCompany={onOpenCompany}
              />
            </>
          ) : (
            <AdminCompanySection
              title={companyFilter === "approved" ? "Homologados" : "Em aprovação"}
              companies={visibleCompanies}
              onOpenCompany={onOpenCompany}
            />
          )}
        </>
      )}

      {showCreateAdmin && (
        <CreateAdminForm
          onClose={() =>
            setShowCreateAdmin(
              false
            )
          }
          onCreated={() =>
            setShowCreateAdmin(
              false
            )
          }
        />
      )}
    </main>
  );
}

function AdminCompanySection({
  title,
  companies,
  onOpenCompany,
}) {
  return (
    <section className="admin-company-section">
      <div className="admin-section-heading">
        <div>
          <div className="section-kicker">Administração</div>
          <h2>{title}</h2>
        </div>
        <span className="status-badge">{companies.length}</span>
      </div>

      {companies.length === 0 ? (
        <div className="empty-state compact-empty-state">
          <p>Nenhuma empresa nesta categoria.</p>
        </div>
      ) : (
        <div className="company-grid">
          {companies.map((company) => (
            <button
              type="button"
              key={company.id}
              className="company-card company-card-main admin-company-card"
              onClick={() => onOpenCompany(company)}
            >
              <div className="company-icon">
                <FileCheck2 size={23} />
              </div>

              <div className="company-content">
                <h2>{company.legal_name}</h2>
                <p>{formatCnpj(company.cnpj)}</p>
                <div className="company-modality">
                  {company.modality || "Serviço/atividade não informado"}
                </div>
                <div className="company-card-status">
                  <StatusBadge
                    status={company.submission_status}
                    label={getCompanyStatusLabel(company.submission_status)}
                  />
                </div>
              </div>

              <ChevronRight size={20} className="company-arrow" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AdminActivityNotificationCenter({
  session,
  isOpen,
  onOpen,
  onClose,
  onCountChange,
  onOpenCompany,
}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    if (!session?.user?.id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("recipient_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    onCountChange?.((data || []).filter((item) => !item.read_at).length);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();

    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isOpen || !session?.user?.id) return;

    async function markAsRead() {
      const unreadIds = notifications
        .filter((item) => !item.read_at)
        .map((item) => item.id);

      if (!unreadIds.length) return;

      const { error } = await supabase
        .from("admin_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .eq("recipient_id", session.user.id);

      if (error) {
        console.error(error);
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          unreadIds.includes(item.id)
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      onCountChange?.(0);
    }

    markAsRead();
  }, [isOpen, notifications.length, session?.user?.id]);

  if (!isOpen) return null;

  return (
    <section className="notice-card info admin-notification-center notification-popover">
      <div className="admin-notification-header">
        <div>
          <strong>Notificações</strong>
          <p>Movimentações recentes da homologação.</p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>

      {loading ? (
        <div className="loading-box compact-loading">
          <RefreshCw size={18} className="spin" />
          Carregando notificações...
        </div>
      ) : notifications.length === 0 ? (
        <div className="compact-empty-state">
          <p>Nenhuma notificação.</p>
        </div>
      ) : (
        <div className="admin-notification-list">
          {notifications.map((notification) => (
            <button
              type="button"
              className="admin-notification-item"
              key={notification.id}
              onClick={() => {
                onClose();
              }}
            >
              <Bell size={17} />
              <span>
                <strong>{notification.message}</strong>
                <small>
                  {new Date(notification.created_at).toLocaleString("pt-BR")}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CreateAdminForm({
  onClose,
  onCreated,
}) {
  const [name, setName] =
    useState("");
  const [email, setEmail] =
    useState("");
  const [keywords, setKeywords] =
    useState("");
  const [loading, setLoading] =
    useState(false);
  const [message, setMessage] =
    useState("");

  async function handleCreate(
    event
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        "create-admin",
        {
          body: {
            name: name.trim(),
            email: email.trim(),
            keywords:
              keywords.trim(),
          },
        }
      );

    if (error) {
      setMessage(
        error.message ||
          "Não foi possível cadastrar o administrador."
      );

      setLoading(false);
      return;
    }

    if (data?.error) {
      setMessage(data.error);
      setLoading(false);
      return;
    }

    alert(
      "Administrador cadastrado. Um convite foi enviado para o e-mail informado."
    );

    setLoading(false);
    onCreated();
  }

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <button
          type="button"
          className="modal-close admin-modal-close"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <div className="modal-heading">
          <div className="modal-icon">
            <UserPlus size={20} />
          </div>

          <div>
            <h2>
              Cadastrar administrador
            </h2>

            <p>
              Defina o nível de acesso que esse administrador terá.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className="form"
        >
          <label>
            Nome
            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="Nome do administrador"
              required
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="email@empresa.com.br"
              required
            />
          </label>

          <label>
            Categoria de palavras-chave
            <input
              value={keywords}
              onChange={(event) =>
                setKeywords(
                  event.target.value
                )
              }
              placeholder="Ex.: LAVAGEM, VAPOR, EXAUSTOR"
            />
          </label>

          <div className="admin-permission-box">
            <strong>
              Como funciona:
            </strong>

            <span>
              • Campo em branco: acesso para visualizar e analisar tudo.
            </span>

            <span>
              • VISUALIZAR: pode visualizar tudo, mas não pode aprovar
              ou rejeitar.
            </span>

            <span>
              • Palavras-chave: poderá visualizar e analisar apenas
              empresas cujo serviço/atividade contenha uma das palavras
              informadas.
            </span>

            <span>
              Separe várias palavras por vírgula.
            </span>
          </div>

          {message && (
            <div className="form-message error">
              {message}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw
                    size={16}
                    className="spin"
                  />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Cadastrar administrador
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminReviewerName({ profileId }) {
  const [name, setName] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!profileId) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", profileId)
        .maybeSingle();

      if (active) {
        setName(data?.full_name || data?.email || "Usuário");
      }
    }

    load();
    return () => { active = false; };
  }, [profileId]);

  return <>{name || "Usuário"}</>;
}

function AdminCompanyPage({
  session,
  company,
  adminProfile,
  onBack,
}) {
  const [documents, setDocuments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [reviewNotes, setReviewNotes] =
    useState(
      company.review_notes ||
        ""
    );

  const [savingCompany, setSavingCompany] =
    useState(false);

  const canReview =
    adminCanReview(
      adminProfile
    );

  const viewOnly =
    adminIsViewOnly(
      adminProfile
    );

  async function loadDocuments() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("documents")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", {
          ascending: true,
        });

    if (error) {
      setMessage(error.message);
    } else {
      setDocuments(
        data || []
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [company.id]);

  async function updateDocumentReview(
    document,
    reviewStatus,
    notes
  ) {
    if (!canReview)
      return;

    const { error } =
      await supabase
        .from("documents")
        .update({
          review_status:
            reviewStatus,

          reviewed_at:
            new Date().toISOString(),

          reviewed_by:
            session.user.id,

          review_notes:
            notes || null,
        })
        .eq(
          "id",
          document.id
        );

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    await loadDocuments();
    return true;
  }

  async function undoDocumentReview(document) {
    if (!canReview || !document) return false;

    const { error } = await supabase
      .from("documents")
      .update({
        review_status: "pending",
        reviewed_at: null,
        reviewed_by: null,
        review_notes: null,
      })
      .eq("id", document.id);

    if (error) {
      setMessage(error.message);
      return false;
    }

    await loadDocuments();
    return true;
  }

  async function updateCompanyStatus(
    status
  ) {
    if (!canReview)
      return;

    setSavingCompany(
      true
    );

    setMessage("");

    const {
      data,
      error,
    } =
      await supabase
        .from("companies")
        .update({
          submission_status:
            status,

          reviewed_at:
            new Date().toISOString(),

          reviewed_by:
            session.user.id,

          review_notes:
            reviewNotes.trim() ||
            null,
        })
        .eq(
          "id",
          company.id
        )
        .select()
        .single();

    if (error) {
      setMessage(
        error.message
      );

      setSavingCompany(
        false
      );

      return;
    }

    Object.assign(
      company,
      data
    );

    if (status === "approved") {
      await recordAdminActivity(
        "approval",
        company.id
      );
    }

    setSavingCompany(
      false
    );

    if (
      status === "approved"
    ) {
      setMessage(
        "Fornecedor homologado com sucesso."
      );
    } else {
      setMessage(
        "Fornecedor marcado para correções."
      );
    }
  }

  return (
    <main className="page">
      <div className="dashboard-heading">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>

          <div className="section-kicker">
            Análise de fornecedor
          </div>

          <h1>
            {company.legal_name}
          </h1>

          <p>
            CNPJ:{" "}
            {formatCnpj(
              company.cnpj
            )}
            <br />
            Serviço/atividade:{" "}
            {company.modality ||
              "Não informado"}
            {company.submission_status === "approved" && company.reviewed_by && (
              <>
                <br />
                Aprovado por: <AdminReviewerName profileId={company.reviewed_by} />
              </>
            )}
          </p>
        </div>

        <StatusBadge
          status={
            company.submission_status
          }
          label={getCompanyStatusLabel(
            company.submission_status
          )}
        />
      </div>

      {viewOnly && (
        <div className="notice-card info">
          <Eye size={19} />

          <div>
            <strong>
              Somente visualização
            </strong>

            <p>
              Você possui acesso aos documentos, mas não pode aprovar ou
              rejeitar.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div className="form-message info">
          {message}
        </div>
      )}

      {loading ? (
        <div className="loading-box">
          <RefreshCw
            size={22}
            className="spin"
          />
          Carregando documentos...
        </div>
      ) : (
        <div className="documents-list">
          {DOCUMENTS.map(
            (item) => {
              const document =
                documents.find(
                  (doc) =>
                    doc.type ===
                    item.type
                );

              return (
                <AdminDocumentCard
                  key={item.type}
                  item={item}
                  document={
                    document
                  }
                  canReview={
                    canReview
                  }
                  onReview={
                    updateDocumentReview
                  }
                  onUndo={
                    undoDocumentReview
                  }
                />
              );
            }
          )}
        </div>
      )}

      {canReview && (
        <section className="admin-review-panel">
          <div>
            <div className="section-kicker">
              Conclusão
            </div>

            <h2>
              Resultado da homologação
            </h2>

            <p>
              Após analisar a documentação, registre a decisão da Budel.
            </p>
          </div>

          <label>
            Observação
            <textarea
              className="admin-review-observation"
              value={reviewNotes}
              onChange={(event) =>
                setReviewNotes(
                  event.target.value
                )
              }
              placeholder="Informe observações ou correções necessárias..."
              rows={8}
            />
          </label>

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button danger-button"
              onClick={() =>
                updateCompanyStatus(
                  "rejected"
                )
              }
              disabled={
                savingCompany ||
                company.submission_status === "rejected"
              }
            >
              <X size={17} />
              Solicitar correções
            </button>

            {company.submission_status === "rejected" && (
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  updateCompanyStatus("submitted")
                }
                disabled={savingCompany}
              >
                <RefreshCw size={17} />
                Cancelar correções
              </button>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                updateCompanyStatus(
                  "approved"
                )
              }
              disabled={
                savingCompany
              }
            >
              <Check size={17} />
              Aprovar homologação
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function AdminDocumentCard({
  item,
  document,
  canReview,
  onReview,
  onUndo,
}) {
  const isOther =
    item.type === "outros";

  const [notes, setNotes] =
    useState(
      document?.review_notes ||
        ""
    );

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    setNotes(
      document?.review_notes ||
        ""
    );
  }, [document]);

  const files =
    getDocumentFiles(
      document
    );

  const otherFiles =
    isOther
      ? getOtherDocumentFiles(
          document
        )
      : [];

  const status =
    item.expires &&
    !isOther &&
    document?.expiry_date
      ? expiryStatus(
          document.expiry_date
        )
      : null;

  async function review(
    statusValue
  ) {
    if (
      !document ||
      !canReview
    ) {
      return;
    }

    setLoading(true);

    await onReview(
      document,
      statusValue,
      notes
    );

    setLoading(false);
  }

  return (
    <article className="document-card">
      <div className="document-top">
        <div className="document-title">
          <div className="document-icon">
            {item.type ===
            "fotos_local" ? (
              <ImageIcon size={21} />
            ) : (
              <FileText size={21} />
            )}
          </div>

          <div>
            <h3>
              {item.label}{" "}
              {item.required && (
                <span className="required-mark">
                  *
                </span>
              )}
            </h3>

            <p>
              {item.description}
            </p>
          </div>
        </div>

        <div className="document-status-group">
          {status && (
            <span
              className={`status-badge ${status.className}`}
            >
              {status.label}
            </span>
          )}

          {document?.review_status && (
            <span
              className={`status-badge ${
                document.review_status ===
                "approved"
                  ? "status-ok"
                  : document.review_status ===
                    "rejected"
                  ? "status-danger"
                  : ""
              }`}
            >
              {
                STATUS_LABELS[
                  document
                    .review_status
                ]
              }
            </span>
          )}
        </div>
      </div>

      <div className="document-body">
        {!document ||
        (!files.length &&
          !document.not_available) ? (
          <div className="notice-card warning">
            <AlertCircle size={18} />

            <div>
              <strong>
                Documento não enviado
              </strong>

              <p>
                O fornecedor ainda não enviou este documento.
              </p>
            </div>
          </div>
        ) : document.not_available ? (
          <div className="notice-card info">
            <Info size={18} />

            <div>
              <strong>
                Fornecedor informou que não possui
              </strong>
            </div>
          </div>
        ) : isOther ? (
          <>
            <div className="other-documents-admin-list">
              {otherFiles.map(
                (
                  file,
                  index
                ) => {
                  const fileStatus =
                    getOtherDocumentExpiryStatus(
                      file
                    );

                  return (
                    <div
                      className="other-document-admin-item"
                      key={`${file.path}-${index}`}
                    >
                      <AdminFileItem
                        file={file}
                      />

                      <label>
                        Título
                        <input
                          type="text"
                          value={file.title || ""}
                          readOnly
                        />
                      </label>

                      <div className="document-validity-row">
                        <div>
                          <span className="document-validity-label">
                            Validade
                          </span>
                          <div className="document-validity-options">
                            <button
                              type="button"
                              className={
                                file.expiry_type === "date"
                                  ? "primary-button small-button"
                                  : "secondary-button small-button"
                              }
                              disabled
                            >
                              Vencimento
                            </button>
                            <button
                              type="button"
                              className={
                                file.expiry_type === "definitive"
                                  ? "primary-button small-button"
                                  : "secondary-button small-button"
                              }
                              disabled
                            >
                              Licença definitiva
                            </button>
                          </div>
                        </div>

                        {file.expiry_type === "date" && (
                          <label>
                            Data de vencimento
                            <input
                              type="date"
                              value={file.expiry_date || ""}
                              readOnly
                            />
                          </label>
                        )}
                      </div>

                      <div className="required-document-notice">
                        <Info size={15} />

                        Validade:{" "}
                        {fileStatus.label}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </>
        ) : (
          <>
            <div className="selected-files">
              {files.map(
                (
                  file,
                  index
                ) => (
                  <AdminFileItem
                    key={`${file.path}-${index}`}
                    file={file}
                  />
                )
              )}
            </div>

            {item.expires && (
              <div className="document-validity-row">
                <div>
                  <span className="document-validity-label">
                    Validade
                  </span>
                  <div className="document-validity-options">
                    <button
                      type="button"
                      className={
                        getDocumentExpiryType(document) === "date"
                          ? "primary-button small-button"
                          : "secondary-button small-button"
                      }
                      disabled
                    >
                      Vencimento
                    </button>
                    <button
                      type="button"
                      className={
                        getDocumentExpiryType(document) === "definitive"
                          ? "primary-button small-button"
                          : "secondary-button small-button"
                      }
                      disabled
                    >
                      Licença definitiva
                    </button>
                  </div>
                </div>

                {getDocumentExpiryType(document) === "date" && (
                  <label>
                    Data de vencimento
                    <input
                      type="date"
                      value={document.expiry_date || ""}
                      readOnly
                    />
                  </label>
                )}
              </div>
            )}
          </>
        )}

        {document?.review_status ===
          "rejected" &&
          document.review_notes && (
            <div className="notice-card warning">
              <AlertCircle size={18} />

              <div>
                <strong>
                  Observação da análise
                </strong>

                <p>
                  {
                    document.review_notes
                  }
                </p>
              </div>
            </div>
          )}

        {canReview &&
          document &&
          (files.length > 0 || document.not_available) &&
          document.review_status === "pending" && (
            <>
              <label>
                Observação deste documento
                <textarea
                  className="document-review-observation"
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Informe uma observação..."
                  rows={6}
                />
              </label>

              <div className="document-actions">
                <button
                  type="button"
                  className="secondary-button small-button danger-button"
                  onClick={() =>
                    review(
                      "rejected"
                    )
                  }
                  disabled={loading}
                >
                  <X size={15} />
                  Rejeitar documento
                </button>

                <button
                  type="button"
                  className="secondary-button small-button success-button"
                  onClick={() =>
                    review(
                      "approved"
                    )
                  }
                  disabled={loading}
                >
                  <Check size={15} />
                  Aprovar documento
                </button>
              </div>
            </>
          )}

        {canReview &&
          document &&
          document.review_status === "rejected" && (
            <div className="document-actions">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={async () => {
                  setLoading(true);
                  await onUndo(document);
                  setLoading(false);
                }}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Cancelar correções
              </button>
            </div>
          )}

        {canReview &&
          document &&
          document.review_status === "approved" && (
            <div className="document-actions">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={async () => {
                  setLoading(true);
                  await onUndo(document);
                  setLoading(false);
                }}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Desfazer aprovação
              </button>
            </div>
          )}
      </div>
    </article>
  );
}

function AdminFileItem({
  file,
}) {
  const [url, setUrl] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function openFile(event) {
    event.preventDefault();
    event.stopPropagation();

    setLoading(true);

    try {
      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            "supplier-documents"
          )
          .createSignedUrl(
            file.path,
            300
          );

      if (error) {
        throw error;
      }

      if (
        !data?.signedUrl
      ) {
        throw new Error(
          "Não foi possível gerar o link para visualizar o documento."
        );
      }

      setUrl(
        data.signedUrl
      );
    } catch (error) {
      alert(
        error?.message ||
          "Não foi possível visualizar o documento."
      );
    } finally {
      setLoading(false);
    }
  }

  function closePreview(event) {
    event?.preventDefault();
    event?.stopPropagation();

    setUrl("");
  }

  return (
    <>
      <div
        className="selected-file"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <FileText size={16} />

        <span style={{ minWidth: 0, flex: 1 }}>
          {file.name}
        </span>

        <button
          type="button"
          className="secondary-button small-button"
          style={{ marginLeft: "auto", flexShrink: 0 }}
          onClick={openFile}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw
                size={15}
                className="spin"
              />
              Abrindo...
            </>
          ) : (
            <>
              <Eye size={15} />
              Visualizar
            </>
          )}
        </button>
      </div>

      {url && (
        <div
          className="pdf-preview-overlay"
          onClick={
            closePreview
          }
        >
          <div
            className="pdf-preview-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="pdf-preview-header">
              <strong>
                {file.name}
              </strong>

              <button
                type="button"
                className="icon-button"
                onClick={
                  closePreview
                }
              >
                <X size={20} />
              </button>
            </div>

            <iframe
              src={url}
              title={file.name}
              className="pdf-preview-frame"
            />

            <div className="pdf-preview-actions">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-button small-button"
              >
                <Download size={15} />
                Abrir em nova aba
              </a>

              <button
                type="button"
                className="primary-button small-button"
                onClick={
                  closePreview
                }
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({
  status,
  label,
}) {
  let className = "";

  if (
    status ===
    "approved"
  ) {
    className =
      "status-ok";
  } else if (
    status ===
    "rejected"
  ) {
    className =
      "status-danger";
  } else if (
    status ===
    "submitted"
  ) {
    className =
      "status-warning";
  }

  return (
    <span
      className={`status-badge ${className}`}
    >
      {label}
    </span>
  );
}

export default App;
