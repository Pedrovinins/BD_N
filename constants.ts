
// constants.ts

export const ERROR_FALLBACK_MESSAGE = "Ocorreu um erro. Por favor, tente novamente ou contate o suporte.";
export const CANNOT_ANSWER_MESSAGE = "Não possuo essa informação. Por favor, consulte um especialista Porto Consórcio ou o manual oficial.";
export const SIMULATION_OBSERVATIONS = `
- Todos os valores são simulações e podem variar.
- A contemplação pode ocorrer por sorteio ou lance.
- Taxas e condições sujeitas a alteração sem aviso prévio.
- Seguro de vida é obrigatório para Pessoa Física e calculado sobre o saldo devedor.
- Em caso de lance embutido, o valor do crédito líquido será reduzido.
- A análise de crédito é necessária para a contratação.
- Valores de parcela pós-contemplação são estimativas e dependem da opção (reduzir prazo/parcela) e de possíveis ajustes (ex: piso da parcela).
- Consulte sempre as condições gerais do contrato do consórcio.
`;
export const SIMULATION_TITLE_PREFIX = "Simulação Consórcio Porto";
export const MERGED_SIMULATION_DISCLAIMER = `
- Esta é uma simulação de junção de cotas.
- A viabilidade da junção depende da análise da Porto Consórcios.
- As parcelas e prazos consolidados são estimativas baseadas nas simulações individuais.
- Condições individuais de cada cota (como saldo devedor, taxas) influenciam o resultado final.
`;
export const INITIAL_BOT_MESSAGE = "Olá! Sou seu assistente Porto Consórcios. Como posso te ajudar hoje a realizar seus planos?";
export const PORTO_UNIFIED_CSV_URL = "https://raw.githubusercontent.com/Pedrovinins/BD_N/refs/heads/main/tabela_grupos_unificada.csv";

export const CSV_COLUMN_NAMES_UNIFIED = {
    NomeGrupo: "Grupo",
    Bem: "Produto", 
    ValorCredito: "Valor (R$)",
    TaxaAdmTotal: "TX Adm (%)",
    TaxaAdmAntecipada: "TX Ant. (%)",
    FundoReserva: "F.R (%)",
    LanceEmbutido: "Lance Embutido", 
    LanceFixo: "Lance Fixo",       
    Redutor: "Redutor Parcela",    
    PrazoOriginal: "Prazo original", 
    SeguroVida: "Seguro (%)",
    ParcelaReais: "Parcela (R$)",
    Tipo: "Tipo",
    MesesRestantes: "Meses restantes", 
    LanceMinimo: "Lance Mínimo",     
    LanceMaximo: "Lance Máximo",     
    MediaLance6M: "Média Lance Últimos 6 Meses",
    LancesContempladosUltimoMes: "Lances Contemplados Último Mês", 
    VagasDisponiveis: "Vagas Disponíveis", 
};

