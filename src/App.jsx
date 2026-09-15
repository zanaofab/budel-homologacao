import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { documentTypes, checklistSections } from "./data/checklist";
import {
  ArrowLeft, Building2, CalendarClock, CheckCircle2, ChevronRight,
  ClipboardCheck, Download, FileText, FolderOpen, LogIn, LogOut,
  Mail, Plus, RefreshCw, Search, ShieldCheck, Upload, UserPlus,
  AlertTriangle, XCircle, Eye, BarChart3
} from "lucide-react";

const BUDEL_RED = "#e30613";

function formatCnpj(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date) {
  if (!date) return null;
  const a = new Date(`${todayISO()}T00:00:00`);
  const b = new Date(`${date}T00:00:00`);
  return Math.ceil((b - a) / 86400000);
}

function statusFor(doc) {
  if (!doc || (!doc.file_path && !doc.not_available)) return { key: "missing", label: "Pendente", tone: "danger" };
  if (doc.not_available) return { key: "nao_possui", label: "Não possui", tone: "neutral" };
  if (doc.expiry_date) {
    const d = daysUntil(doc.expiry_date);
    if (d < 0) return { key: "expired", label: "Vencido", tone: "danger" };
    if (d <= 30) return { key: "expiring", label: `Vence em ${d}d`, tone: "warning" };
  }
  return { key: "ok", label: "OK", tone: "success" };
}

function StatusBadge({ status }) {
  const s = typeof status === "string" ? { key: status, label: status, tone: "neutral" } : status;
  const Icon = s.tone === "success" ? CheckCircle2 : s.tone === "warning" ? CalendarClock : s.tone === "danger" ? AlertTriangle : XCircle;
  return <span className={`status-badge ${s.tone}`}><Icon size={14}/>{s.label}</span>;
}

function Header({ user, onLogout, onHome, onSupplierArea, onAdminArea, profile }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" onClick={onHome}>
          <img src="/budel-logo.png" alt="Budel" />
        </button>
        <div className="topbar-title">Homologação de Fornecedores</div>
        <nav>
          <a href="/checklist/F103-04 - CheckList de Inspeção de Fornecedores.docx" download className="nav-download">
            <Download size={16}/> Baixar checklist
          </a>
          {!user && <button onClick={onSupplierArea} className="nav-button">Área do fornecedor</button>}
          {profile?.role === "admin" && <button onClick={onAdminArea} className="nav-button">Painel Budel</button>}
          {user && <button onClick={onLogout} className="nav-button"><LogOut size={16}/> Sair</button>}
        </nav>
      </div>
    </header>
  );
}

function Home({ onStart, onLogin }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">BUDEL TRANSPORTES LTDA</span>
          <h1>Portal de Homologação de Fornecedores</h1>
          <p>Envie e acompanhe toda a documentação da sua empresa em um único lugar.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={onStart}><Upload size={18}/> Enviar documentos para homologação</button>
            <button className="secondary-btn" onClick={onLogin}><LogIn size={18}/> Entrar na minha conta</button>
          </div>
        </div>
        <div className="hero-card">
          <ShieldCheck size={44}/>
          <h3>Mais simples para você</h3>
          <p>Uma conta pode ter vários CNPJs. Você vê documentos pendentes, aprovados e próximos do vencimento.</p>
        </div>
      </section>

      <section className="feature-grid">
        <Feature icon={<Building2/>} title="Vários CNPJs" text="Cadastre todos os CNPJs da sua empresa na mesma conta."/>
        <Feature icon={<FolderOpen/>} title="Documentos centralizados" text="Envie arquivos, datas de validade e marque quando a documentação não existir."/>
        <Feature icon={<CalendarClock/>} title="Controle de validade" text="O painel destaca documentos vencidos e próximos do vencimento."/>
        <Feature icon={<ClipboardCheck/>} title="Checklist F103-04" text="Baixe o checklist oficial e envie o preenchido junto com a homologação."/>
      </section>
    </main>
  );
}

function Feature({icon,title,text}) {
  return <div className="feature-card"><div className="feature-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div></div>
}

