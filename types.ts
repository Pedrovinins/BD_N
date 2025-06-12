
export interface PortoBaseGroupData {
  NomeGrupo: string;
  TaxaAdministracaoTotal: number;
  TaxaAdministracaoAntecipada: number;
  FundoDeReserva: number;
  LanceEmbutidoPercent: number;
  LanceFixoPercent?: number;
  Redutor: number | "CAMPANHA PARCELA ORIGINAL"; 
  PrazoOriginalMeses: number;
  SeguroVidaApolicePercent?: number; 

  ParcelaOriginalReais?: number;
  TipoBem?: string; 
  MesesRestantes?: number;
  LanceMinimo?: string; 
  LanceMaximo?: string;
  MediaLance6M?: string;
  LancesContempladosUltimoMes?: string;
  VagasDisponiveis?: string; 
}

export interface PortoCreditValueData {
  NomeGrupo: string; 
  Bem: string; 
  ValorDoCredito: number; 
}

export interface PortoGroupData extends PortoBaseGroupData, Omit<PortoCreditValueData, 'NomeGrupo'> {
  id: string; 
}

export interface DistinctPortoGroupInfo {
  nomeGrupo: string; 
  
  valorCreditoMin?: number;
  valorCreditoMax?: number;
  parcelaReaisMin?: number;
  parcelaReaisMax?: number;

  produtoRepresentativo?: string;        
  tipoBemRepresentativo?: string;        
  prazoOriginalMeses?: number;           
  mesesRestantesRepresentativo?: number; 
  taxaAdmTotal?: number;                 
  taxaAdmAntecipadaRepresentativa?: number; 
  fundoReserva?: number;                 
  seguroRepresentativo?: number;         
  redutorParcelaRepresentativo?: string | number; 
  lanceEmbutido?: number;                
  lanceFixoRepresentativo?: number;      
  lanceMinimoRepresentativo?: string;    
  lanceMaximoRepresentativo?: string;    
  mediaLance6MRepresentativo?: string;   
  lancesContempladosUltimoMesRepresentativo?: string; 
  vagasDisponiveisRepresentativa?: string; 
}


