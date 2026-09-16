import React, { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  ShieldX,
  Eye,
  FileSpreadsheet,
  UserPlus,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabase";
import { documentTypes } from "./data/checklist";

const checklistUrl =
  "/checklist/F103-04 - CheckList de Inspeção de Fornecedores.docx";

const mandatoryDocuments = [
  "cartao_cnpj",
  "checklist",
  "fotos_local",
];

function isMandatoryDocument(type) {
  return mandatoryDocuments.includes(type);
}

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

function hasDocumentFiles(doc) {
  if (!doc) return false;

  const files = Array.isArray(doc.files) ? doc.files : [];

  return files.length > 0 || !!doc.file_path;
}

function documentStatus(doc) {
  if (!doc) return "missing";

  if (doc.not_available) {
    return "not_available";
  }

  if (!hasDocumentFiles(doc)) {
    return "missing";
  }

  if (doc.expiry_date) {
    const days = daysUntil(doc.expiry_date);

    if (days < 0) return "expired";
    if (days <= 15) return "expiring";
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

function reviewLabel(status) {
  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Reprovado";

  return "Em análise";
}

function companyStatusLabel(status) {
  if (status === "approved") return "Homologação aprovada";
  if (status === "rejected") return "Homologação reprovada";
  if (status === "submitted") return "Em análise";

  return "Rascunho";
}

/*
  Regra da Budel:
  documento emitido em 16/09/2026
  vale até 15/09/2027.

  Ou seja:
  data de validade = data de emissão + 1 ano - 1 dia.
*/
function calculateExpiryDate(issueDate) {
  if (!issueDate) return "";

  const date = new Date(`${issueDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setFullYear(date.getFullYear() + 1);
  date.setDate(date.getDate() - 1);

  return date.toISOString().slice(0, 10);
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function keywordList(value = "") {
  return normalizeText(value)
    .split(/[,;|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function adminIsViewOnly(profile) {
  return keywordList(profile?.admin_keywords).includes(
    "visualizar"
  );
}

function adminCanReview(profile) {
  if (!profile || profile.role !== "admin") {
    return false;
  }

  if (profile.admin_can_manage_users === true) {
    return true;
  }

  return !adminIsViewOnly(profile);
}

function adminCanManageUsers(profile) {
  return (
    profile?.role === "admin" &&
    profile?.admin_can_manage_users === true
  );
}

function adminCanViewCompany(company, profile) {
  if (!profile || profile.role !== "admin") {
    return false;
  }

  if (company?.submission_status === "draft") {
    return false;
  }

  if (profile.admin_can_manage_users === true) {
    return true;
  }

  const keywords = keywordList(profile.admin_keywords);

  if (keywords.length === 0) {
    return true;
  }

  if (keywords.includes("visualizar")) {
    return true;
  }

  const companyText = normalizeText(company?.modality || "");

  return keywords.some((keyword) =>
    companyText.includes(keyword)
  );
}

function ReviewBadge({ status }) {
  const config = {
    approved: {
      icon: <CheckCircle2 size={15} />,
      className: "status-ok",
    },
    rejected: {
      icon: <XCircle size={15} />,
      className: "status-danger",
    },
    pending: {
      icon: <Clock3 size={15} />,
      className: "status-warning",
    },
  };

  const item = config[status] || config.pending;

  return (
    <span className={`status-badge ${item.className}`}>
      {item.icon}
      {reviewLabel(status)}
    </span>
  );
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

function Header({
  session,
  onLogout,
  onHome,
  onDownload,
  isAdmin,
  onAdmin,
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={onHome}>
          <img src="/budel-logo.png" alt="Budel Transportes" />
        </button>

        <div className="header-actions">
          {isAdmin && (
            <button className="header-link" onClick={onAdmin}>
              <ShieldCheck size={17} />
              Administrativo
            </button>
          )}

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
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        setMessage(
          "Cadastro criado! Verifique seu e-mail para confirmar a conta. Ao clicar no link, você será direcionado novamente para o portal."
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

      if (!modality.trim()) {
        throw new Error(
          "Digite o serviço ou atividade fornecida à Budel."
        );
      }

      const { data, error } = await supabase
        .from("companies")
        .insert({
          owner_id: user.id,
          legal_name: legalName.trim(),
          cnpj: cleanCnpj,
          modality: modality.trim(),
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
          Serviço/atividade fornecida à Budel
          <input
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            placeholder="Digite o serviço ou atividade da empresa"
            required
          />
        </label>

        {error && <div className="alert error full-width">{error}</div>}

        <div className="form-actions full-width">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
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

/* =========================================================
   ÁREA DO FORNECEDOR
   ========================================================= */

function SupplierDashboard() {
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

    if (!error) {
      setCompanies(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  async function deleteCompany(company) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o CNPJ ${formatCnpj(
        company.cnpj
      )}?\n\nA empresa e toda a documentação cadastrada para ela serão excluídas.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", company.id);

    if (error) {
      alert(`Não foi possível excluir o CNPJ:\n${error.message}`);
      return;
    }

    setCompanies((current) =>
      current.filter((item) => item.id !== company.id)
    );

    if (selectedCompany?.id === company.id) {
      setSelectedCompany(null);
      setScreen("companies");
    }
  }

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
              onDelete={deleteCompany}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function CompanyCard({ company, onClick, onDelete }) {
  async function handleDelete(e) {
    e.stopPropagation();
    await onDelete(company);
  }

  return (
    <div className="company-card">
      <button
        type="button"
        className="company-card-main"
        onClick={onClick}
      >
        <div className="company-icon">
          <Building2 size={25} />
        </div>

        <div className="company-content">
          <h2>{company.legal_name}</h2>

          <p>CNPJ: {formatCnpj(company.cnpj)}</p>

          <span className="company-modality">
            {company.modality || "Serviço não informado"}
          </span>

          <div style={{ marginTop: "12px" }}>
            <span className="status-badge status-pending">
              {companyStatusLabel(company.submission_status)}
            </span>
          </div>
        </div>

        <div className="company-arrow">›</div>
      </button>

      <button
        type="button"
        className="delete-company-button"
        onClick={handleDelete}
      >
        Excluir CNPJ
      </button>
    </div>
  );
}

/* =========================================================
   DOCUMENTOS DO FORNECEDOR
   ========================================================= */

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
    return Object.fromEntries(
      documents.map((doc) => [doc.type, doc])
    );
  }, [documents]);

  const summary = useMemo(() => {
    let ok = 0;
    let pending = 0;
    let expired = 0;
    let notAvailable = 0;

    documentTypes.forEach((item) => {
      const status = documentStatus(documentMap[item.key]);

      if (status === "ok" || status === "expiring") {
        ok++;
      } else if (status === "expired") {
        expired++;
      } else if (status === "not_available") {
        notAvailable++;
      } else {
        pending++;
      }
    });

    return {
      ok,
      pending,
      expired,
      notAvailable,
    };
  }, [documentMap]);

  async function saveDocument(type, values) {
    setSaving((current) => ({
      ...current,
      [type]: true,
    }));

    setError("");
    setMessage("");

    try {
      const existing = documentMap[type];

      /*
        Se o documento estava reprovado e o fornecedor
        enviou novos arquivos, os arquivos antigos são
        substituídos pelos novos.
      */
      let files = [];

      if (
        existing?.review_status !== "rejected"
      ) {
        files = Array.isArray(existing?.files)
          ? [...existing.files]
          : [];

        if (files.length === 0 && existing?.file_path) {
          files.push({
            path: existing.file_path,
            name: existing.original_name || "Documento",
          });
        }
      }

      if (values.files?.length) {
        for (const file of values.files) {
          const extension =
            file.name.split(".").pop()?.toLowerCase() || "pdf";

          const safeName = `${crypto.randomUUID()}.${extension}`;

          const path = `${company.owner_id}/${company.id}/${type}/${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("supplier-documents")
            .upload(path, file, {
              upsert: true,
            });

          if (uploadError) {
            throw uploadError;
          }

          files.push({
            path,
            name: file.name,
          });
        }
      }

      if (
        existing?.review_status === "rejected" &&
        values.files?.length
      ) {
        /*
          Os arquivos novos já são os únicos arquivos
          considerados para o documento.
        */
        files = files.slice(-values.files.length);
      }

      const firstFile = files[0] || null;

      const payload = {
        company_id: company.id,
        type,
        file_path: firstFile?.path || null,
        original_name: firstFile?.name || null,
        files,
        issue_date: values.issueDate || null,
        expiry_date: values.expiryDate || null,
        not_available: values.notAvailable,

        notes: null,

        review_status: "pending",
        review_notes: null,
        reviewed_at: null,
        reviewed_by: null,
      };

      const { data, error: dbError } = await supabase
        .from("documents")
        .upsert(payload, {
          onConflict: "company_id,type",
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      if (existing?.review_status === "rejected") {
        const { error: companyError } = await supabase
          .from("companies")
          .update({
            submission_status: "draft",
          })
          .eq("id", company.id);

        if (companyError) {
          throw companyError;
        }
      }

      setDocuments((current) => [
        ...current.filter((item) => item.type !== type),
        data,
      ]);

      setMessage("Documento(s) salvo(s) com sucesso.");
    } catch (err) {
      setError(
        err.message || "Não foi possível salvar o documento."
      );
    } finally {
      setSaving((current) => ({
        ...current,
        [type]: false,
      }));
    }
  }

  async function submitForApproval() {
    setError("");
    setMessage("");

    const missing = documentTypes.filter((item) => {
      const doc = documentMap[item.key];

      if (isMandatoryDocument(item.key)) {
        return !hasDocumentFiles(doc) || doc?.not_available;
      }

      if (doc?.not_available) {
        return false;
      }

      return !hasDocumentFiles(doc);
    });

    if (missing.length > 0) {
      setError(
        `Ainda existem ${missing.length} documentação(ões) pendente(s). Anexe pelo menos um arquivo em cada documento necessário ou marque "Não possuímos essa documentação" nos documentos em que essa opção estiver disponível.`
      );

      return;
    }

    const withoutExpiry = documentTypes.filter((item) => {
      const doc = documentMap[item.key];

      if (!doc || doc.not_available) {
        return false;
      }

      if (!item.expires) {
        return false;
      }

      return !doc.expiry_date;
    });

    if (withoutExpiry.length > 0) {
      setError(
        "Informe a data de validade de todos os documentos que possuem validade."
      );

      return;
    }

    /*
      Confere a regra exata:
      emissão + 1 ano - 1 dia.
    */
    const invalidExpiry = documentTypes.filter((item) => {
      const doc = documentMap[item.key];

      if (!doc || doc.not_available || !item.expires) {
        return false;
      }

      if (!doc.issue_date || !doc.expiry_date) {
        return false;
      }

      return (
        calculateExpiryDate(doc.issue_date) !==
        doc.expiry_date
      );
    });

    if (invalidExpiry.length > 0) {
      setError(
        "Existem documentos com data de validade diferente da regra permitida: a validade deve ser exatamente 1 ano menos 1 dia após a data de emissão."
      );

      return;
    }

    const expired = documentTypes.filter((item) => {
      const doc = documentMap[item.key];

      if (!doc || doc.not_available) {
        return false;
      }

      if (!item.expires) {
        return false;
      }

      return documentStatus(doc) === "expired";
    });

    if (expired.length > 0) {
      setError(
        `Não é possível enviar a documentação enquanto houver ${expired.length} documento(s) vencido(s). Atualize os documentos vencidos.`
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

    company.submission_status = "submitted";

    setMessage(
      "Documentação enviada para homologação com sucesso!"
    );
  }

  async function openFiles(doc) {
    if (!doc) return;

    let files = Array.isArray(doc.files)
      ? doc.files
      : [];

    if (files.length === 0 && doc.file_path) {
      files = [
        {
          path: doc.file_path,
          name: doc.original_name || "Documento",
        },
      ];
    }

    if (files.length === 0) {
      setError("Nenhum arquivo encontrado para este documento.");
      return;
    }

    for (const file of files) {
      if (!file?.path) continue;

      const { data, error } = await supabase.storage
        .from("supplier-documents")
        .createSignedUrl(file.path, 300);

      if (error) {
        setError(error.message);
        continue;
      }

      window.open(data.signedUrl, "_blank");
    }
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

          <span className="company-modality">
            {company.modality}
          </span>

          <div style={{ marginTop: "12px" }}>
            <span className="status-badge status-pending">
              {companyStatusLabel(company.submission_status)}
            </span>
          </div>
        </div>
      </div>

      {company.submission_status === "rejected" && (
        <div className="alert error">
          <strong>A homologação foi reprovada pela Budel.</strong>
          <br />
          {company.review_notes ||
            "Verifique as observações dos documentos, atualize o que for necessário e envie novamente para análise."}
        </div>
      )}

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

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

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
        <div className="loading-box">
          Carregando documentos...
        </div>
      ) : (
        <div className="documents-list">
          {documentTypes.map((item) => (
            <DocumentCard
              key={item.key}
              item={item}
              document={documentMap[item.key]}
              saving={saving[item.key]}
              onSave={saveDocument}
              onOpen={openFiles}
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

        <button
          className="primary-button"
          onClick={submitForApproval}
        >
          Enviar para homologação
        </button>
      </div>
    </div>
  );
}

function DocumentCard({
  item,
  document,
  saving,
  onSave,
  onOpen,
}) {
  const [files, setFiles] = useState([]);

  const [issueDate, setIssueDate] = useState(
    document?.issue_date || ""
  );

  const [expiryDate, setExpiryDate] = useState(
    document?.expiry_date || ""
  );

  const [notAvailable, setNotAvailable] = useState(
    document?.not_available || false
  );

  const status = documentStatus(document);

  const mandatory = isMandatoryDocument(item.key);

  const existingFilesCount = Array.isArray(document?.files)
    ? document.files.length
    : document?.file_path
    ? 1
    : 0;

  useEffect(() => {
    setIssueDate(document?.issue_date || "");
    setExpiryDate(document?.expiry_date || "");
    setNotAvailable(document?.not_available || false);
    setFiles([]);
  }, [document]);

  function save() {
    const hasExistingFile = existingFilesCount > 0;
    const hasNewFile = files.length > 0;

    if (mandatory) {
      if (!hasExistingFile && !hasNewFile) {
        alert(
          "Este documento é obrigatório. Selecione pelo menos um arquivo."
        );

        return;
      }
    } else {
      if (
        !notAvailable &&
        !hasExistingFile &&
        !hasNewFile
      ) {
        alert(
          "Selecione pelo menos um arquivo ou marque 'Não possuímos essa documentação'."
        );

        return;
      }
    }

    if (
      !notAvailable &&
      item.expires &&
      !issueDate
    ) {
      alert("Informe a data de emissão do documento.");

      return;
    }

    if (
      !notAvailable &&
      item.expires &&
      !expiryDate
    ) {
      alert("Informe a validade do documento.");

      return;
    }

    if (
      !notAvailable &&
      item.expires &&
      calculateExpiryDate(issueDate) !== expiryDate
    ) {
      alert(
        `A validade deve ser ${calculateExpiryDate(
          issueDate
        )}, considerando a regra de 1 ano menos 1 dia.`
      );

      return;
    }

    onSave(item.key, {
      files,
      issueDate,
      expiryDate,
      notAvailable: mandatory
        ? false
        : notAvailable,
    });
  }

  function handleIssueDateChange(value) {
    setIssueDate(value);

    if (item.expires && value) {
      setExpiryDate(calculateExpiryDate(value));
    } else {
      setExpiryDate("");
    }
  }

  return (
    <div className="document-card">
      <div className="document-top">
        <div className="document-title">
          <div className="document-icon">
            <FileText size={21} />
          </div>

          <div>
            <h3>
              {item.label}

              {mandatory && (
                <span className="required-mark">
                  {" "}
                  *
                </span>
              )}
            </h3>

            {item.description && (
              <p>{item.description}</p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <StatusBadge status={status} />

          {document?.review_status === "approved" && (
            <ReviewBadge status="approved" />
          )}

          {document?.review_status === "rejected" && (
            <ReviewBadge status="rejected" />
          )}
        </div>
      </div>

      <div className="document-body">
        {document?.review_status === "rejected" &&
          document?.review_notes && (
            <div className="alert error">
              <strong>Observação da Budel:</strong>
              <br />
              {document.review_notes}
            </div>
          )}

        <label className="upload-area">
          <Upload size={24} />

          <strong>
            {files.length > 0
              ? `${files.length} arquivo(s) selecionado(s)`
              : existingFilesCount > 0
              ? `${existingFilesCount} arquivo(s) enviado(s)`
              : "Clique para selecionar os documentos"}
          </strong>

          <span>
            Você pode selecionar vários arquivos
          </span>

          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={(e) => {
              setFiles(
                Array.from(e.target.files || [])
              );
            }}
            disabled={notAvailable}
          />
        </label>

        {files.length > 0 && (
          <div className="selected-files">
            {files.map((file, index) => (
              <div
                className="selected-file"
                key={`${file.name}-${file.size}-${index}`}
              >
                <FileText size={16} />

                <span>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="date-fields">
          <label>
            Data de emissão

            <input
              type="date"
              value={issueDate}
              onChange={(e) =>
                handleIssueDateChange(e.target.value)
              }
              disabled={notAvailable}
            />
          </label>

          <label>
            Data de validade

            <input
              type="date"
              value={expiryDate}
              readOnly
              disabled={
                notAvailable ||
                !item.expires
              }
            />
          </label>
        </div>

        {!mandatory && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notAvailable}
              onChange={(e) => {
                const checked = e.target.checked;

                setNotAvailable(checked);

                if (checked) {
                  setFiles([]);
                  setExpiryDate("");
                  setIssueDate("");
                }
              }}
            />

            <span>
              Não possuímos essa documentação
            </span>
          </label>
        )}

        {mandatory && (
          <div className="required-document-notice">
            <AlertCircle size={16} />

            <span>
              Documento obrigatório para a homologação.
            </span>
          </div>
        )}

        <div className="document-actions">
          {existingFilesCount > 0 &&
            !notAvailable && (
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() =>
                  onOpen(document)
                }
              >
                <FileText size={16} />
                Ver documento
              </button>
            )}

          <button
            type="button"
            className="primary-button small-button"
            onClick={save}
            disabled={saving}
          >
            {saving
              ? "Salvando..."
              : document?.review_status === "rejected"
              ? "Enviar novo documento"
              : "Salvar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CADASTRO DE ADMINISTRADOR
   ========================================================= */

function CreateAdminForm({ onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!name.trim()) {
        throw new Error("Informe o nome do administrador.");
      }

      if (!email.trim()) {
        throw new Error("Informe o e-mail do administrador.");
      }

      const { data, error } = await supabase.functions.invoke(
        "create-admin",
        {
          body: {
            name: name.trim(),
            email: email.trim(),
            keywords: keywords.trim(),
          },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessage(
        "Administrador criado com sucesso. Um convite foi enviado para o e-mail informado."
      );

      setName("");
      setEmail("");
      setKeywords("");
    } catch (err) {
      setError(
        err.message ||
          "Não foi possível cadastrar o administrador."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="auth-card"
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="back-button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
          }}
        >
          <XCircle size={17} />
          Fechar
        </button>

        <span className="eyebrow">
          ADMINISTRAÇÃO
        </span>

        <h1>Cadastrar administrador</h1>

        <p className="muted">
          Crie um acesso administrativo e defina quais empresas essa pessoa
          poderá visualizar e analisar.
        </p>

        <form onSubmit={submit}>
          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do administrador"
              required
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="administrador@email.com"
              required
            />
          </label>

          <label>
            Categoria de palavras-chave
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Ex.: LAVAGEM, VAPOR, EXAUSTOR"
            />
          </label>

          <div
            className="required-document-notice"
            style={{
              display: "grid",
              gap: "5px",
            }}
          >
            <strong>Como funciona:</strong>

            <span>
              • Campo vazio: acesso completo, podendo visualizar e aprovar/reprovar tudo.
            </span>

            <span>
              • VISUALIZAR: pode visualizar tudo, mas não pode aprovar/reprovar.
            </span>

            <span>
              • Palavras-chave: poderá visualizar e analisar somente empresas cujo serviço/atividade contenha uma das palavras informadas.
            </span>

            <span>
              Separe várias palavras por vírgula.
            </span>
          </div>

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          {message && (
            <div className="alert success">
              {message}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Fechar
            </button>

            <button
              className="primary-button"
              disabled={loading}
            >
              <UserPlus size={18} />
              {loading
                ? "Cadastrando..."
                : "Cadastrar administrador"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   ÁREA ADMINISTRATIVA / BUDEL
   ========================================================= */

function AdminDashboard({
  onBack,
  adminProfile,
}) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);

  const canReview = adminCanReview(adminProfile);
  const canManageUsers = adminCanManageUsers(adminProfile);
  const viewOnly = adminIsViewOnly(adminProfile);

  async function loadCompanies() {
    setLoading(true);
    setError("");

    /*
      O RLS do Supabase impede que CNPJs em draft
      cheguem até este usuário.

      Aqui também filtramos draft para manter a regra
      explícita no frontend.
    */
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .neq("submission_status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setCompanies(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  async function exportToExcel() {
    setExporting(true);
    setError("");

    try {
      const { data: companiesData, error: companiesError } =
        await supabase
          .from("companies")
          .select("*")
          .neq("submission_status", "draft")
          .order("created_at", { ascending: false });

      if (companiesError) {
        throw companiesError;
      }

      const visibleCompanies = (companiesData || []).filter(
        (company) =>
          adminCanViewCompany(company, adminProfile)
      );

      const companyIds = visibleCompanies.map(
        (company) => company.id
      );

      const { data: documentsData, error: documentsError } =
        companyIds.length > 0
          ? await supabase
              .from("documents")
              .select("*")
              .in("company_id", companyIds)
          : { data: [], error: null };

      if (documentsError) {
        throw documentsError;
      }

      const rows = visibleCompanies.map((company) => {
        const companyDocs = (documentsData || []).filter(
          (doc) => doc.company_id === company.id
        );

        const row = {
          "Razão Social": company.legal_name || "",
          CNPJ: formatCnpj(company.cnpj || ""),
          "Serviço/atividade": company.modality || "",
          "Situação da homologação":
            company.submission_status === "approved"
              ? "Aprovada"
              : company.submission_status === "rejected"
              ? "Reprovada"
              : "Em análise",
          "Data do envio": company.submitted_at
            ? new Date(
                company.submitted_at
              ).toLocaleDateString("pt-BR")
            : "",
          "Observação geral da Budel":
            company.review_notes || "",
        };

        documentTypes.forEach((item) => {
          const doc = companyDocs.find(
            (document) => document.type === item.key
          );

          const status = documentStatus(doc);

          row[`${item.label} - Situação`] =
            doc?.not_available
              ? "Não possui"
              : statusLabel(status);

          row[`${item.label} - Análise`] =
            reviewLabel(doc?.review_status);

          row[`${item.label} - Validade`] =
            doc?.expiry_date
              ? new Date(
                  `${doc.expiry_date}T00:00:00`
                ).toLocaleDateString("pt-BR")
              : "";

          const files = Array.isArray(doc?.files)
            ? doc.files
            : doc?.file_path
            ? [
                {
                  name:
                    doc.original_name ||
                    "Documento",
                },
              ]
            : [];

          row[`${item.label} - Arquivos`] =
            files.map((file) => file.name).join(" | ");

          row[`${item.label} - Observação`] =
            doc?.review_notes || "";
        });

        return row;
      });

      const worksheet =
        XLSX.utils.json_to_sheet(rows);

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Homologações"
      );

      worksheet["!cols"] = [
        { wch: 32 },
        { wch: 20 },
        { wch: 38 },
        { wch: 20 },
        { wch: 15 },
        { wch: 40 },
      ];

      XLSX.writeFile(
        workbook,
        `Relatorio_Homologacao_Budel_${today()}.xlsx`
      );
    } catch (err) {
      setError(
        err.message ||
          "Não foi possível exportar o relatório."
      );
    } finally {
      setExporting(false);
    }
  }

  if (selectedCompany) {
    return (
      <main className="page">
        <AdminCompanyPage
          company={selectedCompany}
          adminProfile={adminProfile}
          canReview={canReview}
          onBack={() => {
            setSelectedCompany(null);
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
          <span className="eyebrow">ADMINISTRATIVO</span>

          <h1>Homologação de Fornecedores</h1>

          <p className="muted">
            {viewOnly
              ? "Visualização dos fornecedores enviados para homologação."
              : "Visualize e analise os fornecedores enviados para homologação."}
          </p>

          {!adminProfile.admin_can_manage_users &&
            adminProfile.admin_keywords &&
            !viewOnly && (
              <p
                className="muted"
                style={{ marginTop: "8px" }}
              >
                Filtro de acesso:{" "}
                <strong>
                  {adminProfile.admin_keywords}
                </strong>
              </p>
            )}

          {viewOnly && (
            <p
              className="muted"
              style={{ marginTop: "8px" }}
            >
              Este acesso possui somente permissão de visualização.
            </p>
          )}
        </div>

        <div className="header-actions">
          {canManageUsers && (
            <button
              className="secondary-button"
              onClick={() =>
                setShowCreateAdmin(true)
              }
            >
              <UserPlus size={18} />
              Cadastrar administrador
            </button>
          )}

          <button
            className="secondary-button"
            onClick={exportToExcel}
            disabled={exporting}
          >
            <FileSpreadsheet size={18} />

            {exporting
              ? "Gerando Excel..."
              : "Exportar para Excel"}
          </button>
        </div>
      </div>

      <div className="summary-grid">
        <div>
          <strong>{companies.length}</strong>
          <span>Total de CNPJs</span>
        </div>

        <div>
          <strong>
            {
              companies.filter(
                (company) =>
                  company.submission_status === "submitted"
              ).length
            }
          </strong>
          <span>Em análise</span>
        </div>

        <div>
          <strong>
            {
              companies.filter(
                (company) =>
                  company.submission_status === "approved"
              ).length
            }
          </strong>
          <span>Aprovados</span>
        </div>

        <div>
          <strong>
            {
              companies.filter(
                (company) =>
                  company.submission_status === "rejected"
              ).length
            }
          </strong>
          <span>Reprovados</span>
        </div>
      </div>

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <div className="documents-header">
        <div>
          <h2>Fornecedores</h2>

          <p className="muted">
            Clique em uma empresa para visualizar a documentação enviada.
          </p>
        </div>

        <button
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          Voltar
        </button>
      </div>

      {loading ? (
        <div className="loading-box">
          Carregando fornecedores...
        </div>
      ) : companies.length === 0 ? (
        <div className="empty-box">
          <Building2 size={40} />

          <h2>Nenhum fornecedor enviado</h2>

          <p>
            Quando os fornecedores enviarem seus CNPJs para homologação,
            eles aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="company-grid">
          {companies.map((company) => (
            <AdminCompanyCard
              key={company.id}
              company={company}
              onClick={() =>
                setSelectedCompany(company)
              }
            />
          ))}
        </div>
      )}

      {showCreateAdmin && (
        <CreateAdminForm
          onClose={() =>
            setShowCreateAdmin(false)
          }
        />
      )}
    </main>
  );
}

function AdminCompanyCard({
  company,
  onClick,
}) {
  const status =
    company.submission_status === "approved"
      ? "approved"
      : company.submission_status === "rejected"
      ? "rejected"
      : "pending";

  return (
    <button
      type="button"
      className="company-card-main"
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid #e8e8e8",
        borderRadius: "16px",
        padding: "22px",
        width: "100%",
        minHeight: "220px",
        textAlign: "left",
        color: "inherit",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        cursor: "pointer",
      }}
    >
      <div className="company-icon">
        <Building2 size={25} />
      </div>

      <div className="company-content">
        <h2>{company.legal_name}</h2>

        <p>
          CNPJ: {formatCnpj(company.cnpj)}
        </p>

        <span className="company-modality">
          {company.modality || "Serviço não informado"}
        </span>

        <div
          style={{
            marginTop: "12px",
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <ReviewBadge status={status} />

          <span className="status-badge status-pending">
            {companyStatusLabel(
              company.submission_status
            )}
          </span>
        </div>
      </div>

      <div className="company-arrow">›</div>
    </button>
  );
}

/* =========================================================
   DETALHES DO CNPJ PARA A BUDEL
   ========================================================= */

function AdminCompanyPage({
  company,
  onBack,
  adminProfile,
  canReview,
}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [saving, setSaving] = useState({});

  const [companyStatus, setCompanyStatus] =
    useState(
      company.submission_status || "submitted"
    );

  const [companyNotes, setCompanyNotes] =
    useState(
      company.review_notes || ""
    );

  const viewOnly = adminIsViewOnly(adminProfile);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", {
        ascending: true,
      });

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
    return Object.fromEntries(
      documents.map((doc) => [
        doc.type,
        doc,
      ])
    );
  }, [documents]);

  async function openFiles(doc) {
    if (!doc) return;

    let files = Array.isArray(doc.files)
      ? doc.files
      : [];

    if (
      files.length === 0 &&
      doc.file_path
    ) {
      files = [
        {
          path: doc.file_path,
          name:
            doc.original_name ||
            "Documento",
        },
      ];
    }

    if (files.length === 0) {
      setError(
        "Nenhum arquivo encontrado."
      );
      return;
    }

    for (const file of files) {
      if (!file?.path) continue;

      const {
        data,
        error,
      } = await supabase.storage
        .from("supplier-documents")
        .createSignedUrl(
          file.path,
          600
        );

      if (error) {
        setError(error.message);
        continue;
      }

      window.open(
        data.signedUrl,
        "_blank"
      );
    }
  }

  async function reviewDocument(
    doc,
    reviewStatus,
    notes
  ) {
    if (!doc || !canReview) return;

    setSaving((current) => ({
      ...current,
      [doc.type]: true,
    }));

    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Sua sessão expirou. Entre novamente."
        );
      }

      const {
        data,
        error,
      } = await supabase
        .from("documents")
        .update({
          review_status:
            reviewStatus,
          review_notes:
            notes || null,
          reviewed_at:
            new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq("id", doc.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setDocuments((current) =>
        current.map((item) =>
          item.id === doc.id
            ? data
            : item
        )
      );

      if (reviewStatus === "rejected") {
        const {
          error: companyError,
        } = await supabase
          .from("companies")
          .update({
            submission_status:
              "rejected",
            review_notes:
              "Existem documentos reprovados. Consulte as observações.",
          })
          .eq("id", company.id);

        if (companyError) {
          throw companyError;
        }

        setCompanyStatus("rejected");
      }

      setMessage(
        reviewStatus === "approved"
          ? "Documento aprovado com sucesso."
          : "Documento reprovado. A observação foi salva."
      );
    } catch (err) {
      setError(
        err.message ||
          "Não foi possível salvar a análise."
      );
    } finally {
      setSaving((current) => ({
        ...current,
        [doc.type]: false,
      }));
    }
  }

  async function reviewCompany(
    status
  ) {
    if (!canReview) return;

    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Sua sessão expirou. Entre novamente."
        );
      }

      if (status === "approved") {
        const missingRequired =
          documentTypes.filter(
            (item) => {
              const doc =
                documentMap[item.key];

              return (
                isMandatoryDocument(
                  item.key
                ) &&
                !hasDocumentFiles(doc)
              );
            }
          );

        if (
          missingRequired.length > 0
        ) {
          setError(
            `Não é possível aprovar a empresa enquanto houver ${missingRequired.length} documento(s) obrigatório(s) sem arquivo.`
          );

          return;
        }

        const rejected =
          documents.filter(
            (doc) =>
              doc.review_status ===
              "rejected"
          );

        if (rejected.length > 0) {
          setError(
            "Existem documentos reprovados. Corrija ou reavalie os documentos antes de aprovar a homologação."
          );

          return;
        }
      }

      const {
        error,
      } = await supabase
        .from("companies")
        .update({
          submission_status:
            status,
          reviewed_at:
            new Date().toISOString(),
          reviewed_by:
            user.id,
          review_notes:
            companyNotes || null,
        })
        .eq(
          "id",
          company.id
        );

      if (error) {
        throw error;
      }

      setCompanyStatus(status);

      setMessage(
        status === "approved"
          ? "Homologação da empresa aprovada."
          : "Homologação da empresa reprovada."
      );
    } catch (err) {
      setError(
        err.message ||
          "Não foi possível salvar a situação da empresa."
      );
    }
  }

  const approvedDocuments =
    documents.filter(
      (doc) =>
        doc.review_status ===
        "approved"
    ).length;

  const rejectedDocuments =
    documents.filter(
      (doc) =>
        doc.review_status ===
        "rejected"
    ).length;

  const pendingDocuments =
    documentTypes.length -
    approvedDocuments -
    rejectedDocuments;

  return (
    <div>
      <button
        className="back-button"
        onClick={onBack}
      >
        <ArrowLeft size={17} />
        Voltar para fornecedores
      </button>

      <div className="company-header">
        <div>
          <span className="eyebrow">
            ANÁLISE DA BUDEL
          </span>

          <h1>
            {company.legal_name}
          </h1>

          <p>
            CNPJ:{" "}
            {formatCnpj(
              company.cnpj
            )}
          </p>

          <span className="company-modality">
            {company.modality}
          </span>
        </div>

        <span className="status-badge status-pending">
          {companyStatusLabel(
            companyStatus
          )}
        </span>
      </div>

      {viewOnly && (
        <div className="alert success">
          <Eye size={16} />
          {" "}
          Este administrador possui somente permissão de visualização.
        </div>
      )}

      <div className="summary-grid">
        <div>
          <strong>
            {documents.length}
          </strong>
          <span>
            Documentos enviados
          </span>
        </div>

        <div>
          <strong>
            {approvedDocuments}
          </strong>
          <span>
            Aprovados
          </span>
        </div>

        <div>
          <strong>
            {rejectedDocuments}
          </strong>
          <span>
            Reprovados
          </span>
        </div>

        <div>
          <strong>
            {Math.max(
              0,
              pendingDocuments
            )}
          </strong>
          <span>
            Em análise
          </span>
        </div>
      </div>

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <div className="documents-header">
        <div>
          <h2>
            Documentação enviada
          </h2>

          <p className="muted">
            {canReview
              ? "Analise cada documento e registre a decisão da Budel."
              : "Visualize a documentação enviada pelo fornecedor."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">
          Carregando documentação...
        </div>
      ) : (
        <div className="documents-list">
          {documentTypes.map(
            (item) => (
              <AdminDocumentCard
                key={item.key}
                item={item}
                document={
                  documentMap[
                    item.key
                  ]
                }
                saving={
                  saving[
                    item.key
                  ]
                }
                onOpen={
                  openFiles
                }
                onReview={
                  reviewDocument
                }
                canReview={
                  canReview
                }
              />
            )
          )}
        </div>
      )}

      {canReview && (
        <div className="submit-box">
          <div style={{ flex: 1 }}>
            <h2>
              Decisão da homologação
            </h2>

            <p>
              Após analisar os documentos, registre a situação final desta
              empresa.
            </p>

            <label
              style={{
                display: "grid",
                gap: "7px",
                marginTop: "15px",
              }}
            >
              Observação geral da Budel

              <textarea
                value={
                  companyNotes
                }
                onChange={(e) =>
                  setCompanyNotes(
                    e.target.value
                  )
                }
                placeholder="Digite uma observação geral sobre a homologação..."
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="secondary-button"
              onClick={() =>
                reviewCompany(
                  "rejected"
                )
              }
            >
              <ShieldX size={18} />
              Reprovar homologação
            </button>

            <button
              className="primary-button"
              onClick={() =>
                reviewCompany(
                  "approved"
                )
              }
            >
              <ShieldCheck size={18} />
              Aprovar homologação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDocumentCard({
  item,
  document,
  saving,
  onOpen,
  onReview,
  canReview,
}) {
  const [notes, setNotes] =
    useState(
      document?.review_notes ||
        ""
    );

  useEffect(() => {
    setNotes(
      document?.review_notes ||
        ""
    );
  }, [document]);

  const status =
    documentStatus(document);

  const reviewStatus =
    document?.review_status ||
    "pending";

  const files =
    Array.isArray(
      document?.files
    )
      ? document.files
      : document?.file_path
      ? [
          {
            path:
              document.file_path,
            name:
              document.original_name ||
              "Documento",
          },
        ]
      : [];

  return (
    <div className="document-card">
      <div className="document-top">
        <div className="document-title">
          <div className="document-icon">
            <FileText size={21} />
          </div>

          <div>
            <h3>
              {item.label}

              {isMandatoryDocument(
                item.key
              ) && (
                <span className="required-mark">
                  {" "}
                  *
                </span>
              )}
            </h3>

            {item.description && (
              <p>
                {item.description}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent:
              "flex-end",
          }}
        >
          <StatusBadge
            status={status}
          />

          <ReviewBadge
            status={
              reviewStatus
            }
          />
        </div>
      </div>

      <div className="document-body">
        {files.length === 0 ? (
          <div className="required-document-notice">
            <AlertCircle size={16} />

            <span>
              Nenhum arquivo foi enviado para este documento.
              {document?.not_available
                ? " O fornecedor informou que não possui essa documentação."
                : ""}
            </span>
          </div>
        ) : (
          <>
            <div className="selected-files">
              {files.map(
                (
                  file,
                  index
                ) => (
                  <div
                    className="selected-file"
                    key={`${file.name}-${index}`}
                  >
                    <FileText size={16} />

                    <span
                      style={{
                        flex: 1,
                      }}
                    >
                      {file.name}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="document-actions">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() =>
                  onOpen(
                    document
                  )
                }
              >
                <Eye size={16} />
                Abrir arquivo(s)
              </button>
            </div>
          </>
        )}

        {document?.issue_date && (
          <div className="date-fields">
            <label>
              Data de emissão

              <input
                type="date"
                value={
                  document.issue_date
                }
                disabled
                readOnly
              />
            </label>

            <label>
              Data de validade

              <input
                type="date"
                value={
                  document.expiry_date ||
                  ""
                }
                disabled
                readOnly
              />
            </label>
          </div>
        )}

        {canReview && (
          <>
            <label
              style={{
                display: "grid",
                gap: "7px",
              }}
            >
              Observação da Budel

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="Digite o motivo da reprovação ou alguma observação..."
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                }}
              />
            </label>

            <div className="document-actions">
              <button
                type="button"
                className="secondary-button small-button"
                onClick={() =>
                  onReview(
                    document,
                    "rejected",
                    notes
                  )
                }
                disabled={
                  saving ||
                  !document ||
                  files.length === 0
                }
              >
                <XCircle size={16} />
                Reprovar documento
              </button>

              <button
                type="button"
                className="primary-button small-button"
                onClick={() =>
                  onReview(
                    document,
                    "approved",
                    notes
                  )
                }
                disabled={
                  saving ||
                  !document ||
                  files.length === 0
                }
              >
                <CheckCircle2 size={16} />
                Aprovar documento
              </button>
            </div>

            {saving && (
              <div className="muted">
                Salvando análise...
              </div>
            )}
          </>
        )}

        {!canReview &&
          document?.review_notes && (
            <div className="alert error">
              <strong>Observação da Budel:</strong>
              <br />
              {document.review_notes}
            </div>
          )}
      </div>
    </div>
  );
}

/* =========================================================
   APP PRINCIPAL
   ========================================================= */

export default function App() {
  const [session, setSession] =
    useState(null);

  const [page, setPage] =
    useState("home");

  const [authMode, setAuthMode] =
    useState("login");

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [adminProfile, setAdminProfile] =
    useState(null);

  const [
    checkingRole,
    setCheckingRole,
  ] = useState(false);

  async function checkAdminRole(user) {
    if (!user) {
      setIsAdmin(false);
      setAdminProfile(null);
      return false;
    }

    setCheckingRole(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, role, admin_keywords, admin_can_manage_users"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setIsAdmin(false);
        setAdminProfile(null);
        return false;
      }

      const admin =
        data?.role === "admin";

      setIsAdmin(admin);

      if (admin) {
        setAdminProfile(data);
      } else {
        setAdminProfile(null);
      }

      return admin;
    } catch (err) {
      console.error(err);
      setIsAdmin(false);
      setAdminProfile(null);
      return false;
    } finally {
      setCheckingRole(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: {
          session:
            currentSession,
        },
      } =
        await supabase.auth.getSession();

      if (!mounted) return;

      setSession(
        currentSession
      );

      if (
        currentSession?.user
      ) {
        const admin =
          await checkAdminRole(
            currentSession.user
          );

        if (admin) {
          setPage("admin");
        } else {
          setPage(
            "dashboard"
          );
        }
      }

      setCheckingSession(
        false
      );
    }

    loadSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          newSession
        ) => {
          setSession(
            newSession
          );

          if (
            newSession?.user
          ) {
            const admin =
              await checkAdminRole(
                newSession.user
              );

            if (admin) {
              setPage("admin");
            } else {
              setPage(
                "dashboard"
              );
            }
          } else {
            setIsAdmin(false);
            setAdminProfile(null);
            setPage("home");
          }
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function downloadChecklist() {
    const link =
      document.createElement(
        "a"
      );

    link.href =
      checklistUrl;

    link.download =
      "F103-04 - CheckList de Inspeção de Fornecedores.docx";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();
  }

  async function logout() {
    await supabase.auth.signOut();

    setSession(null);
    setIsAdmin(false);
    setAdminProfile(null);
    setPage("home");
  }

  if (
    checkingSession ||
    checkingRole
  ) {
    return (
      <div className="app-loading">
        Carregando portal...
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        session={session}
        isAdmin={isAdmin}
        onAdmin={() =>
          setPage("admin")
        }
        onLogout={logout}
        onHome={() =>
          setPage(
            session
              ? isAdmin
                ? "admin"
                : "dashboard"
              : "home"
          )
        }
        onDownload={
          downloadChecklist
        }
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
          onDownload={
            downloadChecklist
          }
        />
      )}

      {page === "auth" &&
        !session && (
          <AuthPage
            mode={authMode}
            setMode={
              setAuthMode
            }
            onBack={() =>
              setPage("home")
            }
          />
        )}

      {page === "dashboard" &&
        session &&
        !isAdmin && (
          <SupplierDashboard />
        )}

      {page === "admin" &&
        session &&
        isAdmin &&
        adminProfile && (
          <AdminDashboard
            adminProfile={adminProfile}
            onBack={() =>
              setPage("home")
            }
          />
        )}

      <footer className="site-footer">
        <div>
          <strong>
            Budel Transportes Ltda
          </strong>

          <span>
            Portal de Homologação de Fornecedores
          </span>
        </div>
      </footer>
    </div>
  );
}