function Auth({ mode, setMode, onBack, onAuthenticated }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } }
        });
        if (error) throw error;
        if (!data.session) setMessage("Conta criada. Verifique seu e-mail se a confirmação de e-mail estiver ativada no Supabase.");
        else onAuthenticated(data.session.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated(data.user);
      }
    } catch (err) { setError(err.message || "Não foi possível concluir."); }
    finally { setLoading(false); }
  }

  return <main className="auth-page">
    <div className="auth-card">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Voltar</button>
      <img className="auth-logo" src="/budel-logo.png" alt="Budel"/>
      <h1>{mode === "signup" ? "Criar conta do fornecedor" : "Entrar no portal"}</h1>
      <p className="muted">{mode === "signup" ? "Uma conta pode cadastrar vários CNPJs." : "Acesse seus CNPJs e documentos."}</p>
      <form onSubmit={submit}>
        {mode === "signup" && <label>Nome / responsável<input value={name} onChange={e=>setName(e.target.value)} required/></label>}
        <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
        <label>Senha<input type="password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <button className="primary-btn full" disabled={loading}>{loading ? "Aguarde..." : mode === "signup" ? <><UserPlus size={18}/> Criar conta</> : <><LogIn size={18}/> Entrar</>}</button>
      </form>
      <button className="text-button" onClick={()=>setMode(mode==="signup"?"login":"signup")}>
        {mode === "signup" ? "Já tenho uma conta" : "Ainda não tenho conta"}
      </button>
    </div>
  </main>
}

function SupplierDashboard({ profile }) {
  const [companies,setCompanies]=useState([]);
  const [selected,setSelected]=useState(null);
  const [loading,setLoading]=useState(true);
  const [showNew,setShowNew]=useState(false);
  const [message,setMessage]=useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("companies").select("*").order("created_at",{ascending:false});
    if (!error) setCompanies(data || []);
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  async function createCompany(payload) {
    const { data, error } = await supabase.from("companies").insert(payload).select().single();
    if (error) return setMessage(error.message);
    setCompanies(c=>[data,...c]); setShowNew(false); setSelected(data);
  }

  if (selected) return <CompanyEditor company={selected} onBack={()=>{setSelected(null);load()}} onSaved={load}/>;

  return <main className="dashboard">
    <div className="page-heading">
      <div><span className="eyebrow">ÁREA DO FORNECEDOR</span><h1>Meus CNPJs</h1><p>Cadastre e acompanhe a documentação de cada empresa.</p></div>
      <button className="primary-btn" onClick={()=>setShowNew(true)}><Plus size={18}/> Adicionar CNPJ</button>
    </div>
    {message && <div className="alert error">{message}</div>}
    {loading ? <Loading/> : companies.length === 0 ? <EmptyState onAdd={()=>setShowNew(true)}/> :
      <div className="company-grid">{companies.map(c=><CompanyCard key={c.id} company={c} onOpen={()=>setSelected(c)}/>)}</div>}
    {showNew && <NewCompanyModal onClose={()=>setShowNew(false)} onCreate={createCompany}/>}
  </main>
}

function EmptyState({onAdd}) {
  return <div className="empty-state"><Building2 size={44}/><h2>Nenhum CNPJ cadastrado</h2><p>Comece adicionando a primeira empresa.</p><button className="primary-btn" onClick={onAdd}><Plus size={18}/> Adicionar CNPJ</button></div>
}

function CompanyCard({company,onOpen}) {
  const [docs,setDocs]=useState([]);
  useEffect(()=>{supabase.from("documents").select("*").eq("company_id",company.id).then(({data})=>setDocs(data||[]))},[company.id]);
  const required=documentTypes.filter(x=>x.required);
  const statuses=required.map(t=>statusFor(docs.find(d=>d.type===t.key)));
  const ok=statuses.filter(s=>s.key==="ok").length;
  const expired=statuses.filter(s=>s.key==="expired").length;
  const missing=statuses.filter(s=>s.key==="missing").length;
  return <button className="company-card" onClick={onOpen}>
    <div className="company-card-head"><div className="company-icon"><Building2/></div><ChevronRight/></div>
    <h2>{company.legal_name}</h2><div className="cnpj">{formatCnpj(company.cnpj)}</div><div className="modality">{company.modality || "Modalidade não informada"}</div>
    <div className="mini-stats"><span><CheckCircle2 size={15}/>{ok} OK</span><span><AlertTriangle size={15}/>{expired} vencidos</span><span><FileText size={15}/>{missing} pendentes</span></div>
  </button>
}