export interface InteractionMessage {
  id: number;
  text: string;
  type: 'user' | 'bot' | 'error';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export enum AppStep {
  INITIAL,
  CHOOSE_GROUP_SEARCH_METHOD,
  
  ASK_CREDIT_VALUE_FOR_FILTER, 
  ASK_DESIRED_NET_CREDIT_FOR_EMBUTIDO_SEARCH, 

  ASK_IF_ADD_MORE_FILTERS,
  CHOOSE_ADDITIONAL_FILTER_TYPE,
  
  ASK_FILTER_INPUT_PRAZO,
  
  VIEW_DISTINCT_GROUPS_FOR_SELECTION,
  VIEW_GROUP_CREDIT_VALUES,

  ASK_OVERRIDE_REDUTOR,
  ASK_NEW_REDUTOR_PERCENT,
  ASK_DILUTION_PERIOD,

  ASK_LANCE_STRATEGY, 

  ASK_TIPO_CONTRATACAO, 
  ASK_FGTS_VALUE, 

  ASK_LANCE_LIVRE_PERCENT, 
  ASK_CONTEMPLATION_PARCELA,
  SHOW_SIMULATION_RESULT,
  SHOW_AMORTIZATION_CALCULATION_DETAILS, 
  
  ASK_SHARE_METHOD,
  ASK_WHATSAPP_SHARE_TYPE, 
  ASK_WHATSAPP_NUMBER, 
  ASK_EMAIL_ADDRESS, 
  
  SHOW_COMPARISON_VIEW,
  
  ASK_NUMBER_OF_QUOTAS_TO_MERGE, 
  SHOW_MERGED_SIMULATION_RESULT,
  
  ASK_MANUAL_GROUP_CREDIT,
  ASK_MANUAL_GROUP_PRAZO,
  ASK_MANUAL_GROUP_TAXA_ADM_TOTAL,
  ASK_MANUAL_GROUP_TAXA_ADM_ANTECIPADA,
  ASK_MANUAL_GROUP_FUNDO_RESERVA,
  ASK_MANUAL_GROUP_LANCE_EMBUTIDO,
  ASK_MANUAL_GROUP_LANCE_FIXO, 
  ASK_MANUAL_GROUP_REDUTOR, 
  ASK_MANUAL_GROUP_SEGURO, 
}

export type TipoContratacao = 'fisica' | 'juridica';
export type AmortizacaoPreferida = 'reduzir_parcela' | 'reduzir_prazo';

/**
 * Defines how the user wants to override the group's default 'Redutor'.
 * - `number`: A specific percentage for the redutor (e.g., 25 for 25%).
 * - `"CAMPANHA PARCELA ORIGINAL"`: A special type of redutor provided by the group.
 * - `null`: User explicitly chose no redutor or to remove an existing one (effectively 0%).
 * - `undefined` (when used in params): Indicates that the group's default redutor should be used.
 */
export type UserRedutorOverride = number | "CAMPANHA PARCELA ORIGINAL" | null | undefined; 


/**
 * Parameters required to perform a Porto Seguro consortium simulation.
 * @property {PortoGroupData} selectedGroupData - The detailed data of the selected consortium group.
 * @property {TipoContratacao} tipoContratacao - The type of contract ('fisica' for individual, 'juridica' for business).
 * @property {number} valorFGTS - The amount of FGTS to be used in the bid (applicable for 'fisica' type).
 * @property {number} [lanceLivrePercentual] - The percentage of 'categoria' for a free bid. Used if `lanceLivreReais` is not provided.
 * @property {number} [lanceLivreReais] - The cash amount for a free bid. Takes precedence over `lanceLivrePercentual` if provided.
 * @property {number} parcelaContemplacao - The installment number at which contemplation is estimated.
 * @property {'fixo' | 'livre'} [chosenLanceStrategy] - The chosen bid strategy.
 * @property {boolean} [useGroupLanceEmbutidoForLivre] - Whether to use the group's built-in bid as part of a free bid.
 * @property {UserRedutorOverride} [userRedutorOverride] - How the user wants to override the group's default redutor. See {@link UserRedutorOverride}.
 * @property {number | null} [initialChosenDilutionPeriodInMonths] - The user-selected period (in months) for diluting the adhesion fee. `null` means no dilution.
 */
export interface PortoSimulationParams {
  selectedGroupData: PortoGroupData;
  tipoContratacao: TipoContratacao;
  valorFGTS: number; 
  lanceLivrePercentual?: number; 
  lanceLivreReais?: number;      
  parcelaContemplacao: number; 
  chosenLanceStrategy?: 'fixo' | 'livre'; 
  useGroupLanceEmbutidoForLivre?: boolean; 
  userRedutorOverride?: UserRedutorOverride; 
  initialChosenDilutionPeriodInMonths?: number | null; 
}

/**
 * Represents the outcome of post-contemplation calculations for a single amortization strategy.
 * @property {number} parcelaPosContemplacaoSemSeguro - The calculated installment value after contemplation, without insurance. This value already reflects any adhesion fee dilution for the initial period and floor adjustments.
 * @property {number} [parcelaPosContemplacaoComSeguro] - The calculated installment value after contemplation, including insurance (if applicable for PF). Also reflects adhesion dilution and floor.
 * @property {number} prazoRestantePosContemplacao - The remaining term in months after contemplation, potentially adjusted by the floor rule.
 * @property {number} [novoValorSeguroAposContemplacao] - The new insurance value per installment after contemplation (if applicable for PF), calculated on the new saldo devedor.
 * @property {number} [adesaoPorParcelaDiluidaPosContemplacao] - The portion of the adhesion fee (Tx.Adm.Antec.) diluted into each post-contemplation installment, if applicable and if this period extends post-contemplation.
 * @property {number} [numParcelasComAdesaoPosContemplacao] - The number of post-contemplation installments that include the diluted adhesion fee.
 * @property {boolean} [wasParcelPostContemplationAdjustedByFloor] - Flag indicating if the post-contemplation installment was adjusted due to the 50% floor rule.
 * @property {number} [parcelPostContemplacaoSemSeguroBeforeFloor] - The post-contemplation installment value (without insurance, but *with* adhesion dilution if applicable) *before* any floor adjustment was applied.
 * @property {number} [prazoRestanteOriginalAnteParcelFloorAdjustment] - The original remaining term *before* any adjustment due to the installment floor rule (but after the primary amortization strategy was applied).
 * @property {number} [pisoParcelaReferenciaSemSeguro] - The reference installment value (typically 50% of the full, non-reduced, pre-contemplation parcel without insurance) used as the floor.
 */
export interface PostContemplationOutcome {
  parcelaPosContemplacaoSemSeguro: number;
  parcelaPosContemplacaoComSeguro?: number;
  prazoRestantePosContemplacao: number;
  novoValorSeguroAposContemplacao?: number;
  adesaoPorParcelaDiluidaPosContemplacao?: number;
  numParcelasComAdesaoPosContemplacao?: number;
  wasParcelPostContemplationAdjustedByFloor?: boolean;
  parcelPostContemplacaoSemSeguroBeforeFloor?: number; 
  prazoRestanteOriginalAnteParcelFloorAdjustment?: number;
  pisoParcelaReferenciaSemSeguro?: number;
}


export interface PortoSimulationResult {
  nomeGrupo: string;
  bem: string;
  valorCreditoOriginal: number;
  prazoOriginalGrupoMeses: number; 
  effectivePrazoSimulacao: number; 
  tipoContratacao: TipoContratacao;
  lanceLivrePercentualInput: number; 
  parcelaContemplacaoInput: number;
  valorFGTSInput: number;
  chosenLanceStrategy?: 'fixo' | 'livre';
  useGroupLanceEmbutidoForLivre?: boolean;
  selectedGroupData: PortoGroupData; 
  userRedutorOverride?: UserRedutorOverride;
  
