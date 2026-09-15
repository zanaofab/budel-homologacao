import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") || "Homologação Budel <onboarding@resend.dev>";

    const adminClient = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await adminClient.auth.getUser(jwt);
    if (userError || !user) throw new Error("Não autenticado.");

    const { data: requester } = await adminClient.from("profiles").select("role").eq("id", user.id).single();
    if (requester?.role !== "admin") throw new Error("Acesso restrito à equipe Budel.");

    let body: { company_id?: string } = {};
    try { body = await req.json(); } catch {}

    const today = new Date();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    let query = adminClient
      .from("documents")
      .select("id,type,expiry_date,company_id,companies(id,legal_name,cnpj,owner_id,profiles(email,full_name))")
      .not("expiry_date","is",null)
      .gte("expiry_date", today.toISOString().slice(0,10))
      .lte("expiry_date", limit.toISOString().slice(0,10))
      .eq("not_available", false);

    if (body.company_id) query = query.eq("company_id", body.company_id);

    const { data: docs, error } = await query;
    if (error) throw error;

    const grouped = new Map<string, any>();
    for (const doc of docs || []) {
      const c = doc.companies;
      const email = c?.profiles?.email;
      if (!email) continue;
      if (!grouped.has(doc.company_id)) grouped.set(doc.company_id, { company: c, docs: [] });
      grouped.get(doc.company_id).docs.push(doc);
    }

    const documentNames: Record<string,string> = {
      alvara:"Alvará de Localização e Funcionamento",
      bombeiro:"Corpo de Bombeiros",
      licenca_sanitaria:"Licença Sanitária",
      licenca_operacao:"Licença de Operação",
      ibama_regularidade:"Certificado de Regularidade (IBAMA)",
      autorizacao_ambiental:"Autorização Ambiental para Transporte Interestadual de Produtos Perigosos"
    };

    let sent = 0;
    for (const item of grouped.values()) {
      const rows = item.docs.map((d:any) => {
        const date = new Date(`${d.expiry_date}T00:00:00`).toLocaleDateString("pt-BR");
        return `<li><strong>${documentNames[d.type] || d.type}</strong> — validade ${date}</li>`;
      }).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;color:#222">
          <h2>Documentação próxima do vencimento</h2>
          <p>Olá, ${item.company.profiles.full_name || "fornecedor"}.</p>
          <p>A documentação do CNPJ <strong>${item.company.cnpj}</strong> (${item.company.legal_name}) possui os seguintes documentos próximos do vencimento:</p>
          <ul>${rows}</ul>
          <p>Acesse o Portal de Homologação de Fornecedores para substituir os documentos.</p>
          <p>Atenciosamente,<br><strong>Budel Transportes Ltda.</strong></p>
        </div>`;

      const resp = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{ "Authorization":`Bearer ${resendKey}`, "Content-Type":"application/json" },
        body:JSON.stringify({ from:fromEmail, to:[item.company.profiles.email], subject:`Budel — documentação próxima do vencimento (${item.company.legal_name})`, html })
      });
      if (resp.ok) sent++;
    }

    return new Response(JSON.stringify({ message:`Lembretes enviados para ${sent} fornecedor(es).`, sent }), {
      headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno." }), {
      status:400, headers:{...corsHeaders,"Content-Type":"application/json"}
    });
  }
});