function NewCompanyModal({onClose,onCreate}) {
  const [legal_name,setLegalName]=useState(""); const [cnpj,setCnpj]=useState(""); const [modality,setModality]=useState("");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    const digits=cnpj.replace(/\D/g,"");
    if(digits.length!==14){setError("Informe um CNPJ válido.");setBusy(false);return}
    const {data:{user}}=await supabase.auth.getUser();
    const payload={legal_name,cnpj:digits,modality,owner_id:user.id};
    const {error}=await supabase.from("companies").insert(payload);
    if(error)setError(error.message); else onCreate(payload);
    setBusy(false);
  }
  return <Modal title="Adicionar CNPJ" onClose={onClose}><form onSubmit={submit}>
    <label>Razão social<input value={legal_name} onChange={e=>setLegalName(e.target.value)} required/></label>
    <label>CNPJ<input value={formatCnpj(cnpj)} onChange={e=>setCnpj(e.target.value)} required placeholder="00.000.000/0000-00"/></label>
    <label>Modalidade da empresa<input value={modality} onChange={e=>setModality(e.target.value)} required placeholder="Ex.: Transportadora, manutenção..."/></label>
    {error&&<div className="alert error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={busy}>{busy?"Salvando...":"Cadastrar CNPJ"}</button></div>
  </form></Modal>
}