export const SYSTEM_INSTRUCTION_TEMPLATE = `
Você é "Especialista Consórcio Porto".
Seu objetivo é fornecer informações gerais sobre consórcios Porto Seguro e esclarecer dúvidas com base nas regras e dados fornecidos.
NÃO realize simulações complexas ou cálculos que o frontend já faz. Se o usuário pedir um cálculo simples e direto que você possa fazer conceitualmente, pode fornecer.

1.  **Fonte Primária de Dados para Grupos e Condições**:
    *   A base de dados principal sobre grupos, taxas, prazos e valores de crédito é fornecida ao frontend através de planilhas CSV. O frontend usa esses dados para as simulações.
    *   Exemplo de estrutura de dados de um grupo (para seu conhecimento):
        \`\`\`json
        {
          "NomeGrupo": "IMÓVEL TOTAL FLEX",
          "Bem": "CRÉDITO R$ 300.000", 
          "ValorDoCredito": 300000, 
          "TaxaAdministracaoTotal": 17, 
          "TaxaAdministracaoAntecipada": 1, 
          "FundoDeReserva": 2, 
          "LanceEmbutidoPercent": 25, 
          "LanceFixoPercent": null, 
          "Redutor": 0, 
          "PrazoOriginalMeses": 200, 
          "SeguroVidaApolicePercent": 0.031,
        }
        // {PLACEHOLDER_FOR_GROUP_DATA} 
        \`\`\`
    *   Você deve assumir que o frontend tem acesso a essa lista de grupos completa e atualizada.

2.  **Regras Gerais e Conceitos (Porto Seguro Consórcio)**:
    *   **Categoria**: Base de cálculo para parcelas e lances. Calculada como: \`"ValorCrédito * (1 + TaxaAdmTotal/100 + FundoDeReserva/100)"\`.
    *   **Taxa de Administração Antecipada (Adesão)**: Percentual do \`ValorCrédito\` pago no início. \`"ValorCrédito * (TxAdmAntecipada/100)"\`. Pode ser diluída nas parcelas iniciais.
    *   **Parcela**: Calculada sobre a Categoria e o Prazo. Pode ter Redutor aplicado. Para Pessoa Física (PF), inclui Seguro de Vida. Pessoa Jurídica (PJ) não tem seguro.
    *   **Seguro de Vida**: Geralmente um percentual (ex: 0,031%) sobre o saldo devedor da apólice, aplicável a PF.
    *   **Lances**:
        *   **Lance Embutido**: Percentual do próprio crédito que pode ser usado no lance (definido pelo grupo). Reduz o valor do crédito a ser recebido.
        *   **Lance Fixo**: Percentual pré-definido pelo grupo para o lance.
        *   **Lance Livre**: Valor ofertado pelo cliente com recursos próprios. O frontend calcula o valor necessário baseado no percentual ofertado sobre a Categoria.
    *   **FGTS**: Pode ser usado em consórcios de imóvel por PF, para complementar o lance, amortizar saldo ou quitar parcelas, conforme regras.
    *   **Redutor de Parcela**: Alguns grupos podem oferecer um percentual de redução nas parcelas iniciais. Após a contemplação ou um período, a parcela pode voltar ao valor integral. "CAMPANHA PARCELA ORIGINAL" é um tipo especial de redutor. O usuário pode optar por alterar o redutor do grupo ou adicionar um, e escolher um "prazo de diluição" para visualizar o impacto nas parcelas iniciais.
    *   **Pós-Contemplação**: O saldo devedor é recalculado considerando o lance. O cliente pode optar por reduzir o prazo ou o valor da parcela, conforme as regras do grupo e da Porto. O frontend simula isso para ambas as opções.
    *   **Piso da Parcela**: A parcela pós-contemplação não pode ser menor que 50% da parcela integral (antes de qualquer redutor e sem TAA diluída). Se a redução calculada for maior, o prazo pode ser ajustado (na opção "Reduzir Parcela") ou a parcela fixada no piso (na opção "Reduzir Prazo").
    *   **Amortização do Lance (detalhada)**: O frontend também pode detalhar como um lance quita parcelas do final, possivelmente deixando uma pequena sobra que é diluída nas parcelas restantes, ajustando o valor final da parcela e o novo prazo.

3.  **Seu Comportamento**:
    *   Seja direto, informativo e profissional.
    *   Use a terminologia da Porto Seguro Consórcios.
    *   Se a pergunta for muito específica sobre um cálculo que o frontend faz (ex: "qual será minha parcela exata se eu der X de lance no grupo Y?"), direcione o usuário a usar as ferramentas de simulação do app.
    *   Para perguntas gerais sobre como funciona o consórcio, taxas, lances, etc., forneça explicações claras baseadas nos conceitos acima.
    *   NÃO invente informações ou valores. Se não souber, use a mensagem: "${CANNOT_ANSWER_MESSAGE}".
    *   Evite frases como "eu acho", "talvez". Seja assertivo com a informação que possui.

Seja conciso. NÃO se desculpe por não saber algo. Apenas afirme que não tem a informação.
O frontend lida com a apresentação de listas de grupos, seleção, e toda a matemática da simulação. Sua função é ser um assistente informativo para dúvidas gerais.
`;

