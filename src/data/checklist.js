export const checklistSections = [
  {
    title: "Setor - Segurança, Saúde e Meio Ambiente",
    questions: [
      "A empresa possui procedimentos de segurança para os serviços que realiza?",
      "As instalações da empresa oferecem segurança aos funcionários e veículos?",
      "A empresa oferece cursos e treinamentos aos funcionários?",
      "A empresa trabalha preventivamente para evitar danos ambientais?",
      "A empresa realiza o armazenamento/descarte de resíduos adequadamente (existe comprovação)?"
    ]
  },
  {
    title: "Setor - Manutenção",
    questions: [
      "A empresa trabalha com PS (permissão de serviço) ou liberação para início da manutenção?",
      "A empresa fornece EPI's aos funcionários para os serviços de manutenção?",
      "A empresa fiscaliza ou acompanha o uso dos EPI's pelos funcionários?",
      "A empresa oferece ferramentas adequadas aos funcionários para os serviços de manutenção?",
      "Os funcionários possuem qualificação comprovada para realizarem os serviços de manutenção?",
      "O supervisor dos funcionários possui qualificação comprovada?",
      "A empresa possui procedimentos para realização de cada serviço de manutenção?",
      "A empresa possui sistema informatizado de manutenção?",
      "Em caso de serviço de pneus, a empresa (recapadora ou vendedora) é conhecida no mercado e possui certificação positiva?",
      "Em caráter de evidencia deverá ser solicitado normas de ética empresarial, direitos humanos, condições de trabalho, saúde, segurança e meio ambiente."
    ]
  },
  {
    title: "Serviços de Lavagem e Desvaporização de CT's",
    questions: [
      "A empresa trabalha com PS (permissão de serviço) nas desvaporizações?",
      "A empresa segue o procedimento de desvaporização?",
      "O local da realização da desvaporização é adequado e segue o determinado pelo procedimento?",
      "Os equipamentos para desvaporizar os tanques são adequados?",
      "O explosímetro para medição é adequado e passa por calibração e aferição corretamente?",
      "Os funcionários possuem treinamento adequado e conhecem os procedimentos?",
      "A empresa emite certificado de desvaporização conforme procedimento?"
    ]
  }
];

export const documentTypes = [
  { key: "cartao_cnpj", label: "Cartão CNPJ", required: true, expires: false },
  { key: "alvara", label: "Alvará de Localização e Funcionamento", required: true, expires: true },
  { key: "bombeiro", label: "Corpo de Bombeiros", required: true, expires: true },
  { key: "licenca_sanitaria", label: "Licença Sanitária", required: true, expires: true },
  { key: "licenca_operacao", label: "Licença de Operação", required: true, expires: true },
  { key: "ibama_regularidade", label: "Certificado de Regularidade (IBAMA)", required: true, expires: true },
  { key: "autorizacao_ambiental", label: "Autorização Ambiental para Transporte Interestadual de Produtos Perigosos", required: true, expires: true },
  { key: "checklist", label: "Checklist F103-04 preenchido", required: true, expires: false },
  { key: "fotos_local", label: "Fotos do local", required: true, expires: false },
  { key: "outros", label: "Outros documentos", required: false, expires: false }
];