function CompanyEditor({company,onBack,onSaved}) {
  const [docs,setDocs]=useState([]);
  const [companyData,setCompanyData]=useState(company);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  async function load() {
    setLoading(true);
    const {data}=await supabase.from("documents").select("*").eq("company_id",company.id);
    setDocs(data||[]); setLoading(false);
  }
  useEffect(()=>{load()},[company.id]);

  const required = documentTypes.filter(x=>x.required);
  const missingRequired = required.filter(t=>{
    const d=docs.find(x=>x.type===t.key); return !d?.file_path && !d?.not_available;
  });

  async function updateCompany(e) {
    e.preventDefault(); setSaving(true); setError("");
    const {error}=await supabase.from("companies").update({legal_name:companyData.legal_name,modality:companyData.modality}).eq("id",company.id);
    if(error)setError(error.message); else {setMessage("Dados da empresa atualizados.");onSaved?.();}
    setSaving(false);
  }

  async function uploadDoc(type,file,expiryDate) {
    setError(""); setMessage("");
    const {data:{user}}=await supabase.auth.getUser();
    if(!file){setError("Selecione um arquivo.");return}
    const ext=file.name.split(".").pop();
    const path=`${user.id}/${company.id}/${type.key}/${crypto.randomUUID()}.${ext}`;
    const {error:upErr}=await supabase.storage.from("supplier-documents").upload(path,file,{upsert:false});
    if(upErr){setError(upErr.message);return}
    const existing=docs.find(d=>d.type===type.key);
    if(existing?.file_path) await supabase.storage.from("supplier-documents").remove([existing.file_path]);
    const payload={company_id:company.id,type:type.key,file_path:path,original_name:file.name,expiry_date:expiryDate||null,not_available:false};
    const {data,error:dbErr}=await supabase.from("documents").upsert(payload,{onConflict:"company_id,type"}).select().single();
    if(dbErr){setError(dbErr.message);return}
    setDocs(ds=>[...ds.filter(d=>d.type!==type.key),data]);setMessage(`${type.label} enviado.`);
  }

  async function markUnavailable(type,checked) {
    const existing=docs.find(d=>d.type===type.key);
    if(checked && existing?.file_path) await supabase.storage.from("supplier-documents").remove([existing.file_path]);
    const payload={company_id:company.id,type:type.key,file_path:checked?null:existing?.file_path||null,original_name:checked?null:existing?.original_name||null,not_available:checked,expiry_date:null};
    const {data,error}=await supabase.from("documents").upsert(payload,{onConflict:"company_id,type"}).select().single();
    if(error){setError(error.message);return}
    setDocs(ds=>[...ds.filter(d=>d.type!==type.key),data]);
  }

  async function openDoc(doc) {
    if(!doc?.file_path)return;
    const {data,error}=await supabase.storage.from("supplier-documents").createSignedUrl(doc.file_path,300);
    if(error)setError(error.message); else window.open(data.signedUrl,"_blank");
  }

  async function submitHomologation() {
    if(missingRequired.length){setError("Preencha todos os documentos obrigatórios ou marque “Não possuímos essa documentação”.");return}
    setSaving(true);setError("");setMessage("");
    const {error}=await supabase.from("companies").update({submission_status:"submitted",submitted_at:new Date().toISOString()}).eq("id",company.id);
    if(error)setError(error.message);else setMessage("Documentação enviada para homologação com sucesso.");
    setSaving(false);
  }

  return <main className="dashboard">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Voltar para meus CNPJs</button>
    <div className="page-heading">
      <div><span className="eyebrow">ENVIAR DOCUMENTOS PARA HOMOLOGAÇÃO</span><h1>{companyData.legal_name}</h1><p>CNPJ: {formatCnpj(companyData.cnpj)}</p></div>
      <StatusSummary docs={docs}/>
    </div>

    {message&&<div className="alert success">{message}</div>}
    {error&&<div className="alert error">{error}</div>}

    <section className="panel">
      <div className="panel-title"><div><h2>Dados da empresa</h2><p>Esses dados ficam vinculados ao CNPJ.</p></div></div>
      <form className="form-grid" onSubmit={updateCompany}>
        <label>Razão social<input value={companyData.legal_name} onChange={e=>setCompanyData({...companyData,legal_name:e.target.value})} required/></label>
        <label>CNPJ<input value={formatCnpj(companyData.cnpj)} disabled/></label>
        <label>Modalidade da empresa<input value={companyData.modality||""} onChange={e=>setCompanyData({...companyData,modality:e.target.value})} required/></label>
        <div className="form-end"><button className="secondary-btn" disabled={saving}>Salvar dados</button></div>
      </form>
    </section>

    <section className="panel">
      <div className="panel-title"><div><h2>Documentação</h2><p>Envie o arquivo e, quando aplicável, informe a data de validade.</p></div><a className="secondary-btn" href="/checklist/F103-04 - CheckList de Inspeção de Fornecedores.docx" download><Download size={16}/> Baixar Checklist F103-04</a></div>
      {loading?<Loading/>:<div className="doc-list">{documentTypes.map(t=><DocumentRow key={t.key} type={t} doc={docs.find(d=>d.type===t.key)} onUpload={uploadDoc} onUnavailable={markUnavailable} onOpen={openDoc}/>)}</div>}
    </section>

    <section className="submit-box">
      <div><h2>Enviar para a Budel</h2><p>{missingRequired.length ? `Ainda faltam ${missingRequired.length} item(ns). Você pode marcar “Não possuímos” quando aplicável.` : "Todos os itens obrigatórios estão preenchidos."}</p></div>
      <button className="primary-btn" onClick={submitHomologation} disabled={saving || !!missingRequired.length}>{saving?"Enviando...":"Enviar documentos para homologação"}</button>
    </section>
  </main>
}

function StatusSummary({docs}) {
  const required=documentTypes.filter(x=>x.required);
  const statuses=required.map(t=>statusFor(docs.find(d=>d.type===t.key)));
  return <div className="summary-strip"><span><CheckCircle2/>{statuses.filter(s=>s.key==="ok").length} OK</span><span><CalendarClock/>{statuses.filter(s=>s.key==="expiring").length} próximos</span><span><AlertTriangle/>{statuses.filter(s=>s.key==="expired").length} vencidos</span><span><FileText/>{statuses.filter(s=>s.key==="missing").length} pendentes</span></div>
}

