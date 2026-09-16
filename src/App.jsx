import { useEffect, useMemo, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock3,
  LogOut,
  Plus,
  ArrowLeft,
  Download,
  Building2,
  CalendarDays,
  XCircle,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { documentTypes } from "./data/checklist";

const checklistUrl =
  "/checklist/F103-04 - CheckList de Inspeção de Fornecedores.docx";

function formatCnpj(value = "") {
  const numbers = value.replace(/\D/g, "").slice(0, 14);

  return numbers
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date) {
  if (!date) return null;

  const a = new Date(`${today()}T00:00:00`);
  const b = new Date(`${date}T00:00:00`);

  return Math.ceil((b - a) / 86400000);
}

function documentStatus(doc) {
  if (!doc) return "missing";
  if (doc.not_available) return "not_available";
  if (!doc.file_path) return "missing";

  if (doc.expiry_date) {
    const days = daysUntil(doc.expiry_date);

    if (days < 0) return "expired";
    if (days <= 30) return "expiring";
  }

  return "ok";
}

function statusLabel(status) {
  if (status === "ok") return "OK";
  if (status === "expiring") return "Vencendo";
  if (status === "expired") return "Vencido";
  if (status === "not_available") return "Não possui";
  return "Pendente";
}

function StatusBadge({ status }) {
  const config = {
    ok: {
      icon: <CheckCircle2 size={16} />,
      className: "status-ok",
    },
    expiring: {
      icon: <Clock3 size={16} />,
      className: "status-warning",
    },
    expired: {
      icon: <AlertCircle size={16} />,
      className: "status-danger",
    },
    not_available: {
      icon: <XCircle size={16} />,
      className: "status-muted",
    },
    missing: {
      icon: <AlertCircle size={16} />,
      className: "status-pending",
    },
  };

  const item = config[status] || config.missing;

  return (
    <span className={`status-badge ${item.className}`}>
      {item.icon}
      {statusLabel(status)}
    </span>
  );
}

function Header({ session, onLogout, onHome, onDownload }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={onHome}>
          <img src="/budel-logo.png" alt="Budel Transportes" />
        </button>

        <div className="header-actions">
          <button className="header-link" onClick={onDownload}>
            <Download size={17} />
            F103-04
          </button>

          {session && (
            <button className="header-link" onClick={onLogout}>
              <LogOut size={17} />
              Sair
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Home({ onLogin, onSignup, onDownload }) {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">PORTAL DE FORNECEDORES</span>

          <h1>Homologação de Fornecedores</h1>

          <p>
            Envie e acompanhe a documentação necessária para homologação de
            fornecedores da Budel Transportes Ltda.
          </p>

          <div className="hero-buttons">
            <button className="primary-button" onClick={onSignup}>
              Enviar documentos para Homologação
            </button>

            <button className="secondary-button" onClick={onLogin}>
              Entrar na minha conta
            </button>
          </div>
        </div>

        <div className="hero-card">
          <Building2 size={42} />

          <h3>Portal do fornecedor</h3>

          <p>
            Uma conta pode administrar um ou vários CNPJs e acompanhar a
            situação de toda a documentação.
          </p>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          <Building2 />
          <h3>Vários CNPJs</h3>
          <p>Cadastre e acompanhe vários CNPJs usando a mesma conta.</p>
        </div>

        <div className="feature-card">
          <FileText />
          <h3>Documentação</h3>
          <p>Envie os documentos exigidos para cada empresa.</p>
        </div>

        <div className="feature-card">
          <CalendarDays />
          <h3>Validade</h3>
          <p>Informe as datas de validade para facilitar o acompanhamento.</p>
        </div>
      </section>

      <section className="download-box">
        <div>
          <h2>Checklist F103-04</h2>
          <p>
            Baixe o checklist original de inspeção de fornecedores da Budel.
          </p>
        </div>

        <button className="secondary-button" onClick={onDownload}>
          <Download size={18} />
          Baixar checklist
        </button>
      </section>
    </main>
  );
}

function AuthPage({ mode, setMode, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });

        if (error) throw error;

        setMessage(
          "Cadastro criado! Verifique seu e-mail para confirmar a conta antes de entrar."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Não foi possível concluir a operação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page narrow-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Voltar
      </button>

      <div className="auth-card">
        <span className="eyebrow">
          {mode === "signup" ? "NOVO CADASTRO" : "ACESSO DO FORNECEDOR"}
        </span>

        <h1>
          {mode === "signup"
            ? "Criar conta de fornecedor"
            : "Entrar no portal"}
        </h1>

        <p className="muted">
          {mode === "signup"
            ? "Crie uma conta para cadastrar e acompanhar seus CNPJs."
            : "Acesse seus CNPJs e acompanhe a documentação."}
        </p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do responsável"
                required
              />
            </label>
          )}

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              minLength={6}
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}

          <button className="primary-button full-button" disabled={loading}>
            {loading
              ? "Aguarde..."
              : mode === "signup"
              ? "Criar conta"
              : "Entrar"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "signup" ? (
            <>
              Já possui uma conta?
              <button onClick={() => setMode("login")}>Entrar</button>
            </>
          ) : (
            <>
              Ainda não possui conta?
              <button onClick={() => setMode("signup")}>
                Criar cadastro
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function CompanyForm({ onCancel, onCreated }) {
  const [legalName, setLegalName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [modality, setModality] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      const cleanCnpj = cnpj.replace(/\D/g, "");

      if (cleanCnpj.length !== 14) {
        throw new Error("Digite um CNPJ válido com 14 números.");
      }

      if (!modality) {
        throw new Error("Selecione a modalidade da empresa.");
      }

      const { data, error } = await supabase
        .from("companies")
        .insert({
          owner_id: user.id,
          legal_name: legalName.trim(),
          cnpj: cleanCnpj,
          modality,
          submission_status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      onCreated(data);
    } catch (err) {
      if (err.message?.includes("companies_cnpj_key")) {
        setError("Este CNPJ já está cadastrado no portal.");
      } else {
        setError(err.message || "Não foi possível cadastrar o CNPJ.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <button className="back-button" onClick={onCancel}>
        <ArrowLeft size={17} />
        Voltar para meus CNPJs
      </button>

      <div className="panel-title">
        <div>
          <span className="eyebrow">NOVO CNPJ</span>
          <h1>Cadastrar empresa</h1>
        </div>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <label className="full-width">
          Razão Social
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Digite a razão social"
            required
          />
        </label>

        <label>
          CNPJ
          <input
            value={formatCnpj(cnpj)}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            required
          />
        </label>

        <label>
          Modalidade da empresa
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            <option value="Transportadora">Transportadora</option>
            <option value="Prestador de serviços">
              Prestador de serviços
            </option>
            <option value="Fornecedor">Fornecedor</option>
            <option value="Outro">Outro</option>
          </select>
        </label>

        {error && <div className="alert error full-width">{error}</div>}

        <div className="form-actions full-width">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancelar
          </button>

          <button className="primary-button" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar empresa"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SupplierDashboard({ onLogout }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("companies");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showCompanyForm, setShowCompanyForm] = useState(false);

  async function loadCompanies() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setCompanies(data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  function openCompany(company) {
    setSelectedCompany(company);
    setScreen("documents");
  }

  function companyCreated(company) {
    setCompanies((current) => [company, ...current]);
    setShowCompanyForm(false);
    openCompany(company);
  }

  if (showCompanyForm) {
    return (
      <main className="page">
        <CompanyForm
          onCancel={() => setShowCompanyForm(false)}
          onCreated={companyCreated}
        />
      </main>
    );
  }

  if (screen === "documents" && selectedCompany) {
    return (
      <main className="page">
        <DocumentsPage
          company={selectedCompany}
          onBack={() => {
            setScreen("companies");
            loadCompanies();
          }}
        />
      </main>
    );
  }

  return (
    <main className="page">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">ÁREA DO FORNECEDOR</span>
          <h1>Meus CNPJs</h1>
          <p className="muted">
            Cadastre suas empresas e acompanhe a documentação de cada CNPJ.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowCompanyForm(true)}
        >
          <Plus size={18} />
          Cadastrar CNPJ
        </button>
      </div>

      {loading ? (
        <div className="loading-box">Carregando seus CNPJs...</div>
      ) : companies.length === 0 ? (
        <div className="empty-box">
          <Building2 size={40} />
          <h2>Nenhum CNPJ cadastrado</h2>
          <p>Comece cadastrando a empresa que deseja homologar.</p>
          <button
            className="primary-button"
            onClick={() => setShowCompanyForm(true)}
          >
            <Plus size={18} />
            Cadastrar primeiro CNPJ
          </button>
        </div>
      ) : (
        <div className="company-grid">
          {companies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              onClick={() => openCompany(company)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CompanyCard({ company, onClick }) {
  return (
    <button className="company-card" onClick={onClick}>
      <div className="company-icon">
        <Building2 size={25} />
      </div>

      <div className="company-content">
        <h2>{company.legal_name}</h2>

        <p>
          CNPJ:{" "}
          {formatCnpj(company.cnpj)}
        </p>

        <span className="company-modality">
          {company.modality || "Modalidade não informada"}
        </span>
      </div>

      <div className="company-arrow">›</div>
    </button>
  );
}

function DocumentsPage({ company, onBack }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDocuments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setDocuments(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [company.id]);

  const documentMap = useMemo(() => {
    return Object.fromEntries(documents.map((doc) => [doc.type, doc]));
  }, [documents]);

  const summary = useMemo(() => {
    let ok = 0;
    let pending = 0;
    let expired = 0;
    let notAvailable = 0;

    documentTypes.forEach((item) => {
      const status = documentStatus(documentMap[item.key]);

      if (status === "ok" || status === "expiring") ok++;
      else if (status === "expired") expired++;
      else if (status === "not_available") notAvailable++;
      else pending++;
    });

    return { ok, pending, expired, notAvailable };
  }, [documentMap]);

  async function saveDocument(type, values) {
    setSaving((current) => ({ ...current, [type]: true }));
    setError("");
    setMessage("");

    try {
      const existing = documentMap[type];

      let filePath = existing?.file_path || null;
      let originalName = existing?.original_name || null;

      if (values.file) {
        const extension =
          values.file.name.split(".").pop()?.toLowerCase() || "pdf";

        const safeName = `${crypto.randomUUID()}.${extension}`;
        const path = `${company.owner_id}/${company.id}/${type}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("supplier-documents")
          .upload(path, values.file, {
            upsert: true,
          });

        if (uploadError) throw uploadError;

        filePath = path;
        originalName = values.file.name;
      }

      const payload = {
        company_id: company.id,
        type,
        file_path: filePath,
        original_name: originalName,
        issue_date: values.issueDate || null,
        expiry_date: values.expiryDate || null,
        not_available: values.notAvailable,
        notes: null,
      };

      const { data, error: dbError } = await supabase
        .from("documents")
        .upsert(payload, {
          onConflict: "company_id,type",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setDocuments((current) => [
        ...current.filter((item) => item.type !== type),
        data,
      ]);

      setMessage("Documento salvo com sucesso.");
    } catch (err) {
      setError(err.message || "Não foi possível salvar o documento.");
    } finally {
      setSaving((current) => ({ ...current, [type]: false }));
    }
  }

  async function submitForApproval() {
    setError("");
    setMessage("");

    const missing = documentTypes.filter((item) => {
      const doc = documentMap[item.key];
      return documentStatus(doc) === "missing";
    });

    if (missing.length > 0) {
      setError(
        `Ainda existem ${missing.length} documentação(ões) pendente(s). Anexe o documento ou marque "Não possuímos essa documentação".`
      );
      return;
    }

    const withoutExpiry = documentTypes.filter((item) => {
      const doc = documentMap[item.key];
      if (!doc || doc.not_available) return false;
      return !doc.expiry_date;
    });

    if (withoutExpiry.length > 0) {
      setError(
        "Informe a validade dos documentos que possuem validade antes de enviar."
      );
      return;
    }

    const { error } = await supabase
      .from("companies")
      .update({
        submission_status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Documentação enviada para homologação!");
  }

  async function openFile(doc) {
    if (!doc?.file_path) return;

    const { data, error } = await supabase.storage
      .from("supplier-documents")
      .createSignedUrl(doc.file_path, 300);

    if (error) {
      setError(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Voltar para meus CNPJs
      </button>

      <div className="company-header">
        <div>
          <span className="eyebrow">DOCUMENTAÇÃO</span>
          <h1>{company.legal_name}</h1>
          <p>CNPJ: {formatCnpj(company.cnpj)}</p>
          <span className="company-modality">{company.modality}</span>
        </div>
      </div>

      <div className="summary-grid">
        <div>
          <strong>{summary.ok}</strong>
          <span>OK</span>
        </div>

        <div>
          <strong>{summary.pending}</strong>
          <span>Pendentes</span>
        </div>

        <div>
          <strong>{summary.expired}</strong>
          <span>Vencidos</span>
        </div>

        <div>
          <strong>{summary.notAvailable}</strong>
          <span>Não possui</span>
        </div>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="documents-header">
        <div>
          <h2>Documentos obrigatórios</h2>
          <p className="muted">
            Anexe os documentos e informe suas respectivas validades.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={() => window.open(checklistUrl, "_blank")}
        >
          <Download size={18} />
          Baixar F103-04
        </button>
      </div>

      {loading ? (
        <div className="loading-box">Carregando documentos...</div>
      ) : (
        <div className="documents-list">
          {documentTypes.map((item) => (
            <DocumentCard
              key={item.key}
              item={item}
              document={documentMap[item.key]}
              saving={saving[item.key]}
              onSave={saveDocument}
              onOpen={openFile}
            />
          ))}
        </div>
      )}

      <div className="submit-box">
        <div>
          <h2>Finalizar envio</h2>
          <p>
            Depois de preencher a documentação, envie o cadastro para análise
            da Budel.
          </p>
        </div>

        <button className="primary-button" onClick={submitForApproval}>
          Enviar para homologação
        </button>
      </div>
    </div>
  );
}

function DocumentCard({ item, document, saving, onSave, onOpen }) {
  const [file, setFile] = useState(null);
  const [issueDate, setIssueDate] = useState(document?.issue_date || "");
  const [expiryDate, setExpiryDate] = useState(document?.expiry_date || "");
  const [notAvailable, setNotAvailable] = useState(
    document?.not_available || false
  );

  const status = documentStatus(document);

  useEffect(() => {
    setIssueDate(document?.issue_date || "");
    setExpiryDate(document?.expiry_date || "");
    setNotAvailable(document?.not_available || false);
  }, [document]);

  function save() {
    if (!notAvailable && !file && !document?.file_path) {
      alert(
        "Anexe um arquivo ou marque 'Não possuímos essa documentação'."
      );
      return;
    }

    if (!notAvailable && !expiryDate) {
      alert("Informe a validade do documento.");
      return;
    }

    onSave(item.key, {
      file,
      issueDate,
      expiryDate,
      notAvailable,
    });
  }

  return (
    <div className="document-card">
      <div className="document-top">
        <div className="document-title">
          <div className="document-icon">
            <FileText size={21} />
          </div>

          <div>
            <h3>{item.label}</h3>

            {item.description && <p>{item.description}</p>}
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      <div className="document-body">
        <label className="upload-area">
          <Upload size={24} />

          <strong>
            {file
              ? file.name
              : document?.original_name
              ? document.original_name
              : "Clique para selecionar o documento"}
          </strong>

          <span>PDF, JPG, PNG ou DOCX</span>

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={notAvailable}
          />
        </label>

        <div className="date-fields">
          <label>
            Data de emissão
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              disabled={notAvailable}
            />
          </label>

          <label>
            Data de validade
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={notAvailable}
            />
          </label>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={notAvailable}
            onChange={(e) => {
              setNotAvailable(e.target.checked);

              if (e.target.checked) {
                setFile(null);
                setExpiryDate("");
              }
            }}
          />

          <span>Não possuímos essa documentação</span>
        </label>

        <div className="document-actions">
          {document?.file_path && !notAvailable && (
            <button
              type="button"
              className="secondary-button small-button"
              onClick={() => onOpen(document)}
            >
              Ver documento
            </button>
          )}

          <button
            type="button"
            className="primary-button small-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("login");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);

      if (newSession) {
        setPage("dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function downloadChecklist() {
    const link = document.createElement("a");
    link.href = checklistUrl;
    link.download = "F103-04 - CheckList de Inspeção de Fornecedores.docx";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setPage("home");
  }

  if (checkingSession) {
    return <div className="app-loading">Carregando portal...</div>;
  }

  return (
    <div className="app">
      <Header
        session={session}
        onLogout={logout}
        onHome={() => setPage(session ? "dashboard" : "home")}
        onDownload={downloadChecklist}
      />

      {page === "home" && (
        <Home
          onLogin={() => {
            setAuthMode("login");
            setPage("auth");
          }}
          onSignup={() => {
            setAuthMode("signup");
            setPage("auth");
          }}
          onDownload={downloadChecklist}
        />
      )}

      {page === "auth" && !session && (
        <AuthPage
          mode={authMode}
          setMode={setAuthMode}
          onBack={() => setPage("home")}
        />
      )}

      {page === "dashboard" && session && (
        <SupplierDashboard onLogout={logout} />
      )}

      <footer className="site-footer">
        <div>
          <strong>Budel Transportes Ltda</strong>
          <span>Portal de Homologação de Fornecedores</span>
        </div>
      </footer>
    </div>
  );
}