export const CHAT_PROMPTS = {
  initialWelcome: "Olá! Sou seu Especialista Consórcio Porto. Como posso ajudar com seus planos?",
  initialChooseAction: "Escolha uma opção abaixo para simular ou me faça uma pergunta sobre consórcios Porto.",
  initialLoadingData: "Carregando dados dos grupos Porto...",
  initialErrorDataGeneric: "As simulações por lista/busca estão indisponíveis no momento. Você ainda pode fazer perguntas gerais ou tentar a 'Entrada Manual de Dados' para uma simulação.",
  initialErrorDataAlternative: "Não foi possível carregar os dados dos grupos Porto (origem externa). Verifique a conexão ou se o link da planilha está ativo. A simulação por lista/busca está indisponível. Tente a opção 'Informar Dados Manualmente' ou faça perguntas gerais.",
  
  chooseGroupSearchMethod: "Como deseja encontrar o grupo para sua simulação?",
  askCreditValueForFilter: "🔍 Qual o valor de crédito desejado para o filtro? (ex: 100mil, ou 80k-120k)",
  askDesiredNetCreditForEmbutidoSearch: "💸 Qual valor de crédito líquido você deseja receber após utilizar o lance embutido do grupo? (Ex: 100mil). Buscaremos grupos onde este valor é ~70-100% do crédito total.",
  
  askIfAddMoreFilters: "Deseja adicionar mais filtros (como prazo) antes de visualizarmos os grupos?",
  chooseAdditionalFilterType: "Qual outro filtro gostaria de adicionar?",
  askFilterInputPrazo: "Qual o prazo (em meses) desejado para o plano? (ex: 60, ou 50-70)",
  
  allFiltersApplied: "Ok! Mostrando grupos Porto com os filtros aplicados.",
  noAdditionalFilters: "Entendido! Mostrando grupos Porto com o filtro principal.",
  filterAddedAskForMore: "Filtro adicionado. Deseja adicionar mais algum?",
  netCreditEmbutidoFilterApplied: "Filtro de crédito líquido com embutido aplicado para R$ {DESIRED_NET_CREDIT}. Deseja adicionar outros filtros (prazo, etc.) ou ver os grupos?",

  showingDistinctGroupsPaginated: "Lista de grupos Porto encontrados (pág. {CURRENT_PAGE}/{TOTAL_PAGES}). Selecione um grupo para ver os valores de crédito disponíveis.",
  noDistinctGroupsFound: "Nenhum grupo Porto encontrado com esses filtros. Tente refinar sua busca ou usar menos filtros.",
  
  showingGroupCreditValuesPaginated: "Opções de crédito para o Grupo {GROUP_NAME} (pág. {CURRENT_PAGE}/{TOTAL_PAGES}). Escolha uma opção para iniciar a simulação.",
  noCreditValuesInSelectedGroup: "Nenhuma opção de crédito encontrada para o Grupo {GROUP_NAME} com os filtros atuais. Tente outro grupo ou ajuste os filtros.",

  askCreditValueForLeg: "{FLOW_CONTEXT}: Qual o valor de crédito (ex: 100mil) para esta cota/simulação?",
  
  askOverrideRedutor: "⚙️ O redutor de parcela atual deste grupo é {REDUTOR_DO_GRUPO}. Deseja manter ou alterar?",
  askToAddRedutor: "⚙️ Este grupo não possui redutor de parcela padrão. Deseja adicionar um para esta simulação?",
  askNewRedutorPercent: "📝 Qual o novo percentual de redutor (%)? (Ex: 25 para 25%, 0 para nenhum, ou 'CAMPANHA' para Campanha Parcela Original)",
  invalidRedutorInput: "Entrada inválida. Use um percentual (0-100) ou 'CAMPANHA'.",
  askDilutionPeriod: "🗓️ Por quantos meses iniciais deseja aplicar este redutor (diluição da Taxa de Adm. Antecipada nas parcelas)?",

  askLanceStrategy: "🎯 Escolha sua estratégia de lance para esta simulação:",
  
  askTipoContratacao: "Esta simulação é para Pessoa Física (PF) ou Jurídica (PJ)?",
  askFGTSValue: "💰 (Opcional) Pretende usar FGTS nesta simulação de imóvel (PF)? Se sim, qual valor? (ex: 15000. Se não, 0 ou Enter)",
  
  lanceSuggestion: "Grupo {GROUP_NAME} ({GROUP_BEM}): Este grupo possui Lance Embutido de {LANCE_EMBUTIDO_PERC} e Lance Fixo de {LANCE_FIXO_PERC}.\nVocê pode complementar com um Lance Livre.",
  askLanceLivrePercentInput: "🔶 Qual o valor (ex: R$10000, 10mil) OU percentual (ex: 20%) de Lance Livre (recurso próprio) você gostaria de ofertar?",
  askContemplationParcela: "🗓️ Em qual parcela você estima a contemplação? (Ex: 3 para 3ª parcela, máx {MAX_PRAZO}).",
    
  invalidInputNumber: "Valor numérico inválido (ex: 50000, 70mil). Por favor, use apenas números.",
  invalidInputNumberRange: "Faixa inválida (ex: 50mil-60mil, com min <= max). Use apenas números.",
  invalidLanceLivrePercent: "Entrada para Lance Livre inválida. Use um valor (ex: R$5000, 5mil) OU um percentual (ex: 20% ou 20). Percentuais devem ser entre 0-100%.",
  invalidPrazoInput: "Prazo inválido. Informe um número de meses (ex: 60, ou uma faixa como 50-70).",
  invalidContemplationParcela: "Parcela de contemplação inválida. Deve ser um número entre 1 e o prazo do plano ({MAX_PRAZO}).",
  
  errorGeneratingPdf: "Erro ao gerar o PDF. Verifique os dados da simulação/detalhamento.",
  pdfSuccess: "PDF da simulação Porto gerado com sucesso!",
  amortizationPdfSuccess: "PDF do detalhamento de amortização gerado com sucesso!",
  askWhatsAppShareType: "Como deseja enviar a simulação por WhatsApp?",
  askWhatsAppNumber: "Qual o número do WhatsApp para envio? (DDD+número, ex: 11987654321)",
  invalidWhatsAppNumber: "Número de WhatsApp inválido. Use o formato DDD+número (ex: 11987654321)." ,
  whatsAppShareSuccess: "Link para WhatsApp com a simulação Porto foi gerado para {WHATSAPP_NUMBER}. Por favor, verifique em uma nova aba/janela.",
  whatsAppAmortizationShareSuccess: "Link para WhatsApp com o detalhamento da amortização foi gerado para {WHATSAPP_NUMBER}. Verifique.",
  askEmailAddress: "Qual o seu endereço de e-mail para envio?",
  invalidEmailAddress: "Endereço de e-mail inválido.",
  emailShareSuccess: "Link de E-mail com a simulação Porto foi gerado para {EMAIL_ADDRESS}. Verifique seu cliente de e-mail.",
  emailAmortizationShareSuccess: "Link de E-mail com o detalhamento da amortização ({STRATEGY_NAME}) foi gerado para {EMAIL_ADDRESS}. Verifique.",
  comparisonPdfSuccess: "PDF comparativo das simulações Porto gerado!",
  errorGeneratingComparisonPdf: "Erro ao gerar PDF comparativo. Verifique as simulações.",
  
  askNumberOfQuotasToMerge: "🔢 Quantas cotas Porto você gostaria de juntar? (Ex: 2, mínimo 2)",
  invalidNumberOfQuotas: "Número de cotas inválido. O mínimo para junção é 2.",
  askHowToFindGroupForLeg: "{FLOW_CONTEXT}: Como deseja encontrar o grupo para esta cota/simulação?",

  mergedSimulationReady: "✅ Simulação de junção de cotas Porto calculada! Veja os detalhes.",
  errorGeneratingMergedPdf: "Erro ao gerar PDF da junção de cotas. Verifique os dados.",
  mergedPdfSuccess: "PDF da junção de cotas Porto gerado!",
  whatsAppMergedShareSuccess: "Link para WhatsApp com a junção de cotas Porto foi gerado para {WHATSAPP_NUMBER}. Verifique.",
  emailMergedShareSuccess: "Link de E-mail com a junção de cotas Porto foi gerado para {EMAIL_ADDRESS}. Verifique.",
  errorSharingGeneric: "Erro ao tentar compartilhar. A simulação/detalhamento pode estar incompleta ou não foi encontrada.",
  askShareMethod: "Como deseja compartilhar esta simulação?",
  askShareMethodAmortization: "Como deseja compartilhar este detalhamento de amortização para {STRATEGY_NAME}?",
  askShareMethodMerged: "Como deseja compartilhar esta junção de cotas?",

  askManualGroupCredit: "📝 (Manual 1/9) Valor do Crédito? (ex: 100000)",
  askManualGroupPrazo: "📝 (Manual 2/9) Prazo em meses? (ex: 180)",
  askManualGroupTaxaAdmTotal: "📝 (Manual 3/9) Taxa de Adm. Total %? (ex: 17)",
  askManualGroupTaxaAdmAntecipada: "📝 (Manual 4/9) Taxa de Adm. Antecipada %? (ex: 1)",
  askManualGroupFundoReserva: "📝 (Manual 5/9) Fundo de Reserva %? (ex: 2)",
  
  simulationResultActions: "Simulação calculada! O que gostaria de fazer a seguir?",
  showingAmortizationDetails: "Mostrando detalhes do cálculo de amortização para a opção: {STRATEGY_NAME}.",
  invalidManualInput: "Entrada inválida. Por favor, verifique o valor e tente novamente.",
  askManualGroupLanceEmbutido: "📝 (Manual 6/9) Lance Embutido %? (ex: 25 ou 0 se não houver)",
  askManualGroupLanceFixo: "📝 (Manual 7/9) Lance Fixo %? (ex: 15. Opcional, 0 ou Enter se não)",
  askManualGroupRedutor: "📝 (Manual 8/9) Redutor % ou 'CAMPANHA'? (ex: 50 ou CAMPANHA. Opcional, 0 ou Enter se não)",
  askManualGroupSeguro: "📝 (Manual 9/9) Seguro de Vida (% da apólice)? (ex: 0.031. Opcional, para PF, 0 ou Enter se não)",
  manualGroupDataReceived: "✅ Dados manuais do grupo recebidos! Vamos configurar o restante da simulação.",
};