function DocumentRow({type,doc,onUpload,onUnavailable,onOpen}) {
  const [file,setFile]=useState(null); const [expiry,setExpiry]=useState(doc?.expiry_date||""); const [busy,setBusy]=useState(false);
  const status=statusFor(doc);
  async function send() {setBusy(true);await onUpload(type,file,expiry);setBusy(false)}
  return <div className={`doc-row ${status.tone}`}>
    <div className="doc-info"><div className="doc-icon"><FileText/></div><div><h3>{type.label} {type.required&&<span className="required">*</span>}</h3><StatusBadge status={status}/>{doc?.original_name&&<span className="file-name">{doc.original_name}</span>}</div></div>
    <div className="doc-actions">
      {type.expires&&<label className="date-field">Validade<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>}
      <label className="file-input"><Upload size={16}/>{file?file.name:"Escolher arquivo"}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
      <button className="small-btn" onClick={send} disabled={busy||!file}>{busy?"...":"Enviar"}</button>
      {doc?.file_path&&<button className="icon-btn" title="Visualizar" onClick={()=>onOpen(doc)}><Eye size={17}/></button>}
      <label className="na-check"><input type="checkbox" checked={!!doc?.not_available} onChange={e=>onUnavailable(type,e.target.checked)}/> Não possuímos</label>
    </div>
  </div>
}

function Loading(){return <div className="loading"><RefreshCw className="spin"/> Carregando...</div>}
function Modal({title,onClose,children}){return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>}

function AdminDashboard() {
  const [companies,setCompanies]=useState([]); const [selected,setSelected]=useState(null); const [search,setSearch]=useState(""); const [filter,setFilter]=useState("all"); const [loading,setLoading]=useState(true); const [message,setMessage]=useState("");
  async function load(){setLoading(true);const {data}=await supabase.from("companies").select("*,documents(*)").order("created_at",{ascending:false});setCompanies(data||[]);setLoading(false)}
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>companies.filter(c=>{
    const q=search.toLowerCase(); const matches=!q||c.legal_name.toLowerCase().includes(q)||c.cnpj.includes(q);
    const docs=c.documents||[]; const required=documentTypes.filter(x=>x.required);
    const hasExpired=required.some(t=>statusFor(docs.find(d=>d.type===t.key)).key==="expired");
    const hasMissing=required.some(t=>statusFor(docs.find(d=>d.type===t.key)).key==="missing");
    return matches && (filter==="all" || (filter==="expired"&&hasExpired) || (filter==="missing"&&hasMissing) || (filter==="submitted"&&c.submission_status==="submitted"));
  }),[companies,search,filter]);

  function exportCsv(){
    const rows=[["Razão social","CNPJ","Modalidade","Status envio","OK","Vencidos","Pendentes","Próximos do vencimento"]];
    filtered.forEach(c=>{const req=documentTypes.filter(x=>x.required);const ss=req.map(t=>statusFor((c.documents||[]).find(d=>d.type===t.key)));rows.push([c.legal_name,formatCnpj(c.cnpj),c.modality||"",c.submission_status||"draft",ss.filter(s=>s.key==="ok").length,ss.filter(s=>s.key==="expired").length,ss.filter(s=>s.key==="missing").length,ss.filter(s=>s.key==="expiring").length])});
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\\n");
    const blob=new Blob(["\\ufeff"+csv],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="relatorio-homologacao-budel.csv";a.click();URL.revokeObjectURL(a.href);
  }

  async function reminders(){
    setMessage("Enviando lembretes...");
    const {data,error}=await supabase.functions.invoke("send-expiry-reminders",{body:{}});
    if(error)setMessage("Erro ao enviar lembretes: "+error.message); else setMessage(data?.message||"Lembretes enviados.");
  }

  return <main className="dashboard">
    <div className="page-heading"><div><span className="eyebrow">PAINEL BUDEL</span><h1>Homologação de fornecedores</h1><p>Visualize CNPJs, documentos e vencimentos.</p></div><div className="admin-actions"><button className="secondary-btn" onClick={exportCsv}><BarChart3 size={16}/> Gerar relatório</button><button className="primary-btn" onClick={reminders}><Mail size={16}/> Enviar lembretes</button></div></div>
    {message&&<div className="alert success">{message}</div>}
    <div className="filterbar"><div className="search"><Search size={17}/><input placeholder="Buscar razão social ou CNPJ" value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="missing">Com pendências</option><option value="expired">Com vencidos</option><option value="submitted">Enviados para análise</option></select></div>
    {loading?<Loading/>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Modalidade</th><th>Documentos</th><th>Envio</th><th></th></tr></thead><tbody>{filtered.map(c=><AdminRow key={c.id} company={c} onOpen={()=>setSelected(c)}/>)}</tbody></table></div>}
    {selected&&<AdminCompanyModal company={selected} onClose={()=>{setSelected(null);load()}}/>}
  </main>
}

