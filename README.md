# Portal de Homologação de Fornecedores — Budel

Portal web para fornecedores cadastrarem vários CNPJs e enviarem documentos de homologação. A equipe Budel possui um painel administrativo para consultar documentos, acompanhar vencimentos, gerar relatório CSV e disparar lembretes por e-mail.

## O que já está implementado

- Visual inspirado no cabeçalho enviado pela Budel: fundo branco, logo e linha vermelha.
- Botão **Enviar documentos para homologação**.
- Cadastro/login do fornecedor.
- Uma conta pode ter vários CNPJs.
- Cadastro de razão social, CNPJ e modalidade.
- Checklist F103-04 para download.
- Upload dos documentos:
  - Cartão CNPJ
  - Alvará de Localização e Funcionamento
  - Corpo de Bombeiros
  - Licença Sanitária
  - Licença de Operação
  - Certificado de Regularidade (IBAMA)
  - Autorização Ambiental para Transporte Interestadual de Produtos Perigosos
  - Checklist F103-04 preenchido
  - Fotos do local
  - Outros documentos
- Data de validade para documentos aplicáveis.
- Checkbox **Não possuímos essa documentação**.
- O fornecedor não consegue enviar a homologação enquanto os campos obrigatórios não estiverem preenchidos ou marcados como inexistentes.
- Painel mostra OK, próximos do vencimento, vencidos e pendentes.
- Área Budel com todos os CNPJs cadastrados.
- Visualização de arquivos por URL assinada e bucket privado.
- Relatório CSV.
- Função para enviar e-mails de documentos próximos do vencimento.
- RLS do Supabase para separar fornecedor e administrador.

## Arquitetura

- Frontend: React + Vite
- Backend: Supabase Auth + PostgreSQL + Storage + Edge Functions
- E-mail: Resend
- GitHub: armazenamento/versionamento do código
- Hospedagem do frontend: Vercel, Netlify ou outro serviço que rode Vite

> GitHub Pages sozinho não é suficiente para o backend de login, banco, arquivos e e-mail. O projeto usa Supabase para isso.

## 1. Criar o projeto no Supabase

Crie um projeto em https://supabase.com/.

Depois abra **SQL Editor** e execute:

`supabase/schema.sql`

O SQL cria:
- profiles
- companies
- documents
- permissões RLS
- bucket privado `supplier-documents`
- políticas de upload/leitura
- trigger que cria o perfil após cadastro

## 2. Criar a conta administrativa da Budel

Cadastre normalmente uma conta no portal.

Depois, no SQL Editor, execute:

```sql
update public.profiles
set role = 'admin'
where email = 'EMAIL_DA_BUDEL';
```

Não deixe a chave `service_role` no frontend.

## 3. Configurar o frontend

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

Instale e rode:

```bash
npm install
npm run dev
```

## 4. Configurar e-mail de vencimento

Crie uma conta no Resend.

No Supabase, configure os secrets da Edge Function:

```bash
supabase secrets set RESEND_API_KEY="SUA_CHAVE"
supabase secrets set REMINDER_FROM_EMAIL="Homologação Budel <seu-email@seudominio.com>"
```

Faça o deploy da função:

```bash
supabase functions deploy send-expiry-reminders
```

A função só permite chamada por usuário cujo `profiles.role` seja `admin`.

## 5. Agendamento automático

Para deixar os lembretes automáticos, você pode agendar a execução da Edge Function diariamente usando um cron/scheduler do Supabase.

A regra atual é: documentos com validade entre **hoje e os próximos 30 dias** entram no lembrete.

## 6. Subir no GitHub

```bash
git init
git add .
git commit -m "Portal de homologacao de fornecedores Budel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/budel-homologacao.git
git push -u origin main
```

Depois conecte o repositório ao Vercel/Netlify e informe as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Próximas melhorias recomendadas

1. Criar aprovação/reprovação individual dos documentos pela Budel.
2. Campo de observação da Budel em cada documento.
3. Histórico de versões dos documentos.
4. Histórico de quem alterou cada documento.
5. Relatório em Excel/PDF.
6. Dashboard com gráficos.
7. E-mail automático quando a Budel aprovar/reprovar.
8. Cadastro de mais usuários dentro da mesma empresa.
9. Validação de CNPJ e preenchimento automático da razão social.
10. Configurar os tipos de documento e prazos por modalidade de fornecedor.