  initialChosenDilutionPeriodInMonths?: number | null; 
  effectiveChosenDilutionPeriodInMonths?: number | null; 
  isDilutionEffectivelyActive: boolean; 
  totalDilutableAdhesionValue: number; 
  adhesionInstallmentValueDuringDilution: number; 
  parcelValueDuringDilutionSemSeguro?: number; 
  parcelValueDuringDilutionComSeguro?: number; 
  pisoParcelaReferenciaSemSeguro?: number; 
  parcelaBaseOriginalParaDiluicaoSemSeguro?: number; 
  
  categoria: number; 
  valorCreditoComRedutorAplicado?: number; 
  
  parcelaOriginalReduzidaSemSeguro?: number; 
  parcelaOriginalNormalSemSeguro: number; 
  
  valorSeguroInicial?: number; 
  parcelaOriginalReduzidaComSeguro?: number; 
  parcelaOriginalNormalComSeguro?: number; 

  representatividadeLanceEmbutido: number; 
  valorTotalLanceFixo?: number; 
  
  valorLanceLivreCalculado: number; 
  recursoProprioNecessario: number; 
  
  creditoLiquidoFinal: number; 
  
  reduzirParcelaOutcome: PostContemplationOutcome;
  reduzirPrazoOutcome: PostContemplationOutcome;
  
  taxaAdmTotalDisplay: string;
  taxaAdmAntecDisplay: string; 
  taxaAdmDiluidaDisplay: string; 
  fundoReservaDisplay: string;
  lanceEmbutidoDisplay: string; 
  lanceFixoDisplay?: string; 
  redutorDisplay: string; 
  seguroVidaDisplay?: string;
  effectiveRedutorDisplay: string; 
  dilutionPeriodDisplay?: string; 
}


export interface MergedPortoSimulationResult {
  totalCreditoOriginal: number;
  totalDilutableAdhesionValueSum: number; 
  totalRecursoProprioNecessario: number;
  numberOfQuotas: number;
  individualSimulations: PortoSimulationResult[]; 

  totalParcelaOriginalConsolidadaSemSeguro: number; 
  totalParcelaOriginalConsolidadaComSeguro?: number; 
  mediaPrazoRestantePosContemplacaoReduzirParcela: number; 
  totalParcelaPosContemplacaoConsolidadaSemSeguroReduzirParcela: number; 
  totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela?: number; 
}


export type CreditFilterValue = number | { min: number; max: number };
export type PrazoFilterValue = number | { min: number; max: number };

export interface FilterCriteria {
  credit?: CreditFilterValue;
  prazo?: PrazoFilterValue;
  textSearch?: string;
  desiredNetCreditEmbutido?: number; 
}

export interface AmortizationStepDetail {
  stepNumber: number; 
  title: string;
  formula: string;
  calculation: string;
  result: string;
  explanation: string;
}

export interface AmortizationCalculationData {
    creditoContratado: number;
    taxaAdmTotalPercent: number;
    creditoMaisTaxasOriginal: number; 
    prazoInicial: number; 
    parcelaIntegralCalculo: number; 
    parcelasPagasContemplacao: number;
    lanceOfertadoTotalOriginal: number; 
    recursosDoClienteParaLanceBruto: number; 
    valorDeixadoDeSerPagoCalculado?: number; 
    lanceLiquidoUsadoParaAmortizacao: number; 
}

export interface AmortizationCalculationResult {
  dadosBase: AmortizationCalculationData;
  steps: AmortizationStepDetail[];
  conferencia: {
    valorCalculadoFinal: number;
    diferenca: number;
    matches: boolean;
    comment: string;
  };
  amortizacaoPreferidaConsiderada: AmortizacaoPreferida; 
}


export const formatCurrency = (value: number | undefined | null, includeSymbol: boolean = true): string => {
  if (value === undefined || value === null || isNaN(value)) return includeSymbol ? 'R$ N/A' : 'N/A';
  const formatted = value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return includeSymbol ? `R$ ${formatted}` : formatted;
};

export const formatPercentage = (value: number | undefined | null, decimals: number = 2): string => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  if (typeof value === 'string') return value; 
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
};

export const formatDecimalAsPercentage = (value?: number): string => {
    if (value === undefined || isNaN(value)) return '0,00%';
    return `${(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

export const parsePercentageString = (percStr: string | number | undefined | null): number | null => {
    if (percStr === undefined || percStr === null) return null;
    let numStr = String(percStr).replace('%', '').replace(',', '.').trim();
    const val = parseFloat(numStr);
    return isNaN(val) ? null : val;
};

export const parseCurrencyString = (currStr: string | undefined | null): number | null => {
    if (!currStr || typeof currStr !== 'string') return null;
    let numStr = String(currStr).replace(/R\$\s*/g, "").trim(); 
    
    if (!isNaN(parseFloat(numStr)) && numStr.includes('.') && !numStr.includes(',')) {
        const val = parseFloat(numStr);
        return isNaN(val) ? null : val;
    }

    numStr = numStr.replace(/\.(?=\d{3}(?:,\d{2})?$)/g, "").replace(",", "."); 
    const val = parseFloat(numStr);
    return isNaN(val) ? null : val;
};