function AdminRow({company,onOpen}) {
  const req=documentTypes.filter(x=>x.required);const ss=req.map(t=>statusFor((company.documents||[]).find(d=>d.type===t.key)));
  return <tr><td><strong>{company.legal_name}</strong></td><td>{formatCnpj(company.cnpj)}</td><td>{company.modality||"-"}</td><td><span className="table-stat">{ss.filter(s=>s.key==="ok").length} OK</span><span className="table-stat danger-text">{ss.filter(s=>s.key==="expired").length} venc.</span><span className="table-stat">{ss.filter(s=>s.key==="missing").length} pend.</span></td><td><StatusBadge status={company.submission_status==="submitted"?{label:"Enviado",tone:"success"}:{label:"Rascunho",tone:"neutral"}}/></td><td><button className="small-btn" onClick={onOpen}>Ver documentação</button></td></tr>
}

function AdminCompanyModal({company,onClose}) {
  return <Modal title={company.legal_name} onClose={onClose}><div className="admin-detail"><p><strong>CNPJ:</strong> {formatCnpj(company.cnpj)}</p><p><strong>Modalidade:</strong> {company.modality||"-"}</p><p><strong>Status:</strong> {company.submission_status==="submitted"?"Enviado para análise":"Ainda não enviado"}</p><hr/>{documentTypes.map(t=>{const d=(company.documents||[]).find(x=>x.type===t.key);return <div className="admin-doc" key={t.key}><div><strong>{t.label}</strong><br/><StatusBadge status={statusFor(d)}/>{d?.expiry_date&&<span className="muted"> Validade: {new Date(d.expiry_date+"T00:00:00").toLocaleDateString("pt-BR")}</span>}</div>{d?.file_path&&<AdminDocLink doc={d}/>}</div>})}</div></Modal>
}

function AdminDocLink({doc}) {
  const [busy,setBusy]=useState(false);
  async function open(){setBusy(true);const {data}=await supabase.storage.from("supplier-documents").createSignedUrl(doc.file_path,600);setBusy(false);if(data?.signedUrl)window.open(data.signedUrl,"_blank")}
  return <button className="small-btn" onClick={open}>{busy?"...":"Abrir arquivo"}</button>
}

export default function App() {
  const [session,setSession]=useState(null); const [profile,setProfile]=useState(null); const [view,setView]=useState("home"); const [authMode,setAuthMode]=useState("login"); const [boot,setBoot]=useState(true);
  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{if(data.session){setSession(data.session);await loadProfile(data.session.user.id)}setBoot(false)});
    const {data:listener}=supabase.auth.onAuthStateChange(async(_event,s)=>{setSession(s);if(s)await loadProfile(s.user.id);else setProfile(null)});
    return ()=>listener.subscription.unsubscribe();
  },[]);
  async function loadProfile(id){const {data}=await supabase.from("profiles").select("*").eq("id",id).single();setProfile(data)}
  async function logout(){await supabase.auth.signOut();setView("home")}
  if(boot)return <Loading/>;

  const effectiveView=session ? (view==="home"||view==="auth" ? (profile?.role==="admin"?"admin":"supplier") : view) : view;

  return <div className="app">
    <Header user={session} profile={profile} onLogout={logout} onHome={()=>setView("home")} onSupplierArea={()=>{setAuthMode("login");setView("auth")}} onAdminArea={()=>setView("admin")}/>
    {!session && effectiveView==="home" && <Home onStart={()=>{setAuthMode("signup");setView("auth")}} onLogin={()=>{setAuthMode("login");setView("auth")}}/>}
    {!session && effectiveView==="auth" && <Auth mode={authMode} setMode={setAuthMode} onBack={()=>setView("home")} onAuthenticated={()=>setView("supplier")}/>}
    {session && effectiveView==="supplier" && <SupplierDashboard profile={profile}/>}
    {session && effectiveView==="admin" && profile?.role==="admin" && <AdminDashboard/>}
    {session && effectiveView==="admin" && profile?.role!=="admin" && <main className="auth-page"><div className="auth-card"><XCircle/><h1>Acesso restrito</h1><p>Esta área é exclusiva da equipe Budel.</p></div></main>}
  </div>
}
