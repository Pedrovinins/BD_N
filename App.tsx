
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    InteractionMessage, AppStep, PortoGroupData, PortoSimulationParams, PortoSimulationResult,
    FilterCriteria, DistinctPortoGroupInfo, CreditFilterValue, PrazoFilterValue, TipoContratacao, MergedPortoSimulationResult,
    formatCurrency, formatPercentage, formatDecimalAsPercentage, parsePercentageString, PortoBaseGroupData, parseCurrencyString,
    AmortizacaoPreferida, UserRedutorOverride, AmortizationCalculationResult, AmortizationStepDetail, PostContemplationOutcome
} from './types';
import * as PortoConsortiumLogic from './services/portoConsortiumLogic';
import { 
    MagnifyingGlassIcon, CheckCircleIcon, ShareIcon, EnvelopeIcon, ArrowPathIcon, 
    ArrowUturnLeftIcon, UserCircleIcon, CpuChipIcon, CalculatorIcon, 
    QuestionMarkCircleIcon, LightBulbIcon, PlusCircleIcon, PencilSquareIcon, ListBulletIcon, 
    BuildingLibraryIcon, TagIcon, ArrowLeftCircleIcon, AdjustmentsHorizontalIcon, ArrowsRightLeftIcon, 
    BanknotesIcon, CalendarDaysIcon, UserGroupIcon, ScaleIcon, PuzzlePieceIcon, ArrowTrendingDownIcon, 
    ClockIcon, PhoneIcon, CogIcon, InformationCircleIcon, DocumentChartBarIcon, 
    ChatBubbleBottomCenterTextIcon, Bars3BottomLeftIcon, CurrencyDollarIcon, ChevronLeftIcon, ChevronRightIcon, PrinterIcon, PaperAirplaneIcon, EyeIcon
} from '@heroicons/react/24/outline';
import {
  SYSTEM_INSTRUCTION_TEMPLATE, 
  CHAT_PROMPTS,
  ERROR_FALLBACK_MESSAGE, 
  SIMULATION_OBSERVATIONS, 
  SIMULATION_TITLE_PREFIX, 
  MERGED_SIMULATION_DISCLAIMER, 
  INITIAL_BOT_MESSAGE, 
  PORTO_UNIFIED_CSV_URL,  
  CSV_COLUMN_NAMES_UNIFIED 
} from './constants';
import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";

declare global {
  interface Window {
    jspdf: any;
    GoogleGenAI: typeof GoogleGenAI;
  }
}

interface ExclamationCircleIconProps extends React.SVGProps<SVGSVGElement> {}

const ExclamationCircleIcon: React.FC<ExclamationCircleIconProps> = ({ className, ...rest }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "h-6 w-6"} {...rest}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const ITEMS_PER_PAGE = 3; 

const parseCsvText = (csvText: string): string[][] => {
    const normalizedCsvText = csvText.replace(/\r\n?/g, '\n').trim();
    if (!normalizedCsvText) return [];
    const lines = normalizedCsvText.split('\n');
    const result: string[][] = [];

    for (const line of lines) {
        const row: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
                    currentCell += '"';
                    i++; 
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(currentCell.trim());
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        row.push(currentCell.trim()); 
        result.push(row);
    }
    return result;
};

const getColumnIndex = (headers: string[], targetHeader: string): number => {
    if (!targetHeader) return -1; 
    const normalizedTarget = targetHeader.toLowerCase().replace(/\s+/g, '');
    const index = headers.findIndex(h => h.toLowerCase().replace(/\s+/g, '').includes(normalizedTarget));
    if (index === -1) console.warn(`Column for "${targetHeader}" not found. Headers: ${headers.join(', ')}`);
    return index;
};

const parsePortoData = (
    csvRows: string[][] 
): PortoGroupData[] => {
    if (csvRows.length < 2) return []; 

    const header = csvRows[0];
    console.log("CSV Header used for parsing:", header.join('|')); 

    const idxNomeGrupo = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.NomeGrupo);
    const idxBem = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.Bem);
    const idxValorCredito = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.ValorCredito);
    const idxTaxaAdmTotal = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.TaxaAdmTotal);
    const idxTaxaAdmAntec = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.TaxaAdmAntecipada);
    const idxFundoReserva = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.FundoReserva);
    const idxLanceEmbutido = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.LanceEmbutido);
    const idxLanceFixo = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.LanceFixo);
    const idxRedutor = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.Redutor);
    const idxPrazoOriginal = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.PrazoOriginal);
    const idxSeguroVida = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.SeguroVida);
    
    const idxParcelaReais = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.ParcelaReais);
    const idxTipo = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.Tipo);
    const idxMesesRestantes = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.MesesRestantes);
    const idxLanceMinimo = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.LanceMinimo);
    const idxLanceMaximo = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.LanceMaximo);
    const idxMediaLance6M = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.MediaLance6M);
    const idxLancesContempladosUltimoMes = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.LancesContempladosUltimoMes);
    const idxVagasDisponiveis = getColumnIndex(header, CSV_COLUMN_NAMES_UNIFIED.VagasDisponiveis);

    const essentialColumnsMissing = [];
    if (idxNomeGrupo === -1) essentialColumnsMissing.push(CSV_COLUMN_NAMES_UNIFIED.NomeGrupo);
    if (idxValorCredito === -1) essentialColumnsMissing.push(CSV_COLUMN_NAMES_UNIFIED.ValorCredito);
    if (idxPrazoOriginal === -1) essentialColumnsMissing.push(CSV_COLUMN_NAMES_UNIFIED.PrazoOriginal);
    if (idxBem === -1) essentialColumnsMissing.push(CSV_COLUMN_NAMES_UNIFIED.Bem);

    if (essentialColumnsMissing.length > 0) {
        const errorMsg = `Colunas essenciais do CSV (${essentialColumnsMissing.join(', ')}) não encontradas no cabeçalho. Verifique o arquivo CSV e as definições de coluna no código. Cabeçalho recebido: [${header.join(', ')}]`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    const finalPortoGroups: PortoGroupData[] = [];
    for (let i = 1; i < csvRows.length; i++) {
        const row = csvRows[i];
        const requiredCellCount = Math.max(
            idxNomeGrupo, idxBem, idxValorCredito, idxTaxaAdmTotal, idxTaxaAdmAntec, 
            idxFundoReserva, idxLanceEmbutido, idxLanceFixo, idxRedutor, 
            idxPrazoOriginal, idxSeguroVida, idxParcelaReais, idxTipo, idxMesesRestantes,
            idxLanceMinimo, idxLanceMaximo, idxMediaLance6M, idxLancesContempladosUltimoMes, idxVagasDisponiveis
        ) + 1;

        if (row.length < requiredCellCount) {
           console.warn(`Row ${i+1} (length ${row.length}) has fewer cells than expected (min ${requiredCellCount}), skipping:`, row.join('|'));
           continue; 
        }
        
        const nomeGrupo = row[idxNomeGrupo]; 
        const valorCreditoStr = row[idxValorCredito];
        const prazoOriginalStr = row[idxPrazoOriginal];

        const valorCredito = parseCurrencyString(valorCreditoStr) ?? 0;
        const prazoOriginalMeses = parseInt(prazoOriginalStr, 10) || 0;
        
        if (!nomeGrupo || nomeGrupo.trim() === "" || valorCredito <= 0 || prazoOriginalMeses <= 0) {
            continue;
        }
        const bem = row[idxBem] || 'N/A'; 

        const redutorRaw = row[idxRedutor];
        let redutorValue: number | "CAMPANHA PARCELA ORIGINAL";
        if (typeof redutorRaw === 'string' && (redutorRaw.toLowerCase().trim() === "campanha parcela original" || redutorRaw.toLowerCase().trim() === "campanha")) {
            redutorValue = "CAMPANHA PARCELA ORIGINAL";
        } else {
            redutorValue = parsePercentageString(redutorRaw) ?? 0; 
        }

        const groupDataItem: PortoGroupData = {
            NomeGrupo: nomeGrupo,
            Bem: bem,
            ValorDoCredito: valorCredito,
            TaxaAdministracaoTotal: parsePercentageString(row[idxTaxaAdmTotal]) ?? 0,
            TaxaAdministracaoAntecipada: parsePercentageString(row[idxTaxaAdmAntec]) ?? 0,
            FundoDeReserva: parsePercentageString(row[idxFundoReserva]) ?? 0,
            LanceEmbutidoPercent: parsePercentageString(row[idxLanceEmbutido]) ?? 0,
            LanceFixoPercent: parsePercentageString(row[idxLanceFixo]) ?? undefined,
            Redutor: redutorValue,
            PrazoOriginalMeses: prazoOriginalMeses,
            SeguroVidaApolicePercent: parsePercentageString(row[idxSeguroVida]) ?? undefined,
            id: `${nomeGrupo}-${valorCredito}-${bem.replace(/\s/g, '_')}-${i}`,
            ParcelaOriginalReais: parseCurrencyString(row[idxParcelaReais]) ?? undefined,
            TipoBem: row[idxTipo] || undefined,
            MesesRestantes: row[idxMesesRestantes] ? parseInt(row[idxMesesRestantes], 10) : undefined,
            LanceMinimo: row[idxLanceMinimo] || undefined,
            LanceMaximo: row[idxLanceMaximo] || undefined,
            MediaLance6M: row[idxMediaLance6M] || undefined,
            LancesContempladosUltimoMes: row[idxLancesContempladosUltimoMes] || undefined,
            VagasDisponiveis: row[idxVagasDisponiveis] || undefined,
        };
        finalPortoGroups.push(groupDataItem);
    }

    const filteredGroups = finalPortoGroups.filter(g => g.NomeGrupo && g.NomeGrupo.trim() !== "" && g.ValorDoCredito > 0 && g.PrazoOriginalMeses > 0);
    return filteredGroups;
};


const generatePostContemplationSummaryText = (outcome: PostContemplationOutcome, tipoContratacao: TipoContratacao, strategyName: string): string => {
  let summary = `\nOPÇÃO: ${strategyName.toUpperCase()}`;
  summary += `\n- Prazo Restante: ${outcome.prazoRestantePosContemplacao} parcelas`;
  if (outcome.wasParcelPostContemplationAdjustedByFloor && outcome.prazoRestanteOriginalAnteParcelFloorAdjustment && outcome.prazoRestanteOriginalAnteParcelFloorAdjustment !== outcome.prazoRestantePosContemplacao) {
      summary += ` (originalmente ${outcome.prazoRestanteOriginalAnteParcelFloorAdjustment}m, ajustado pelo piso da parcela)`;
  }
  
  if (outcome.numParcelasComAdesaoPosContemplacao && outcome.numParcelasComAdesaoPosContemplacao > 0 && outcome.adesaoPorParcelaDiluidaPosContemplacao && outcome.adesaoPorParcelaDiluidaPosContemplacao > 0) {
    let infoAdhesion = `(inclui ${formatCurrency(outcome.adesaoPorParcelaDiluidaPosContemplacao)} de Tx.Adm.Antec. diluída)`;
    if (outcome.wasParcelPostContemplationAdjustedByFloor) infoAdhesion += " e ajustada pelo piso";
    
    summary += `\n- Nova Parcela (s/seg, primeiras ${outcome.numParcelasComAdesaoPosContemplacao}x): ${formatCurrency(outcome.parcelaPosContemplacaoSemSeguro)} ${infoAdhesion}`;
    
    if (tipoContratacao === 'fisica' && outcome.parcelaPosContemplacaoComSeguro !== undefined) {
        summary += ` | Nova Parcela (c/seg PF, primeiras ${outcome.numParcelasComAdesaoPosContemplacao}x): ${formatCurrency(outcome.parcelaPosContemplacaoComSeguro)}`;
    }

    if (outcome.prazoRestantePosContemplacao > outcome.numParcelasComAdesaoPosContemplacao) {
        let parcelaSubsequenteSemSeguro = outcome.parcelaPosContemplacaoSemSeguro;
        if(outcome.adesaoPorParcelaDiluidaPosContemplacao && outcome.parcelPostContemplacaoSemSeguroBeforeFloor !== undefined){ 
             parcelaSubsequenteSemSeguro = (outcome.parcelPostContemplacaoSemSeguroBeforeFloor || 0) - (outcome.adesaoPorParcelaDiluidaPosContemplacao || 0);
             if(outcome.pisoParcelaReferenciaSemSeguro && parcelaSubsequenteSemSeguro < outcome.pisoParcelaReferenciaSemSeguro) { 
                parcelaSubsequenteSemSeguro = outcome.pisoParcelaReferenciaSemSeguro; 
             }
        }

        summary += `\n- Nova Parcela (s/seg, subsequentes): ${formatCurrency(parcelaSubsequenteSemSeguro)}`;
        if (tipoContratacao === 'fisica' && outcome.novoValorSeguroAposContemplacao !== undefined) {
            let parcelaSubsequenteComSeguro = parcelaSubsequenteSemSeguro + (outcome.novoValorSeguroAposContemplacao || 0);
            summary += ` | Nova Parcela (c/seg PF, subsequentes): ${formatCurrency(parcelaSubsequenteComSeguro)}`;
        }
    }
  } else {
    summary += `\n- Nova Parcela (s/seg): ${formatCurrency(outcome.parcelaPosContemplacaoSemSeguro)}`;
    if(outcome.wasParcelPostContemplationAdjustedByFloor) summary += " (ajustada pelo piso)";
     if (tipoContratacao === 'fisica' && outcome.parcelaPosContemplacaoComSeguro !== undefined) {
        summary += ` | Nova Parcela (c/seg PF): ${formatCurrency(outcome.parcelaPosContemplacaoComSeguro)}`;
    }
  }
  if (tipoContratacao === 'fisica' && outcome.novoValorSeguroAposContemplacao && outcome.novoValorSeguroAposContemplacao > 0 && outcome.parcelaPosContemplacaoComSeguro !== undefined) {
    summary += ` (Novo Seguro: ${formatCurrency(outcome.novoValorSeguroAposContemplacao)})`;
  }
  return summary;
};


const generateSimulationSummaryTextInternal = (result: PortoSimulationResult, isResumo: boolean): string => {
  if (!result) return "Nenhuma simulação Porto disponível.";
  
  let summary = `${SIMULATION_TITLE_PREFIX}: ${result.bem.toUpperCase()} - ${result.nomeGrupo}
Crédito: ${formatCurrency(result.valorCreditoOriginal)} | Prazo (Grupo): ${result.prazoOriginalGrupoMeses}m (Simulado: ${result.effectivePrazoSimulacao}m) | Tipo: ${result.tipoContratacao === 'fisica' ? 'PF' : 'PJ'}`;

  if (!isResumo) {
    summary += `\nTx.Adm Total: ${result.taxaAdmTotalDisplay} | Tx.Adm Antec.: ${result.taxaAdmAntecDisplay}${result.isDilutionEffectivelyActive && result.effectiveChosenDilutionPeriodInMonths && result.effectiveChosenDilutionPeriodInMonths > 0 ? ` (${formatCurrency(result.totalDilutableAdhesionValue)} diluído em ${result.effectiveChosenDilutionPeriodInMonths}x de ${formatCurrency(result.adhesionInstallmentValueDuringDilution)})` : ''} | F.R: ${result.fundoReservaDisplay}`;
    summary += `\nRedutor Aplicado: ${result.effectiveRedutorDisplay || 'Nenhum'}`;
    if (result.valorCreditoComRedutorAplicado !== undefined && result.valorCreditoComRedutorAplicado !== result.valorCreditoOriginal) {
        summary += ` | Crédito c/ Redutor Aplicado: ${formatCurrency(result.valorCreditoComRedutorAplicado)}`;
    }
    summary += `\nLance Embutido Grupo: ${result.lanceEmbutidoDisplay}`;
    if(result.lanceFixoDisplay && result.lanceFixoDisplay !== "N/A") summary += ` | Lance Fixo Grupo: ${result.lanceFixoDisplay}`;
    if(result.seguroVidaDisplay && result.seguroVidaDisplay !== "N/A" && result.tipoContratacao === 'fisica') summary += ` | Seguro Vida (PF): ${result.seguroVidaDisplay}`;
  }
  
  summary += `\n\nPARCELAS INICIAIS ESTIMADAS (Antes da Contemplação na ${result.parcelaContemplacaoInput}ª parcela):`;

  if (result.isDilutionEffectivelyActive && result.effectiveChosenDilutionPeriodInMonths && result.effectiveChosenDilutionPeriodInMonths > 0 && result.parcelValueDuringDilutionSemSeguro !== undefined) {
      summary += `\n- Primeiras ${result.effectiveChosenDilutionPeriodInMonths} parcelas (${result.effectiveRedutorDisplay}, diluição da Tx.Adm.Antec.):`;
      summary += `\n  - Parcela (s/seg): ${formatCurrency(result.parcelValueDuringDilutionSemSeguro)}`;
      if (result.tipoContratacao === 'fisica' && result.parcelValueDuringDilutionComSeguro !== undefined) {
          summary += ` | Parcela (c/seg PF): ${formatCurrency(result.parcelValueDuringDilutionComSeguro)}`;
      }
      if (result.parcelaBaseOriginalParaDiluicaoSemSeguro !== undefined && result.adhesionInstallmentValueDuringDilution > 0 && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)')) {
        summary += `\n    (Base Reduzida s/ TAA diluída: ${formatCurrency(result.parcelaBaseOriginalParaDiluicaoSemSeguro)})`;
      }
      
      const contemplacaoConsiderada = result.parcelaContemplacaoInput; 
      if (result.effectiveChosenDilutionPeriodInMonths < contemplacaoConsiderada -1) {
           summary += `\n- Parcelas normais subsequentes (após diluição, antes da contemplação):`;
           if (result.parcelaOriginalReduzidaSemSeguro !== undefined && result.parcelaOriginalReduzidaSemSeguro !== result.parcelaOriginalNormalSemSeguro && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)') && result.effectiveRedutorDisplay !== "CAMPANHA PARCELA ORIGINAL") {
                summary += `\n  - Parcela Reduzida (s/seg): ${formatCurrency(result.parcelaOriginalReduzidaSemSeguro)}`;
                if (result.tipoContratacao === 'fisica' && result.parcelaOriginalReduzidaComSeguro !== undefined) {
                    summary += ` | Parcela Reduzida (c/seg PF): ${formatCurrency(result.parcelaOriginalReduzidaComSeguro)}`;
                }
           } else {
               summary += `\n  - Parcela Normal (s/seg): ${formatCurrency(result.parcelaOriginalNormalSemSeguro)}`;
               if (result.tipoContratacao === 'fisica' && result.parcelaOriginalNormalComSeguro !== undefined) {
                  summary += ` | Parcela Normal (c/seg PF): ${formatCurrency(result.parcelaOriginalNormalComSeguro)}`;
               }
           }
      }
  } else if (result.parcelaOriginalReduzidaSemSeguro !== undefined && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)') && result.effectiveRedutorDisplay !== "CAMPANHA PARCELA ORIGINAL" ) { 
    summary += `\n- Reduzida (s/seg): ${formatCurrency(result.parcelaOriginalReduzidaSemSeguro)}`;
    if (result.tipoContratacao === 'fisica' && result.parcelaOriginalReduzidaComSeguro !== undefined) {
        summary += ` | Reduzida (c/seg PF): ${formatCurrency(result.parcelaOriginalReduzidaComSeguro)}`;
    }
    summary += `\n- Normal/Integral (s/seg): ${formatCurrency(result.parcelaOriginalNormalSemSeguro)}`; 
     if (result.tipoContratacao === 'fisica' && result.parcelaOriginalNormalComSeguro !== undefined) {
        summary += ` | Normal/Integral (c/seg PF): ${formatCurrency(result.parcelaOriginalNormalComSeguro)}`;
    }
  } else { 
    summary += `\n- Normal/Integral (s/seg): ${formatCurrency(result.parcelaOriginalNormalSemSeguro)}`;
    if (result.tipoContratacao === 'fisica' && result.parcelaOriginalNormalComSeguro !== undefined) {
        summary += ` | Parcela Normal/Integral (c/seg PF): ${formatCurrency(result.parcelaOriginalNormalComSeguro)}`;
    }
  }
  
  summary += `\n\nLANCE OFERTADO (Contemplação na ${result.parcelaContemplacaoInput}ª parcela):`;
  if (result.chosenLanceStrategy === 'fixo' && result.valorTotalLanceFixo) {
    summary += `\n- Estratégia: Lance Fixo do Grupo (${formatPercentage(result.selectedGroupData?.LanceFixoPercent || 0)}) Valor: ${formatCurrency(result.valorTotalLanceFixo)}`;
  } else {
    summary += `\n- Estratégia: Lance Livre`;
    if (result.useGroupLanceEmbutidoForLivre && result.representatividadeLanceEmbutido > 0) {
       summary += ` (Utilizando Lance Embutido de ${formatPercentage(result.selectedGroupData?.LanceEmbutidoPercent || 0)}: ${formatCurrency(result.representatividadeLanceEmbutido)})`;
    }
    summary += `\n- Lance Livre (Oferta Total): ${formatPercentage(result.lanceLivrePercentualInput)} da Categoria (Valor: ${formatCurrency(result.valorLanceLivreCalculado)})`;
  }
  if (result.tipoContratacao === 'fisica' && result.chosenLanceStrategy !== 'fixo') { 
    summary += `\n- FGTS Utilizado: ${formatCurrency(result.valorFGTSInput)}`;
    summary += `\n- Recurso Próprio Total (Dinheiro): ${formatCurrency(result.recursoProprioNecessario)}`;
  } else if (result.chosenLanceStrategy !== 'fixo') {
    summary += `\n- Recurso Próprio Total (Dinheiro): ${formatCurrency(result.recursoProprioNecessario)}`;
  }


  let creditoLiquidoText = "Crédito Líquido Recebido";
  if (result.chosenLanceStrategy === 'fixo') {
      creditoLiquidoText = "Crédito Líquido Pós Lance Fixo";
  } else if (result.useGroupLanceEmbutidoForLivre && (result.selectedGroupData?.LanceEmbutidoPercent || 0) > 0) {
      creditoLiquidoText = "Crédito Líquido (após Embutido)";
  }
  summary += `\n${creditoLiquidoText}: ${formatCurrency(result.creditoLiquidoFinal)}`;

  summary += `\n\nPÓS-CONTEMPLAÇÃO (Estimativas):`;
  summary += generatePostContemplationSummaryText(result.reduzirParcelaOutcome, result.tipoContratacao, "Reduzir Parcela");
  summary += generatePostContemplationSummaryText(result.reduzirPrazoOutcome, result.tipoContratacao, "Reduzir Prazo");

  if (!isResumo) {
    summary += `\n\n${SIMULATION_OBSERVATIONS}`;
  }
  return summary;
};

const generateSimulationSummaryText = (result: PortoSimulationResult): string => {
    return generateSimulationSummaryTextInternal(result, false);
};

const generateSimulationSummaryTextResumo = (result: PortoSimulationResult): string => {
    return generateSimulationSummaryTextInternal(result, true);
};


const generateMergedSimulationSummaryText = (result: MergedPortoSimulationResult): string => {
    if (!result || result.individualSimulations.length === 0) return "Nenhuma simulação de junção Porto disponível.";
    let summary = `Junção de ${result.numberOfQuotas} Cotas Porto:
Crédito Total Original: ${formatCurrency(result.totalCreditoOriginal)}
Recurso Próprio Total (Lances Livres + FGTS se PF): ${formatCurrency(result.totalRecursoProprioNecessario)}
`;
    const minInitialParcelSemSeguro = result.individualSimulations.reduce((sum, s) => sum + (s.isDilutionEffectivelyActive && s.parcelValueDuringDilutionSemSeguro !== undefined ? s.parcelValueDuringDilutionSemSeguro : s.parcelaOriginalNormalSemSeguro), 0);
    const maxInitialParcelSemSeguro = result.individualSimulations.reduce((sum, s) => sum + s.parcelaOriginalNormalSemSeguro, 0);

    if (minInitialParcelSemSeguro !== maxInitialParcelSemSeguro) {
        summary += `Parcela Inicial Consolidada Estimada (s/seg): ${formatCurrency(minInitialParcelSemSeguro)} a ${formatCurrency(maxInitialParcelSemSeguro)} (varia conforme diluição)\n`;
    } else {
        summary += `Parcela Inicial Consolidada Estimada (s/seg): ${formatCurrency(minInitialParcelSemSeguro)}\n`;
    }
    
    let totalParcelaPosContemplacaoConsolidadaSemSeguroComAdesao = 0;
    let anyAdhesionCarryOver = false;
    result.individualSimulations.forEach(sim => {
        totalParcelaPosContemplacaoConsolidadaSemSeguroComAdesao += sim.reduzirParcelaOutcome.parcelaPosContemplacaoSemSeguro;
        if (sim.reduzirParcelaOutcome.numParcelasComAdesaoPosContemplacao && sim.reduzirParcelaOutcome.numParcelasComAdesaoPosContemplacao > 0 && sim.reduzirParcelaOutcome.adesaoPorParcelaDiluidaPosContemplacao) {
            anyAdhesionCarryOver = true;
        }
    });

    summary += `Parcela Pós-Contempl. Consolidada (s/seg, Opção Red. Parcela): ${formatCurrency(totalParcelaPosContemplacaoConsolidadaSemSeguroComAdesao)}${anyAdhesionCarryOver ? " (valor inicial, pode reduzir após Tx.Adm.Antec. diluída ou variar pelo piso)" : ""}\n`;
    summary += `Prazo Médio Restante (Opção Red. Parcela): ${result.mediaPrazoRestantePosContemplacaoReduzirParcela.toFixed(0)} parcelas
Total Tx.Adm.Antec. Diluível: ${formatCurrency(result.totalDilutableAdhesionValueSum)}
Detalhes Individuais:
`;
    result.individualSimulations.forEach((sim, index) => {
        summary += `Cota ${index + 1}: Gr.${sim.nomeGrupo.substring(0,10)}. Bem ${sim.bem.substring(0,15)}. Créd: ${formatCurrency(sim.valorCreditoOriginal)}. Rec.Próprio: ${formatCurrency(sim.recursoProprioNecessario + (sim.tipoContratacao === 'fisica' ? sim.valorFGTSInput : 0))}. Parc.Pós (s/seg, Red.Parc.): ${formatCurrency(sim.reduzirParcelaOutcome.parcelaPosContemplacaoSemSeguro)}\n`;
    });
    summary += `\n${MERGED_SIMULATION_DISCLAIMER}\n${SIMULATION_OBSERVATIONS}\n`;
    return summary;
};

const generateAmortizationDetailsText = (result: AmortizationCalculationResult | null): string => {
    if (!result) return "Nenhum detalhe de cálculo de amortização disponível.";
    let text = `Detalhes do Cálculo de Amortização do Lance (Opção: ${result.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'Reduzir Prazo' : 'Reduzir Parcela'}):\n\n`;
    text += "Dados Base Utilizados:\n";
    text += `- Crédito Contratado: ${formatCurrency(result.dadosBase.creditoContratado)}\n`;
    text += `- Taxa Adm. Total (Grupo): ${formatPercentage(result.dadosBase.taxaAdmTotalPercent)}\n`;
    text += `- Categoria Original do Plano (Referência): ${formatCurrency(result.dadosBase.creditoMaisTaxasOriginal)}\n`;
    text += `- Prazo Simulado (Efetivo): ${result.dadosBase.prazoInicial} meses\n`;
    text += `- Parcela Integral (s/seg, para cálculo de Q): ${formatCurrency(result.dadosBase.parcelaIntegralCalculo)}\n`;
    text += `- Nº Parcelas Pagas (até contemplação): ${result.dadosBase.parcelasPagasContemplacao}\n`;
    text += `- Valor Total do Lance Ofertado (da simulação): ${formatCurrency(result.dadosBase.lanceOfertadoTotalOriginal)}\n`;
    text += `- Recursos do Cliente (Rec. Próprio + FGTS, para informação): ${formatCurrency(result.dadosBase.recursosDoClienteParaLanceBruto)}\n`;

    if (result.dadosBase.valorDeixadoDeSerPagoCalculado && result.dadosBase.valorDeixadoDeSerPagoCalculado > 0) {
      text += `- Valor Descontado por Redutor do Grupo (VDSP): ${formatCurrency(result.dadosBase.valorDeixadoDeSerPagoCalculado)}\n`;
      text += `- Lance Líquido (Lance Total Ofertado da simulação menos VDSP, para amortizar parcelas futuras): ${formatCurrency(result.dadosBase.lanceLiquidoUsadoParaAmortizacao)}\n`;
    } else {
      text += `- Lance Líquido (Lance Total Ofertado da simulação, para amortizar parcelas futuras): ${formatCurrency(result.dadosBase.lanceLiquidoUsadoParaAmortizacao)}\n`;
    }
    text += `\n`;

    let stepCounter = 0;
    result.steps.forEach(step => {
        if (step.stepNumber === 0 || step.stepNumber === 0.1) { 
            text += `${step.title}\n`;
        } else {
            stepCounter++;
            text += `Passo ${stepCounter}: ${step.title}\n`;
        }
        text += `  Fórmula: ${step.formula}\n`;
        text += `  Cálculo: ${step.calculation}\n`;
        text += `  Resultado: ${step.result}\n`;
        if (step.explanation) text += `  Explicação: ${step.explanation}\n`;
        text += `\n`;
    });
    text += `Conferência Final:\n${result.conferencia.comment}\n`;
    return text;
};


const parseFlexibleNumericInput = (input: string): number | null => {
    if (!input || typeof input !== 'string') return null;
    let cleanedInput = input.toLowerCase().trim().replace(/\s*r\$\s*/g, '').replace(/\.(?=\d{3}(?:[,.]\d{1,2})?$)/g, '').replace(/,/g, '.');
    let multiplier = 1;
    if (cleanedInput.endsWith('mil')) { multiplier = 1000; cleanedInput = cleanedInput.replace(/\s*mil$/, ''); }
    else if (cleanedInput.endsWith('k')) { multiplier = 1000; cleanedInput = cleanedInput.replace(/\s*k$/, '');}
    const value = parseFloat(cleanedInput);
    return isNaN(value) ? null : value * multiplier;
};

const parseRangeInput = (input: string): { min: number; max: number } | number | null => {
    const parts = input.split('-').map(p => p.trim());
    if (parts.length === 2) {
        const min = parseFlexibleNumericInput(parts[0]);
        const max = parseFlexibleNumericInput(parts[1]);
        if (min !== null && max !== null && min >= 0 && max >= 0 && min <= max) { 
            return { min, max };
        }
        return null;
    }
    const singleValue = parseFlexibleNumericInput(input);
    if (singleValue !== null && singleValue >= 0) {
        return singleValue;
    }
    return null;
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md'; 
}

const ActionButton: React.FC<ActionButtonProps> = 
    ({ children, icon, className, variant = 'primary', size = 'md', ...props }) => {
    
    let baseStyle = "border font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center space-x-2 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed";
    
    baseStyle += size === 'sm' ? " px-2 py-1 text-xs" : " px-3 py-2 text-sm";

    if (variant === 'primary') {
        baseStyle += " text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 border-transparent";
    } else if (variant === 'secondary') {
        baseStyle += " text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500 border-blue-300";
    } else if (variant === 'danger') {
        baseStyle += " text-white bg-red-600 hover:bg-red-700 focus:ring-red-500 border-transparent";
    } else if (variant === 'success') {
        baseStyle += " text-white bg-green-500 hover:bg-green-600 focus:ring-green-500 border-transparent";
    }

    return (
      <button
        {...props}
        className={`${baseStyle} ${className || ''}`}
      >
        {icon}
        <span>{children}</span>
      </button>
    );
};

interface InfoItemProps {
  label: string;
  value?: string | number | null | undefined;
  className?: string;
  valueClassName?: string;
  children?: React.ReactNode;
  info?: string; 
}

const InfoItem: React.FC<InfoItemProps> = ({ label, value, className = "", valueClassName = "", children, info }) => {
  const isValueConsideredEmptyForHiding = value === undefined || value === null || value === "" || value === "N/A";

  if (isValueConsideredEmptyForHiding && !children && !info) {
    return null;
  }

  return (
    <div className={`py-1 sm:py-0.5 ${className}`}>
      <div>
        <span className="font-medium text-xs text-gray-500">{label}:</span>{' '}
        {children ? (
          children
        ) : (
          <span className={`text-xs text-gray-700 ${valueClassName}`}>
            {value === undefined || value === null ? 'N/A' : String(value)}
          </span>
        )}
      </div>
      {info && (
        <p className="text-xs text-gray-400 italic mt-0.5 ml-1">{info}</p>
      )}
    </div>
  );
};


const App: React.FC = () => {
  const [messages, setMessages] = useState<InteractionMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [appStep, setAppStepState] = useState<AppStep>(AppStep.INITIAL);
  const [previousAppStep, setPreviousAppStep] = useState<AppStep | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true); 
  const [allGroupsData, setAllGroupsData] = useState<PortoGroupData[]>([]); 
  const [currentSystemInstruction, setCurrentSystemInstruction] = useState<string>(
    SYSTEM_INSTRUCTION_TEMPLATE.replace('{PLACEHOLDER_FOR_GROUP_DATA}', '[]')
  );

  const [currentGroups, setCurrentGroups] = useState<PortoGroupData[]>([]); 
  const [distinctGroupsForDisplay, setDistinctGroupsForDisplay] = useState<DistinctPortoGroupInfo[]>([]); 
  const [selectedGroup, setSelectedGroup] = useState<PortoGroupData | null>(null); 
  const [selectedGroupNumberForDetailView, setSelectedGroupNumberForDetailView] = useState<string | null>(null); 

  const [simulationParams, setSimulationParams] = useState<Partial<PortoSimulationParams>>({}); 
  const [simulationResult, setSimulationResult] = useState<PortoSimulationResult | null>(null); 
  const [amortizationDetails, setAmortizationDetails] = useState<AmortizationCalculationResult | null>(null);
  const [amortizationStrategyForDetail, setAmortizationStrategyForDetail] = useState<AmortizacaoPreferida | null>(null);
  
  const [chosenLanceStrategy, setChosenLanceStrategy] = useState<'fixo' | 'livre' | null>(null);
  const [useEmbutidoForLivreBid, setUseEmbutidoForLivreBid] = useState<boolean | null>(null);

  const [userRedutorChoice, setUserRedutorChoice] = useState<'keep' | 'alter' | 'add' | 'no_add' | null>(null);
  const [customRedutorInput, setCustomRedutorInput] = useState<string>(''); 
  const [initialChosenDilutionPeriod, setInitialChosenDilutionPeriod] = useState<number | null>(null); 


  const [comparisonResults, setComparisonResults] = useState<PortoSimulationResult[]>([]);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [currentComparisonLeg, setCurrentComparisonLeg] = useState<number>(0);

  const [isMergingQuotas, setIsMergingQuotas] = useState<boolean>(false);
  const [numberOfQuotasToMerge, setNumberOfQuotasToMerge] = useState<number | null>(null);
  const [currentMergingQuotaIndex, setCurrentMergingQuotaIndex] = useState<number>(0);
  const [individualMergedSimulations, setIndividualMergedSimulations] = useState<PortoSimulationResult[]>([]);
  const [finalMergedResult, setFinalMergedResult] = useState<MergedPortoSimulationResult | null>(null); 
  
  const [sharingContext, setSharingContext] = useState<'single' | 'merged' | 'amortization' | null>(null);
  const [whatsAppShareType, setWhatsAppShareType] = useState<'completo' | 'resumo' | null>(null);
  const [manualGroupInput, setManualGroupInput] = useState<Partial<PortoGroupData & { BemManual?: string, ValorCreditoManual?: number }>>({});
  const [manualFieldValue, setManualFieldValue] = useState<string>(''); 
  
  const [currentPage, setCurrentPage] = useState<number>(1); 
  const [currentDistinctGroupsPage, setCurrentDistinctGroupsPage] = useState<number>(1); 
  const [activeFilterCriteria, setActiveFilterCriteria] = useState<FilterCriteria>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  const setAppStep = (newStep: AppStep) => {
    setPreviousAppStep(appStep); 
    setAppStepState(newStep);
  };

  useEffect(() => {
    if (process.env.API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.error("API_KEY is not defined.");
      addMessageToChat(ERROR_FALLBACK_MESSAGE, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
    }
  }, []);

  const generateDynamicSystemInstruction = (groups: PortoGroupData[]): string => {
    const sampleSize = 5; 
    const sampleGroups = groups.length > sampleSize 
        ? groups.slice(0, sampleSize).map(g => ({
            NomeGrupo: g.NomeGrupo, Bem: g.Bem, ValorDoCredito: g.ValorDoCredito, PrazoOriginalMeses: g.PrazoOriginalMeses, 
            TaxaAdmTotal: g.TaxaAdministracaoTotal, Redutor: g.Redutor, LanceEmbutido: g.LanceEmbutidoPercent
          }))
        : groups.map(g => ({
            NomeGrupo: g.NomeGrupo, Bem: g.Bem, ValorDoCredito: g.ValorDoCredito, PrazoOriginalMeses: g.PrazoOriginalMeses, 
            TaxaAdmTotal: g.TaxaAdministracaoTotal, Redutor: g.Redutor, LanceEmbutido: g.LanceEmbutidoPercent
          }));

    const planilhaGruposStringParaIA = JSON.stringify(sampleGroups, null, 2);
    let finalInstruction = SYSTEM_INSTRUCTION_TEMPLATE.replace('{PLACEHOLDER_FOR_GROUP_DATA}', planilhaGruposStringParaIA);
    if (groups.length > sampleSize) {
        finalInstruction += `\n(Representação parcial de ${groups.length} grupos totais disponíveis no sistema.)`;
    }
    return finalInstruction;
  };
  
  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      addMessageToChat(CHAT_PROMPTS.initialLoadingData, 'bot', <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />, true);
      
      let unifiedCsvText: string | null = null;
      let fetchError: Error | null = null;

      try {
        const response = await fetch(PORTO_UNIFIED_CSV_URL);
        if (!response.ok) throw new Error(`Erro HTTP ${response.status} ao buscar dados unificados.`);
        unifiedCsvText = await response.text();
      } catch (error) {
        console.error("Falha ao buscar CSV unificado Porto:", error);
        fetchError = error as Error;
      }
      
      setMessages(prev => prev.filter(msg => !(msg.text === CHAT_PROMPTS.initialLoadingData)));

      if (unifiedCsvText) {
        try {
            const parsedCsv = parseCsvText(unifiedCsvText);
            const combinedPortoData = parsePortoData(parsedCsv); 
            
            setAllGroupsData(combinedPortoData); 
            setCurrentSystemInstruction(generateDynamicSystemInstruction(combinedPortoData));

            if (combinedPortoData.length > 0) {
                addMessageToChat(INITIAL_BOT_MESSAGE, 'bot', <CpuChipIcon className="h-6 w-6 text-blue-500" />);
                addMessageToChat(CHAT_PROMPTS.initialChooseAction, 'bot', <LightBulbIcon className="h-6 w-6 text-yellow-500" />);
            } else { 
                 addMessageToChat(
                    "Nenhum grupo Porto encontrado no CSV unificado. Verifique o console para detalhes da análise.",
                    'error',
                    <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />
                );
                addMessageToChat(
                    CHAT_PROMPTS.initialErrorDataGeneric, 
                    'bot',
                    <CpuChipIcon className="h-6 w-6 text-blue-500" />
                );
            }
        } catch (parsingError) { 
            console.error("Erro ao analisar dados CSV unificado Porto:", parsingError);
            addMessageToChat(`Erro ao analisar CSV unificado Porto: ${(parsingError as Error).message}`, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
            addMessageToChat(CHAT_PROMPTS.initialErrorDataAlternative, 'bot', <CpuChipIcon className="h-6 w-6 text-blue-500" />);
            setAllGroupsData([]); setCurrentSystemInstruction(generateDynamicSystemInstruction([]));
        }
      } else { 
        let userErrorMessage = `Falha ao carregar dados dos grupos Porto.`;
        if (fetchError) userErrorMessage += `\nErro: ${fetchError.message}.`;
        addMessageToChat(userErrorMessage, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
        addMessageToChat(CHAT_PROMPTS.initialErrorDataAlternative, 'bot', <CpuChipIcon className="h-6 w-6 text-blue-500" />);
        setAllGroupsData([]); setCurrentSystemInstruction(generateDynamicSystemInstruction([])); 
      }
      setIsDataLoading(false); setAppStep(AppStep.INITIAL); 
    };
    fetchData();
  }, []);

  const scrollToBottom = () => { 
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = contentAreaRef.current.scrollHeight;
    }
  };
  useEffect(scrollToBottom, [messages, distinctGroupsForDisplay, currentGroups, simulationResult, comparisonResults, finalMergedResult, amortizationDetails, appStep]);


  const addMessageToChat = (text: string, type: InteractionMessage['type'], icon?: React.ReactNode, isLoadingMsg: boolean = false) => {
    setMessages(prev => [...prev, { id: Date.now(), text, type, icon, isLoading: isLoadingMsg }]);
  };

  const updateLastBotMessage = (text: string, icon?: React.ReactNode) => {
    setMessages(prev => prev.map((msg, index) => 
      index === prev.length - 1 && msg.type === 'bot' 
        ? { ...msg, text, isLoading: false, icon: icon || msg.icon } : msg ));
  };
  
  const processUserMessageToAI = async (messageText: string, currentHistory: InteractionMessage[]) => {
    if (!aiRef.current) { addMessageToChat(ERROR_FALLBACK_MESSAGE, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />); return; }
    setIsLoading(true); addMessageToChat("Processando...", 'bot', <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />, true);
    const conversationHistory: Content[] = currentHistory.filter(msg => !msg.isLoading).map(msg => ({ role: msg.type === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));
    const fullHistoryForApi: Content[] = [...conversationHistory, { role: 'user', parts: [{ text: messageText }] }];
    try {
      const response: GenerateContentResponse = await aiRef.current.models.generateContent({ model: 'gemini-2.5-flash-preview-04-17', contents: fullHistoryForApi, config: { systemInstruction: currentSystemInstruction }});
      updateLastBotMessage(response.text, <CpuChipIcon className="h-6 w-6 text-blue-500" />);
    } catch (error) { console.error("Error Gemini API:", error); updateLastBotMessage(ERROR_FALLBACK_MESSAGE, <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
    } finally { setIsLoading(false); }
  };

  const calculateAndSetFinalPortoMergedResult = (simulations: PortoSimulationResult[]) => {
    if (simulations.length === 0) { setFinalMergedResult(null); return; }
    const numQuotas = simulations.length;
    const totalCreditoOriginal = simulations.reduce((sum, s) => sum + s.valorCreditoOriginal, 0);
    const totalRecursoProprioNecessario = simulations.reduce((sum,s) => sum + s.recursoProprioNecessario + (s.tipoContratacao === 'fisica' ? s.valorFGTSInput : 0), 0); 
    
    const totalParcelaOriginalConsolidadaSemSeguro = simulations.reduce((sum, s) => {
        return sum + (s.isDilutionEffectivelyActive && s.parcelValueDuringDilutionSemSeguro !== undefined ? s.parcelValueDuringDilutionSemSeguro : s.parcelaOriginalNormalSemSeguro);
    }, 0);
    
    let totalParcelaOriginalConsolidadaComSeguro: number | undefined = undefined;
    if (simulations.some(s => s.tipoContratacao === 'fisica' && s.parcelaOriginalNormalComSeguro !== undefined)) {
        totalParcelaOriginalConsolidadaComSeguro = simulations.reduce((sum, s) => {
            let baseParcel = s.isDilutionEffectivelyActive && s.parcelValueDuringDilutionSemSeguro !== undefined ? s.parcelValueDuringDilutionSemSeguro : s.parcelaOriginalNormalSemSeguro;
            let finalParcel = baseParcel;
            if (s.tipoContratacao === 'fisica') {
                finalParcel = s.isDilutionEffectivelyActive && s.parcelValueDuringDilutionComSeguro !== undefined ? s.parcelValueDuringDilutionComSeguro : (s.parcelaOriginalNormalComSeguro || baseParcel);
            }
            return sum + finalParcel;
        }, 0);
    }
    
    const sumPrazoRestanteReduzirParcela = simulations.reduce((sum,s) => sum + s.reduzirParcelaOutcome.prazoRestantePosContemplacao, 0);
    const mediaPrazoRestantePosContemplacaoReduzirParcela = numQuotas > 0 ? sumPrazoRestanteReduzirParcela / numQuotas : 0;
    
    let totalParcelaPosContemplacaoConsolidadaSemSeguroReduzirParcela = 0;
    let totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela: number | undefined = undefined;

    simulations.forEach(s => {
        totalParcelaPosContemplacaoConsolidadaSemSeguroReduzirParcela += s.reduzirParcelaOutcome.parcelaPosContemplacaoSemSeguro;
        if (s.reduzirParcelaOutcome.parcelaPosContemplacaoComSeguro !== undefined) {
            if (totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela === undefined) totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela = 0;
            totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela += s.reduzirParcelaOutcome.parcelaPosContemplacaoComSeguro;
        } else if (s.tipoContratacao === 'juridica' && tipoContratacaoRequiresSeguro(simulations)) { 
             if (totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela === undefined) totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela = 0;
            totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela += s.reduzirParcelaOutcome.parcelaPosContemplacaoSemSeguro;
        }
    });

    const totalDilutableAdhesionValueSum = simulations.reduce((sum, s) => sum + s.totalDilutableAdhesionValue, 0);

    setFinalMergedResult({
        numberOfQuotas: numQuotas,
        totalCreditoOriginal,
        totalRecursoProprioNecessario, 
        totalParcelaOriginalConsolidadaSemSeguro,
        totalParcelaOriginalConsolidadaComSeguro: tipoContratacaoRequiresSeguro(simulations) ? totalParcelaOriginalConsolidadaComSeguro : undefined,
        mediaPrazoRestantePosContemplacaoReduzirParcela,
        totalParcelaPosContemplacaoConsolidadaSemSeguroReduzirParcela,
        totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela: tipoContratacaoRequiresSeguro(simulations) ? totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela : undefined,
        totalDilutableAdhesionValueSum,
        individualSimulations: simulations,
    });
  };

  const tipoContratacaoRequiresSeguro = (simulations: PortoSimulationResult[]): boolean => {
    return simulations.some(s => s.tipoContratacao === 'fisica');
  };

  const getFilteredPortoGroupsData = (criteria: FilterCriteria, sourceGroups: PortoGroupData[] = allGroupsData): PortoGroupData[] => {
      return PortoConsortiumLogic.applyPortoFiltersAndSort(sourceGroups, criteria);
  };

  const showDistinctPortoGroups = (criteria: FilterCriteria) => {
    const matchingItems = getFilteredPortoGroupsData(criteria);
    
    const distinctMap = new Map<string, PortoGroupData[]>();
    matchingItems.forEach(item => {
      if (!distinctMap.has(item.NomeGrupo)) {
        distinctMap.set(item.NomeGrupo, []);
      }
      distinctMap.get(item.NomeGrupo)!.push(item);
    });

    const distinctResult: DistinctPortoGroupInfo[] = Array.from(distinctMap.entries()).map(([nomeGrupo, items]) => {
      const firstItem = items[0]; 
      let valorCreditoMin = Infinity, valorCreditoMax = -Infinity;
      let parcelaReaisMin = Infinity, parcelaReaisMax = -Infinity;

      items.forEach(item => {
          if (item.ValorDoCredito < valorCreditoMin) valorCreditoMin = item.ValorDoCredito;
          if (item.ValorDoCredito > valorCreditoMax) valorCreditoMax = item.ValorDoCredito;
          if (item.ParcelaOriginalReais !== undefined) {
              if (item.ParcelaOriginalReais < parcelaReaisMin) parcelaReaisMin = item.ParcelaOriginalReais;
              if (item.ParcelaOriginalReais > parcelaReaisMax) parcelaReaisMax = item.ParcelaOriginalReais;
          }
      });
      if(parcelaReaisMin === Infinity) parcelaReaisMin = undefined as any; 
      if(parcelaReaisMax === -Infinity) parcelaReaisMax = undefined as any;


      return {
        nomeGrupo,
        valorCreditoMin: valorCreditoMin !== Infinity ? valorCreditoMin : undefined,
        valorCreditoMax: valorCreditoMax !== -Infinity ? valorCreditoMax : undefined,
        parcelaReaisMin,
        parcelaReaisMax,
        produtoRepresentativo: firstItem?.Bem,
        tipoBemRepresentativo: firstItem?.TipoBem,
        prazoOriginalMeses: firstItem?.PrazoOriginalMeses,
        mesesRestantesRepresentativo: firstItem?.MesesRestantes,
        taxaAdmTotal: firstItem?.TaxaAdministracaoTotal,
        taxaAdmAntecipadaRepresentativa: firstItem?.TaxaAdministracaoAntecipada,
        fundoReserva: firstItem?.FundoDeReserva,
        seguroRepresentativo: firstItem?.SeguroVidaApolicePercent,
        redutorParcelaRepresentativo: (typeof firstItem?.Redutor === 'number' && firstItem.Redutor > 0) ? `${firstItem.Redutor}%` : (firstItem?.Redutor === "CAMPANHA PARCELA ORIGINAL" ? "Campanha" : "N/A"),
        lanceEmbutido: firstItem?.LanceEmbutidoPercent,
        lanceFixoRepresentativo: firstItem?.LanceFixoPercent,
        lanceMinimoRepresentativo: firstItem?.LanceMinimo,
        lanceMaximoRepresentativo: firstItem?.LanceMaximo,
        mediaLance6MRepresentativo: firstItem?.MediaLance6M,
        lancesContempladosUltimoMesRepresentativo: firstItem?.LancesContempladosUltimoMes,
        vagasDisponiveisRepresentativa: firstItem?.VagasDisponiveis,
      };
    }).sort((a, b) => a.nomeGrupo.localeCompare(b.nomeGrupo));

    setDistinctGroupsForDisplay(distinctResult);
    setCurrentDistinctGroupsPage(1);
    setCurrentGroups([]);
    setSelectedGroupNumberForDetailView(null);

    if (distinctResult.length > 0) {
        const totalPages = Math.ceil(distinctResult.length / ITEMS_PER_PAGE);
        let message = CHAT_PROMPTS.showingDistinctGroupsPaginated
            .replace("{CURRENT_PAGE}", "1")
            .replace("{TOTAL_PAGES}", String(totalPages));
        
        if (criteria.desiredNetCreditEmbutido) {
            message = `Exibindo grupos onde é possível retirar ${formatCurrency(criteria.desiredNetCreditEmbutido)} líquidos usando lance embutido (Pág. 1/${totalPages}).`;
        } else if (criteria.textSearch) {
            message = `Exibindo grupos filtrados por "${criteria.textSearch}" (Pág. 1/${totalPages}).`;
        }
        addMessageToChat(message, 'bot', <BuildingLibraryIcon className="h-6 w-6 text-blue-500" />);
    } else {
        let noResultsMessage = CHAT_PROMPTS.noDistinctGroupsFound;
        if (criteria.desiredNetCreditEmbutido) {
             noResultsMessage = `Nenhum grupo encontrado que permita retirar ${formatCurrency(criteria.desiredNetCreditEmbutido)} líquidos com lance embutido (onde o valor líquido é >= 70% do total e o embutido do grupo é suficiente). Tente outro valor.`;
        }
        addMessageToChat(noResultsMessage, 'bot', <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />);
    }
    setAppStep(AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION);
  };

  const showCreditValuesForPortoGroup = (groupName: string) => {
    setSelectedGroupNumberForDetailView(groupName);
    let itemsInGroup = allGroupsData.filter(g => g.NomeGrupo === groupName);

    const criteriaForSubFilter = { ...activeFilterCriteria };
    delete criteriaForSubFilter.textSearch; 
    
    const relevantKeys = Object.keys(criteriaForSubFilter).filter(key => (criteriaForSubFilter as any)[key] !== undefined);

    if (relevantKeys.length > 0) {
        itemsInGroup = getFilteredPortoGroupsData(criteriaForSubFilter, itemsInGroup);
    }

    itemsInGroup.sort((a, b) => a.ValorDoCredito - b.ValorDoCredito);
    setCurrentGroups(itemsInGroup);
    setCurrentPage(1);

    if (itemsInGroup.length > 0) {
        const totalPages = Math.ceil(itemsInGroup.length / ITEMS_PER_PAGE);
        let message = CHAT_PROMPTS.showingGroupCreditValuesPaginated
            .replace("{GROUP_NAME}", groupName)
            .replace("{CURRENT_PAGE}", "1")
            .replace("{TOTAL_PAGES}", String(totalPages));
        addMessageToChat(message, 'bot', <TagIcon className="h-6 w-6 text-blue-500" />);
    } else {
        let noResultsMessage = CHAT_PROMPTS.noCreditValuesInSelectedGroup.replace("{GROUP_NAME}", groupName);
        if (criteriaForSubFilter.desiredNetCreditEmbutido) {
            noResultsMessage = `Nenhuma opção de crédito no Grupo ${groupName} atende aos critérios para retirar ${formatCurrency(criteriaForSubFilter.desiredNetCreditEmbutido)} líquidos (e outros filtros, se houver). Tente outro grupo ou refaça a busca.`;
        }
        addMessageToChat(noResultsMessage, 'bot', <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />);
    }
    setAppStep(AppStep.VIEW_GROUP_CREDIT_VALUES);
  };


  const proceedToAskAdditionalFilters = () => {
    addMessageToChat(CHAT_PROMPTS.askIfAddMoreFilters, 'bot', <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500" />);
    setAppStep(AppStep.ASK_IF_ADD_MORE_FILTERS);
  };


  const resetSimulationSpecificStates = () => {
    setSelectedGroup(null);
    setSimulationParams({});
    setSimulationResult(null);
    setAmortizationDetails(null);
    setAmortizationStrategyForDetail(null);
    setChosenLanceStrategy(null);
    setUseEmbutidoForLivreBid(null);
    setUserRedutorChoice(null);
    setCustomRedutorInput('');
    setInitialChosenDilutionPeriod(null);
  };

  const handleStartOverOrReset = (goToInitialStep: boolean = true) => {
    addMessageToChat("Reiniciando...", 'bot', <ArrowUturnLeftIcon className="h-5 w-5 mr-1" />);
    resetSimulationSpecificStates();
    setComparisonResults([]);
    setIsComparing(false);
    setCurrentComparisonLeg(0);
    setIsMergingQuotas(false);
    setNumberOfQuotasToMerge(null);
    setCurrentMergingQuotaIndex(0);
    setIndividualMergedSimulations([]);
    setFinalMergedResult(null);
    setActiveFilterCriteria({});
    setCurrentGroups([]);
    setDistinctGroupsForDisplay([]);
    setSelectedGroupNumberForDetailView(null);
    setManualGroupInput({});
    setManualFieldValue('');
    setCurrentPage(1);
    setCurrentDistinctGroupsPage(1);

    if (goToInitialStep) {
        setMessages([
            { id: Date.now(), text: INITIAL_BOT_MESSAGE, type: 'bot', icon: <CpuChipIcon className="h-6 w-6 text-blue-500" /> },
            { id: Date.now() + 1, text: CHAT_PROMPTS.initialChooseAction, type: 'bot', icon: <LightBulbIcon className="h-6 w-6 text-yellow-500" /> }
        ]);
        setAppStep(AppStep.INITIAL);
    }
  };

  const proceedToRedutorQuestions = (groupData: PortoGroupData) => {
    setSelectedGroup(groupData);
    setSimulationParams(prev => ({ ...prev, selectedGroupData: groupData }));

    let contextPrefix = "";
    if (isMergingQuotas && numberOfQuotasToMerge) {
        contextPrefix = `Cota ${currentMergingQuotaIndex + 1}/${numberOfQuotasToMerge}: `;
    } else if (isComparing) {
        contextPrefix = `Simulação ${comparisonResults.length + 1}: `;
    }
    
    addMessageToChat(`${contextPrefix}Grupo ${groupData.NomeGrupo} (${groupData.Bem}) selecionado.`, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);

    const groupRedutor = groupData.Redutor;
    let redutorDisplay = "Nenhum";
    if (typeof groupRedutor === 'number' && groupRedutor > 0) {
        redutorDisplay = `${formatPercentage(groupRedutor)}`;
    } else if (groupRedutor === "CAMPANHA PARCELA ORIGINAL") {
        redutorDisplay = "CAMPANHA PARCELA ORIGINAL";
    }

    if (redutorDisplay !== "Nenhum") {
        addMessageToChat(CHAT_PROMPTS.askOverrideRedutor.replace("{REDUTOR_DO_GRUPO}", redutorDisplay), 'bot', <CogIcon className="h-6 w-6 text-blue-500" />);
    } else {
        addMessageToChat(CHAT_PROMPTS.askToAddRedutor, 'bot', <CogIcon className="h-6 w-6 text-blue-500" />);
    }
    setAppStep(AppStep.ASK_OVERRIDE_REDUTOR);
  };

  const handleCreditValueSelection = (groupData: PortoGroupData) => {
    proceedToRedutorQuestions(groupData);
  };

  const handlePerformSimulation = (overrideParcelaContemplacao?: number) => {
      const parcelaContemplacaoToUse = overrideParcelaContemplacao !== undefined 
          ? overrideParcelaContemplacao 
          : simulationParams.parcelaContemplacao;

      if (!selectedGroup || simulationParams.tipoContratacao === undefined || chosenLanceStrategy === null || 
          parcelaContemplacaoToUse === undefined || 
          (chosenLanceStrategy === 'livre' && simulationParams.lanceLivrePercentual === undefined && simulationParams.lanceLivreReais === undefined && !useEmbutidoForLivreBid) ||
          (chosenLanceStrategy === 'livre' && useEmbutidoForLivreBid === null && (selectedGroup?.LanceEmbutidoPercent || 0) > 0) 
      ) {
          addMessageToChat("Parâmetros da simulação incompletos. Por favor, revise as etapas.", 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
          return;
      }

      let userRedutorOverrideParam: UserRedutorOverride = undefined;
      if (userRedutorChoice === 'alter' || userRedutorChoice === 'add') {
          if (customRedutorInput.toLowerCase().trim() === 'campanha' || customRedutorInput.toLowerCase().trim() === 'campanha parcela original') {
            userRedutorOverrideParam = "CAMPANHA PARCELA ORIGINAL";
          } else {
            const parsedRedutor = parsePercentageString(customRedutorInput);
            userRedutorOverrideParam = parsedRedutor === null ? null : parsedRedutor;
          }
      } else if (userRedutorChoice === 'keep') {
          userRedutorOverrideParam = undefined; 
      } else if (userRedutorChoice === 'no_add') {
          userRedutorOverrideParam = null;
      }

      const finalSimParams: PortoSimulationParams = {
          selectedGroupData: selectedGroup,
          tipoContratacao: simulationParams.tipoContratacao,
          valorFGTS: simulationParams.tipoContratacao === 'juridica' ? 0 : (simulationParams.valorFGTS || 0),
          lanceLivrePercentual: chosenLanceStrategy === 'fixo' ? 0 : simulationParams.lanceLivrePercentual,
          lanceLivreReais: chosenLanceStrategy === 'fixo' ? undefined : simulationParams.lanceLivreReais,
          parcelaContemplacao: parcelaContemplacaoToUse,
          chosenLanceStrategy: chosenLanceStrategy,
          useGroupLanceEmbutidoForLivre: chosenLanceStrategy === 'livre' ? (useEmbutidoForLivreBid ?? false) : false,
          userRedutorOverride: userRedutorOverrideParam,
          initialChosenDilutionPeriodInMonths: initialChosenDilutionPeriod,
      };

      const result = PortoConsortiumLogic.calculatePortoSimulationDetails(finalSimParams);
      setSimulationResult(result);
      setAmortizationDetails(null); 
      setAmortizationStrategyForDetail(null);

      if (isMergingQuotas && numberOfQuotasToMerge) {
        const updatedMergedSims = [...individualMergedSimulations, result];
        setIndividualMergedSimulations(updatedMergedSims);
        if (updatedMergedSims.length === numberOfQuotasToMerge) {
            calculateAndSetFinalPortoMergedResult(updatedMergedSims);
            addMessageToChat(CHAT_PROMPTS.mergedSimulationReady, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
            setAppStep(AppStep.SHOW_MERGED_SIMULATION_RESULT);
            setIsMergingQuotas(false);
            setNumberOfQuotasToMerge(null);
            setCurrentMergingQuotaIndex(0);
        } else {
            setCurrentMergingQuotaIndex(prev => prev + 1);
            resetSimulationSpecificStates();
            setActiveFilterCriteria({});
            const nextQuotaContext = `Junção Cota ${currentMergingQuotaIndex + 2}/${numberOfQuotasToMerge}`;
            addMessageToChat(CHAT_PROMPTS.askHowToFindGroupForLeg.replace("{FLOW_CONTEXT}", nextQuotaContext), 'bot', <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD);
        }
      } else if (isComparing) {
          addMessageToChat("Simulação calculada. Lógica de comparação ainda a ser implementada.", 'bot');
          setAppStep(AppStep.SHOW_SIMULATION_RESULT);
      } else {
          addMessageToChat(CHAT_PROMPTS.simulationResultActions, 'bot', <CalculatorIcon className="h-6 w-6 text-blue-500" />);
          setAppStep(AppStep.SHOW_SIMULATION_RESULT);
      }
      setIsLoading(false);
  };

  const handleShowAmortizationDetails = (strategy: AmortizacaoPreferida) => {
    if (!simulationResult) {
        addMessageToChat("Simulação não encontrada para detalhar amortização.", 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
        return;
    }
    try {
        const details = PortoConsortiumLogic.calculateAmortizationStepByStep(simulationResult, strategy);
        setAmortizationDetails(details);
        setAmortizationStrategyForDetail(strategy);
        addMessageToChat(CHAT_PROMPTS.showingAmortizationDetails.replace("{STRATEGY_NAME}", strategy === 'reduzir_prazo' ? 'Reduzir Prazo' : 'Reduzir Parcela'), 'bot', <DocumentChartBarIcon className="h-6 w-6 text-blue-500" />);
        setAppStep(AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS);
    } catch (error) {
        console.error("Erro ao calcular detalhes da amortização:", error);
        addMessageToChat("Ocorreu um erro ao calcular os detalhes da amortização. Verifique os dados da simulação ou tente novamente.", 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
    }
  };

  const handleManualStepSubmit = () => {
    setIsLoading(true);
    const currentInput = manualFieldValue.trim();
    switch (appStep) {
        case AppStep.ASK_MANUAL_GROUP_CREDIT:
            const manualCredit = parseFlexibleNumericInput(currentInput);
            if (manualCredit === null || manualCredit <= 0) {
                addMessageToChat(CHAT_PROMPTS.invalidInputNumber, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false);
                return;
            }
            setManualGroupInput(prev => ({ ...prev, ValorDoCredito: manualCredit, BemManual: `Crédito Manual ${formatCurrency(manualCredit)}`, NomeGrupo: "MANUAL" }));
            addMessageToChat(CHAT_PROMPTS.askManualGroupPrazo, 'bot', <CalendarDaysIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.ASK_MANUAL_GROUP_PRAZO);
            setManualFieldValue(''); setIsLoading(false);
            break;
        case AppStep.ASK_MANUAL_GROUP_PRAZO:
            const manualPrazo = parseInt(currentInput.replace(/\D/g, ''), 10);
            if (isNaN(manualPrazo) || manualPrazo <= 0) {
                addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false); return;
            }
            setManualGroupInput(prev => ({ ...prev, PrazoOriginalMeses: manualPrazo }));
            addMessageToChat(CHAT_PROMPTS.askManualGroupTaxaAdmTotal, 'bot', <ScaleIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.ASK_MANUAL_GROUP_TAXA_ADM_TOTAL);
            setManualFieldValue(''); setIsLoading(false);
            break;
        case AppStep.ASK_MANUAL_GROUP_TAXA_ADM_TOTAL:
            const manualTaxaAdmTotal = parsePercentageString(currentInput);
            if (manualTaxaAdmTotal === null || manualTaxaAdmTotal < 0) {
                addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false); return;
            }
            setManualGroupInput(prev => ({ ...prev, TaxaAdministracaoTotal: manualTaxaAdmTotal }));
            addMessageToChat(CHAT_PROMPTS.askManualGroupTaxaAdmAntecipada, 'bot', <ArrowTrendingDownIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.ASK_MANUAL_GROUP_TAXA_ADM_ANTECIPADA);
            setManualFieldValue(''); setIsLoading(false);
            break;
        case AppStep.ASK_MANUAL_GROUP_TAXA_ADM_ANTECIPADA:
             const manualTaxaAdmAntec = parsePercentageString(currentInput);
             if (manualTaxaAdmAntec === null || manualTaxaAdmAntec < 0) {
                 addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                 setIsLoading(false); return;
             }
             setManualGroupInput(prev => ({ ...prev, TaxaAdministracaoAntecipada: manualTaxaAdmAntec }));
             addMessageToChat(CHAT_PROMPTS.askManualGroupFundoReserva, 'bot', <PuzzlePieceIcon className="h-6 w-6 text-blue-500" />);
             setAppStep(AppStep.ASK_MANUAL_GROUP_FUNDO_RESERVA);
             setManualFieldValue(''); setIsLoading(false);
             break;
        case AppStep.ASK_MANUAL_GROUP_FUNDO_RESERVA:
             const manualFR = parsePercentageString(currentInput);
             if (manualFR === null || manualFR < 0) {
                 addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                 setIsLoading(false); return;
             }
             setManualGroupInput(prev => ({ ...prev, FundoDeReserva: manualFR }));
             addMessageToChat(CHAT_PROMPTS.askManualGroupLanceEmbutido, 'bot', <ArrowsRightLeftIcon className="h-6 w-6 text-blue-500" />);
             setAppStep(AppStep.ASK_MANUAL_GROUP_LANCE_EMBUTIDO);
             setManualFieldValue(''); setIsLoading(false);
             break;
        case AppStep.ASK_MANUAL_GROUP_LANCE_EMBUTIDO:
             const manualEmbutido = parsePercentageString(currentInput);
             if (manualEmbutido === null || manualEmbutido < 0) {
                addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false); return;
             }
             setManualGroupInput(prev => ({...prev, LanceEmbutidoPercent: manualEmbutido}));
             addMessageToChat(CHAT_PROMPTS.askManualGroupLanceFixo, 'bot', <BanknotesIcon className="h-6 w-6 text-blue-500" />);
             setAppStep(AppStep.ASK_MANUAL_GROUP_LANCE_FIXO);
             setManualFieldValue(''); setIsLoading(false);
             break;
        case AppStep.ASK_MANUAL_GROUP_LANCE_FIXO:
             const manualFixo = parsePercentageString(currentInput);
             if (manualFixo === null && currentInput !== "" && currentInput !== "0") { 
                addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false); return;
             }
             setManualGroupInput(prev => ({...prev, LanceFixoPercent: manualFixo ?? undefined}));
             addMessageToChat(CHAT_PROMPTS.askManualGroupRedutor, 'bot', <ArrowTrendingDownIcon className="h-6 w-6 text-blue-500" />);
             setAppStep(AppStep.ASK_MANUAL_GROUP_REDUTOR);
             setManualFieldValue(''); setIsLoading(false);
             break;
        case AppStep.ASK_MANUAL_GROUP_REDUTOR:
             let manualRedutor: number | "CAMPANHA PARCELA ORIGINAL" = undefined as any;
             if (currentInput.toLowerCase().trim() === "campanha parcela original" || currentInput.toLowerCase().trim() === "campanha") {
                manualRedutor = "CAMPANHA PARCELA ORIGINAL";
             } else {
                const redutorNum = parsePercentageString(currentInput);
                if (redutorNum === null && currentInput !== "" && currentInput !== "0") {
                    addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                    setIsLoading(false); return;
                }
                manualRedutor = redutorNum ?? 0;
             }
             setManualGroupInput(prev => ({...prev, Redutor: manualRedutor}));
             addMessageToChat(CHAT_PROMPTS.askManualGroupSeguro, 'bot', <UserGroupIcon className="h-6 w-6 text-blue-500" />);
             setAppStep(AppStep.ASK_MANUAL_GROUP_SEGURO);
             setManualFieldValue(''); setIsLoading(false);
             break;
        case AppStep.ASK_MANUAL_GROUP_SEGURO:
            const manualSeguro = parsePercentageString(currentInput);
            if (manualSeguro === null && currentInput !== "" && currentInput !== "0") { 
                addMessageToChat(CHAT_PROMPTS.invalidManualInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
                setIsLoading(false); return;
            }
            setManualGroupInput(prev => ({...prev, SeguroVidaApolicePercent: manualSeguro ?? undefined}));
            
            const finalManualGroup: PortoGroupData = {
                NomeGrupo: manualGroupInput.NomeGrupo || "MANUAL",
                Bem: manualGroupInput.BemManual || `Crédito ${formatCurrency(manualGroupInput.ValorDoCredito)}`,
                ValorDoCredito: manualGroupInput.ValorDoCredito || 0,
                TaxaAdministracaoTotal: manualGroupInput.TaxaAdministracaoTotal || 0,
                TaxaAdministracaoAntecipada: manualGroupInput.TaxaAdministracaoAntecipada || 0,
                FundoDeReserva: manualGroupInput.FundoDeReserva || 0,
                LanceEmbutidoPercent: manualGroupInput.LanceEmbutidoPercent || 0,
                LanceFixoPercent: manualGroupInput.LanceFixoPercent,
                Redutor: manualGroupInput.Redutor || 0,
                PrazoOriginalMeses: manualGroupInput.PrazoOriginalMeses || 0,
                SeguroVidaApolicePercent: manualGroupInput.SeguroVidaApolicePercent,
                MesesRestantes: manualGroupInput.PrazoOriginalMeses, 
                id: `manual-${Date.now()}`
            };
            addMessageToChat(CHAT_PROMPTS.manualGroupDataReceived, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
            proceedToRedutorQuestions(finalManualGroup);
            setManualFieldValue(''); setIsLoading(false);
            break;
        case AppStep.ASK_NEW_REDUTOR_PERCENT:
            const redutorInput = currentInput.trim();
            let isValidRedutor = false;
            if (redutorInput.toLowerCase() === 'campanha' || redutorInput.toLowerCase() === 'campanha parcela original') {
                isValidRedutor = true;
                setCustomRedutorInput('CAMPANHA PARCELA ORIGINAL'); 
            } else {
                const parsedRedutor = parsePercentageString(redutorInput);
                if (parsedRedutor !== null && parsedRedutor >= 0 && parsedRedutor <= 100) {
                    isValidRedutor = true;
                    setCustomRedutorInput(String(parsedRedutor));
                }
            }
            if (isValidRedutor) {
                addMessageToChat(CHAT_PROMPTS.askDilutionPeriod, 'bot', <ClockIcon className="h-6 w-6 text-blue-500" />);
                setAppStep(AppStep.ASK_DILUTION_PERIOD);
            } else {
                addMessageToChat(CHAT_PROMPTS.invalidRedutorInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            }
            setManualFieldValue(''); setIsLoading(false);
            break;
        default:
            setIsLoading(false);
            break;
    }
  };

  const handleUserInput = async () => {
    if (!userInput.trim() || isDataLoading || isLoading ||
        appStep.toString().startsWith("ASK_MANUAL_GROUP") || 
        appStep === AppStep.ASK_NEW_REDUTOR_PERCENT) 
        return;
    
    addMessageToChat(userInput, 'user', <UserCircleIcon className="h-6 w-6 text-gray-700" />);
    const currentInput = userInput.trim();
    setUserInput('');
    setIsLoading(true);
    
    const historyForAICall = [...messages];
    let effectivePrazoForPrompt: number | string = "N/A";
    if (selectedGroup) {
        effectivePrazoForPrompt = (selectedGroup.MesesRestantes !== undefined && selectedGroup.MesesRestantes > 0 && selectedGroup.MesesRestantes <= selectedGroup.PrazoOriginalMeses)
                                   ? selectedGroup.MesesRestantes
                                   : selectedGroup.PrazoOriginalMeses;
    }

    switch (appStep) {
      case AppStep.INITIAL:
      case AppStep.SHOW_SIMULATION_RESULT:
      case AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS:
      case AppStep.SHOW_COMPARISON_VIEW:
      case AppStep.SHOW_MERGED_SIMULATION_RESULT:
        await processUserMessageToAI(currentInput, historyForAICall);
        setIsLoading(false);
        break;

      case AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION:
        if (currentInput.trim().length > 0) {
          const searchTerm = currentInput.trim().toLowerCase();
          const criteriaWithTextSearch = { ...activeFilterCriteria, textSearch: searchTerm };
          setActiveFilterCriteria(criteriaWithTextSearch);
          showDistinctPortoGroups(criteriaWithTextSearch);
        } else
           await processUserMessageToAI(currentInput, historyForAICall);
        setIsLoading(false);
        break;
      case AppStep.VIEW_GROUP_CREDIT_VALUES:
        if (currentInput.trim().length > 0 && selectedGroupNumberForDetailView) {
            let itemsInSelectedGroup = allGroupsData.filter(g => g.NomeGrupo === selectedGroupNumberForDetailView);
            const baseFilters = { ...activeFilterCriteria };
            delete baseFilters.textSearch;
            if (Object.keys(baseFilters).length > 0) {
                itemsInSelectedGroup = getFilteredPortoGroupsData(baseFilters, itemsInSelectedGroup);
            }

            const searchTerm = currentInput.trim().toLowerCase();
            const subFilteredValues = itemsInSelectedGroup.filter(g => 
              g.Bem.toLowerCase().includes(searchTerm) || 
              formatCurrency(g.ValorDoCredito).toLowerCase().includes(searchTerm) ||
              (g.ParcelaOriginalReais && formatCurrency(g.ParcelaOriginalReais).toLowerCase().includes(searchTerm))
            );
            setCurrentGroups(subFilteredValues);
            setCurrentPage(1);
            if (subFilteredValues.length > 0) addMessageToChat(`Filtrando opções por "${searchTerm}" no Gr. ${selectedGroupNumberForDetailView}.`, 'bot', <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />);
            else addMessageToChat(`Nenhuma opção encontrada para "${searchTerm}" no Gr. ${selectedGroupNumberForDetailView}.`, 'bot', <MagnifyingGlassIcon className="h-6 w-6 text-blue-500" />);
        } else 
            await processUserMessageToAI(currentInput, historyForAICall);
        setIsLoading(false);
        break;
        
      case AppStep.CHOOSE_GROUP_SEARCH_METHOD:
      case AppStep.ASK_IF_ADD_MORE_FILTERS:
      case AppStep.CHOOSE_ADDITIONAL_FILTER_TYPE:
      case AppStep.ASK_OVERRIDE_REDUTOR:
      case AppStep.ASK_DILUTION_PERIOD:
      case AppStep.ASK_LANCE_STRATEGY:
      case AppStep.ASK_TIPO_CONTRATACAO:
      case AppStep.ASK_SHARE_METHOD:
      case AppStep.ASK_WHATSAPP_SHARE_TYPE:
        addMessageToChat("Use os botões para escolher uma opção.", 'bot', <QuestionMarkCircleIcon className="h-6 w-6 text-yellow-500" />);
        setIsLoading(false);
        break;
      
      case AppStep.ASK_CREDIT_VALUE_FOR_FILTER:
        const creditInput = parseRangeInput(currentInput);
        if (creditInput === null) {
            addMessageToChat(CHAT_PROMPTS.invalidInputNumberRange, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setActiveFilterCriteria(prev => ({ ...prev, credit: creditInput, desiredNetCreditEmbutido: undefined })); 
        addMessageToChat(`Filtro de crédito '${currentInput}' adicionado.`, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
        proceedToAskAdditionalFilters();
        setIsLoading(false);
        break;
      
      case AppStep.ASK_DESIRED_NET_CREDIT_FOR_EMBUTIDO_SEARCH:
        const desiredNetCredit = parseFlexibleNumericInput(currentInput);
        if (desiredNetCredit === null || desiredNetCredit <= 0) {
            addMessageToChat(CHAT_PROMPTS.invalidInputNumber, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setActiveFilterCriteria(prev => ({ ...prev, desiredNetCreditEmbutido: desiredNetCredit, credit: undefined })); 
        addMessageToChat(CHAT_PROMPTS.netCreditEmbutidoFilterApplied.replace("{DESIRED_NET_CREDIT}", formatCurrency(desiredNetCredit)), 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
        proceedToAskAdditionalFilters(); 
        setIsLoading(false);
        break;

      case AppStep.ASK_FILTER_INPUT_PRAZO:
        const prazoInput = parseRangeInput(currentInput);
        if (prazoInput === null || (typeof prazoInput === 'number' && prazoInput <= 0) || (typeof prazoInput === 'object' && (prazoInput.min <= 0 || prazoInput.max <= 0))) {
            addMessageToChat(CHAT_PROMPTS.invalidPrazoInput, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setActiveFilterCriteria(prev => ({ ...prev, prazo: prazoInput }));
        addMessageToChat(CHAT_PROMPTS.filterAddedAskForMore, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
        setAppStep(AppStep.ASK_IF_ADD_MORE_FILTERS);
        setIsLoading(false);
        break;

      case AppStep.ASK_NUMBER_OF_QUOTAS_TO_MERGE:
        const numQuotas = parseInt(currentInput.replace(/\D/g, ''), 10);
        if (isNaN(numQuotas) || numQuotas < 2) {
            addMessageToChat(CHAT_PROMPTS.invalidNumberOfQuotas, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setNumberOfQuotasToMerge(numQuotas);
        setCurrentMergingQuotaIndex(0);
        setIndividualMergedSimulations([]);
        setFinalMergedResult(null);
        setIsMergingQuotas(true);
        resetSimulationSpecificStates();
        setActiveFilterCriteria({});
        const mergeContext = `Junção Cota ${1}/${numQuotas}`;
        addMessageToChat(CHAT_PROMPTS.askHowToFindGroupForLeg.replace("{FLOW_CONTEXT}", mergeContext), 'bot', <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500" />);
        setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD);
        setIsLoading(false);
        break;
        
      case AppStep.ASK_FGTS_VALUE:
        const fgtsVal = parseFlexibleNumericInput(currentInput);
        if (fgtsVal === null || fgtsVal < 0) {
            addMessageToChat(CHAT_PROMPTS.invalidInputNumber, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setSimulationParams(prev => ({ ...prev, valorFGTS: fgtsVal }));
        let contemplationPromptContextFGTS = "";
        if (isMergingQuotas && numberOfQuotasToMerge) contemplationPromptContextFGTS = `Cota ${currentMergingQuotaIndex + 1}/${numberOfQuotasToMerge}: `;
        else if (isComparing) contemplationPromptContextFGTS = `Sim. ${comparisonResults.length + 1}: `;
        
        if (chosenLanceStrategy === 'fixo') {
            addMessageToChat(`${contemplationPromptContextFGTS}${CHAT_PROMPTS.askContemplationParcela.replace("{MAX_PRAZO}", String(effectivePrazoForPrompt))}`, 'bot', <CalendarDaysIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.ASK_CONTEMPLATION_PARCELA);
        } else {
            addMessageToChat(`${contemplationPromptContextFGTS}${CHAT_PROMPTS.askLanceLivrePercentInput}`, 'bot', <BanknotesIcon className="h-6 w-6 text-blue-500" />);
            setAppStep(AppStep.ASK_LANCE_LIVRE_PERCENT);
        }
        setIsLoading(false);
        break;

      case AppStep.ASK_LANCE_LIVRE_PERCENT:
        const rawLanceInput = currentInput.trim();
        let lancePercentFromInput: number | undefined = undefined;
        let lanceReaisFromInput: number | undefined = undefined;
        
        if (rawLanceInput.includes('%')) {
            const percVal = parsePercentageString(rawLanceInput);
            if (percVal !== null && percVal >= 0 && percVal <= 100) lancePercentFromInput = percVal;
        } else if (rawLanceInput.toLowerCase().includes('r$') || rawLanceInput.match(/\d(k|mil)\b/i) || parseFloat(rawLanceInput.replace(',','.')) > 100 || rawLanceInput.includes('.') || rawLanceInput.includes(',')) {
            const reaisVal = parseFlexibleNumericInput(rawLanceInput);
            if (reaisVal !== null && reaisVal >= 0) lanceReaisFromInput = reaisVal;
        } else { 
            const numericVal = parseFlexibleNumericInput(rawLanceInput);
            if (numericVal !== null && numericVal >= 0 && numericVal <= 100) lancePercentFromInput = numericVal;
            else if (numericVal !== null && numericVal > 100) lanceReaisFromInput = numericVal; 
        }

        if (lancePercentFromInput !== undefined) {
            setSimulationParams(prev => ({ ...prev, lanceLivrePercentual: lancePercentFromInput, lanceLivreReais: undefined }));
        } else if (lanceReaisFromInput !== undefined) {
            setSimulationParams(prev => ({ ...prev, lanceLivreReais: lanceReaisFromInput, lanceLivrePercentual: undefined }));
        } else {
            addMessageToChat(CHAT_PROMPTS.invalidLanceLivrePercent, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        let contemplationPromptContextLance = "";
        if (isMergingQuotas && numberOfQuotasToMerge) contemplationPromptContextLance = `Cota ${currentMergingQuotaIndex + 1}/${numberOfQuotasToMerge}: `;
        else if (isComparing) contemplationPromptContextLance = `Sim. ${comparisonResults.length + 1}: `;
        addMessageToChat(`${contemplationPromptContextLance}${CHAT_PROMPTS.askContemplationParcela.replace("{MAX_PRAZO}", String(effectivePrazoForPrompt))}`, 'bot', <CalendarDaysIcon className="h-6 w-6 text-blue-500" />);
        setAppStep(AppStep.ASK_CONTEMPLATION_PARCELA);
        setIsLoading(false);
        break;

      case AppStep.ASK_CONTEMPLATION_PARCELA:
        const parcelaContemplacao = parseInt(currentInput.replace(/\D/g, ''), 10);
        const maxPrazoForValidation = typeof effectivePrazoForPrompt === 'number' ? effectivePrazoForPrompt : (selectedGroup ? selectedGroup.PrazoOriginalMeses : 0);
        if (isNaN(parcelaContemplacao) || parcelaContemplacao <= 0 || parcelaContemplacao > maxPrazoForValidation) {
            addMessageToChat(CHAT_PROMPTS.invalidContemplationParcela.replace("{MAX_PRAZO}", String(maxPrazoForValidation)), 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
            setIsLoading(false); return;
        }
        setSimulationParams(prev => ({ ...prev, parcelaContemplacao: parcelaContemplacao }));
        handlePerformSimulation(parcelaContemplacao); 
        setIsLoading(false);
        break;
      
      case AppStep.ASK_WHATSAPP_NUMBER:
        const whatsappNumberRegex = /^[1-9]{2}9?[0-9]{8}$/; 
        const cleanNumber = currentInput.replace(/\D/g, '');
        if (whatsappNumberRegex.test(cleanNumber)) {
            let summary = "";
            let successMessage = "";
            let nextStep = AppStep.INITIAL;

            if (sharingContext === 'amortization' && amortizationDetails) {
                summary = generateAmortizationDetailsText(amortizationDetails);
                successMessage = CHAT_PROMPTS.whatsAppAmortizationShareSuccess.replace("{WHATSAPP_NUMBER}", currentInput);
                nextStep = AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS;
            } else if (sharingContext === 'merged' && finalMergedResult) {
                summary = generateMergedSimulationSummaryText(finalMergedResult);
                successMessage = CHAT_PROMPTS.whatsAppMergedShareSuccess.replace("{WHATSAPP_NUMBER}", currentInput);
                nextStep = AppStep.SHOW_MERGED_SIMULATION_RESULT;
            } else if (sharingContext === 'single' && simulationResult) {
                summary = whatsAppShareType === 'resumo' ? generateSimulationSummaryTextResumo(simulationResult) : generateSimulationSummaryText(simulationResult);
                successMessage = CHAT_PROMPTS.whatsAppShareSuccess.replace("{WHATSAPP_NUMBER}", currentInput);
                nextStep = AppStep.SHOW_SIMULATION_RESULT;
            } else {
                 addMessageToChat(CHAT_PROMPTS.errorSharingGeneric, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
                 nextStep = finalMergedResult ? AppStep.SHOW_MERGED_SIMULATION_RESULT : (simulationResult ? AppStep.SHOW_SIMULATION_RESULT : AppStep.INITIAL);
                 setIsLoading(false); setSharingContext(null); setWhatsAppShareType(null);
                 break;
            }

            const whatsappUrl = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(summary)}`;
            window.open(whatsappUrl, '_blank');
            addMessageToChat(successMessage, 'bot', <ShareIcon className="h-6 w-6 text-sky-500" />);
            setAppStep(nextStep);
        } else {
            addMessageToChat(CHAT_PROMPTS.invalidWhatsAppNumber, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
        }
        setSharingContext(null); setWhatsAppShareType(null);
        setIsLoading(false);
        break;
      
      case AppStep.ASK_EMAIL_ADDRESS:
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(currentInput)) {
            let summary = "";
            let subject = "";
            let successMessage = "";
            let nextStep = AppStep.INITIAL;

            if (sharingContext === 'amortization' && amortizationDetails) {
                summary = generateAmortizationDetailsText(amortizationDetails);
                subject = `Detalhamento Amortização Consórcio Porto (${amortizationDetails.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'Red. Prazo' : 'Red. Parcela'})`;
                successMessage = CHAT_PROMPTS.emailAmortizationShareSuccess.replace("{EMAIL_ADDRESS}", currentInput);
                nextStep = AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS;
            } else if (sharingContext === 'merged' && finalMergedResult) {
                summary = generateMergedSimulationSummaryText(finalMergedResult);
                subject = `Junção de ${finalMergedResult.numberOfQuotas} Cotas - Consórcio Porto`;
                successMessage = CHAT_PROMPTS.emailMergedShareSuccess.replace("{EMAIL_ADDRESS}", currentInput);
                nextStep = AppStep.SHOW_MERGED_SIMULATION_RESULT;
            } else if (sharingContext === 'single' && simulationResult) {
                summary = generateSimulationSummaryText(simulationResult);
                subject = `Simulação Consórcio Porto - Grupo ${simulationResult.nomeGrupo}`;
                successMessage = CHAT_PROMPTS.emailShareSuccess.replace("{EMAIL_ADDRESS}", currentInput);
                nextStep = AppStep.SHOW_SIMULATION_RESULT;
            } else {
                addMessageToChat(CHAT_PROMPTS.errorSharingGeneric, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
                nextStep = finalMergedResult ? AppStep.SHOW_MERGED_SIMULATION_RESULT : (simulationResult ? AppStep.SHOW_SIMULATION_RESULT : AppStep.INITIAL);
                setIsLoading(false); setSharingContext(null);
                break;
            }

            const mailtoUrl = `mailto:${currentInput}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
            window.open(mailtoUrl);
            addMessageToChat(successMessage, 'bot', <EnvelopeIcon className="h-6 w-6 text-orange-500" />);
            setAppStep(nextStep);
        } else {
            addMessageToChat(CHAT_PROMPTS.invalidEmailAddress, 'bot', <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />);
        }
        setSharingContext(null);
        setIsLoading(false);
        break;

      default:
        if (userInput.trim().length > 0) {
            await processUserMessageToAI(currentInput, historyForAICall);
        } else {
            addMessageToChat("Por favor, digite sua mensagem ou selecione uma opção quando disponível.", 'bot', <QuestionMarkCircleIcon className="h-6 w-6 text-yellow-500" />);
        }
        setIsLoading(false);
        break;
    }
  };


  const handleGeneratePdf = (context: 'single' | 'merged' | 'amortization' = 'single') => {
    let summaryText: string | undefined;
    let fileName = "Simulacao_Porto.pdf";

    if (context === 'amortization' && amortizationDetails) {
        summaryText = generateAmortizationDetailsText(amortizationDetails);
        const strategySuffix = amortizationDetails.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'RedPrazo' : 'RedParcela';
        fileName = `Det_Amort_Porto_${simulationResult?.nomeGrupo.replace(/\s/g, '_') || 'Calc'}_${strategySuffix}.pdf`;
    } else if (context === 'merged' && finalMergedResult) {
        summaryText = generateMergedSimulationSummaryText(finalMergedResult);
        fileName = `Juncao_Cotas_Porto_${finalMergedResult.numberOfQuotas}.pdf`;
    } else if (context === 'single' && simulationResult) {
        summaryText = generateSimulationSummaryText(simulationResult);
        fileName = `Simulacao_Porto_${simulationResult.nomeGrupo.replace(/\s/g, '_')}_${simulationResult.bem.replace(/\s/g, '_')}.pdf`;
    } else {
        addMessageToChat(CHAT_PROMPTS.errorGeneratingPdf, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(10);
    
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 15;
    const lineHeight = 7; 
    const margin = 15;

    const lines = doc.splitTextToSize(summaryText, doc.internal.pageSize.width - margin * 2);
    lines.forEach((line: string) => {
        if (yPosition + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += lineHeight;
    });

    doc.save(fileName);
    let successMsg = CHAT_PROMPTS.pdfSuccess;
    if (context === 'merged') successMsg = CHAT_PROMPTS.mergedPdfSuccess;
    else if (context === 'amortization') successMsg = CHAT_PROMPTS.amortizationPdfSuccess;
    addMessageToChat(successMsg, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
  };
  
  const handleInitiateShare = (context: 'single' | 'merged' | 'amortization' = 'single') => {
    if (
        (context === 'amortization' && !amortizationDetails) ||
        (context === 'merged' && !finalMergedResult) ||
        (context === 'single' && !simulationResult)
    ) {
        addMessageToChat(CHAT_PROMPTS.errorSharingGeneric, 'error', <ExclamationCircleIcon className="h-6 w-6 text-red-500" />);
        return;
    }
    setSharingContext(context);
    setWhatsAppShareType(null); 

    let sharePrompt = CHAT_PROMPTS.askShareMethod;
    if (context === 'amortization') sharePrompt = CHAT_PROMPTS.askShareMethodAmortization.replace("{STRATEGY_NAME}", amortizationDetails?.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'Reduzir Prazo' : 'Reduzir Parcela');
    else if (context === 'merged') sharePrompt = CHAT_PROMPTS.askShareMethodMerged;

    addMessageToChat(sharePrompt, 'bot', <ShareIcon className="h-6 w-6 text-blue-500" />);
    setAppStep(AppStep.ASK_SHARE_METHOD);
  };

  const renderActionButtons = () => {
    if (appStep.toString().startsWith("ASK_MANUAL_GROUP") && appStep !== AppStep.ASK_NEW_REDUTOR_PERCENT) return null;
    if (appStep === AppStep.ASK_NEW_REDUTOR_PERCENT) return null;

    const commonContextActionsDisabled = isLoading || isDataLoading;
    
    let contextPrefix = "";
    if (isMergingQuotas && numberOfQuotasToMerge) {
        contextPrefix = `Cota ${currentMergingQuotaIndex + 1}/${numberOfQuotasToMerge}: `;
    } else if (isComparing) {
        contextPrefix = `Sim. ${currentComparisonLeg + 1}: `;
    }
    
    let effectivePrazoForPrompt: number | string = "N/A";
    if (selectedGroup) {
        effectivePrazoForPrompt = (selectedGroup.MesesRestantes !== undefined && selectedGroup.MesesRestantes > 0 && selectedGroup.MesesRestantes <= selectedGroup.PrazoOriginalMeses)
                                   ? selectedGroup.MesesRestantes
                                   : selectedGroup.PrazoOriginalMeses;
    }

    switch (appStep) {
      case AppStep.INITIAL:
      case AppStep.SHOW_MERGED_SIMULATION_RESULT:
      case AppStep.SHOW_COMPARISON_VIEW:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { handleStartOverOrReset(false); setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD); addMessageToChat(CHAT_PROMPTS.chooseGroupSearchMethod, 'bot', <ListBulletIcon className="h-5 w-5"/>); }} icon={<PlusCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Nova Simulação</ActionButton>
            {allGroupsData.length > 0 && <ActionButton onClick={() => { setActiveFilterCriteria({}); showDistinctPortoGroups({}); }} icon={<MagnifyingGlassIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Ver Grupos</ActionButton>}
            {!isMergingQuotas && !isComparing && <ActionButton onClick={() => { setAppStep(AppStep.ASK_NUMBER_OF_QUOTAS_TO_MERGE); addMessageToChat(CHAT_PROMPTS.askNumberOfQuotasToMerge, 'bot', <ArrowsRightLeftIcon className="h-5 w-5"/>); }} icon={<ArrowsRightLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Juntar Cotas</ActionButton>}
            <ActionButton onClick={() => { handleStartOverOrReset(false); setAppStep(AppStep.ASK_MANUAL_GROUP_CREDIT); addMessageToChat(CHAT_PROMPTS.askManualGroupCredit, 'bot', <PencilSquareIcon className="h-5 w-5"/>); }} icon={<PencilSquareIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Info Manual</ActionButton>
          </div>
        );
      case AppStep.SHOW_SIMULATION_RESULT:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { handleStartOverOrReset(false); setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD); addMessageToChat(CHAT_PROMPTS.chooseGroupSearchMethod, 'bot', <ListBulletIcon className="h-5 w-5"/>); }} icon={<PlusCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Nova Simulação</ActionButton>
            <ActionButton onClick={() => handleStartOverOrReset(true)} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar ao Início</ActionButton>
          </div>
        );
      case AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS:
         return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { setAmortizationDetails(null); setAmortizationStrategyForDetail(null); setAppStep(AppStep.SHOW_SIMULATION_RESULT); addMessageToChat(CHAT_PROMPTS.simulationResultActions, 'bot', <CalculatorIcon className="h-6 w-6 text-blue-500" />); }} variant="secondary" icon={<ArrowLeftCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar para Simulação</ActionButton>
            <ActionButton onClick={() => { handleStartOverOrReset(true); }} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Ir para Início</ActionButton>
          </div>
        );
      case AppStep.CHOOSE_GROUP_SEARCH_METHOD:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { addMessageToChat(CHAT_PROMPTS.askCreditValueForFilter, 'bot', <BanknotesIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_CREDIT_VALUE_FOR_FILTER); setActiveFilterCriteria({}); }} icon={<AdjustmentsHorizontalIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Buscar por Filtros</ActionButton>
            <ActionButton onClick={() => { addMessageToChat(CHAT_PROMPTS.askDesiredNetCreditForEmbutidoSearch, 'bot', <CurrencyDollarIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_DESIRED_NET_CREDIT_FOR_EMBUTIDO_SEARCH); setActiveFilterCriteria({}); }} icon={<CurrencyDollarIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Créd. Líquido c/ Embutido</ActionButton>
            {allGroupsData.length > 0 && <ActionButton onClick={() => { setActiveFilterCriteria({}); showDistinctPortoGroups({}); }} icon={<ListBulletIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Ver Todos Grupos</ActionButton>}
            <ActionButton onClick={() => { setActiveFilterCriteria({}); setAppStep(AppStep.ASK_MANUAL_GROUP_CREDIT); addMessageToChat(CHAT_PROMPTS.askManualGroupCredit, 'bot', <PencilSquareIcon className="h-5 w-5"/>); }} icon={<PencilSquareIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Informar Manualmente</ActionButton>
            <ActionButton onClick={() => handleStartOverOrReset(true)} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar ao Início</ActionButton>
          </div>
        );
      case AppStep.ASK_IF_ADD_MORE_FILTERS:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { addMessageToChat(CHAT_PROMPTS.chooseAdditionalFilterType, 'bot', <AdjustmentsHorizontalIcon className="h-5 w-5"/>); setAppStep(AppStep.CHOOSE_ADDITIONAL_FILTER_TYPE); }} icon={<PlusCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Sim, adicionar outro</ActionButton>
            <ActionButton onClick={() => showDistinctPortoGroups(activeFilterCriteria)} icon={<MagnifyingGlassIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Não, ver grupos</ActionButton>
            <ActionButton onClick={() => { setActiveFilterCriteria({}); addMessageToChat(CHAT_PROMPTS.chooseGroupSearchMethod, 'bot', <BanknotesIcon className="h-5 w-5"/>); setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD); }} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Refazer Filtros</ActionButton>
          </div>
        );
      case AppStep.CHOOSE_ADDITIONAL_FILTER_TYPE:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { addMessageToChat(CHAT_PROMPTS.askFilterInputPrazo, 'bot', <CalendarDaysIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_FILTER_INPUT_PRAZO); }} icon={<CalendarDaysIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled || activeFilterCriteria.prazo !== undefined}>Filtrar por Prazo</ActionButton>
            <ActionButton onClick={() => proceedToAskAdditionalFilters()} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar</ActionButton>
          </div>
        );
      case AppStep.ASK_OVERRIDE_REDUTOR:
        const groupRedutor = selectedGroup?.Redutor;
        let redutorDisplay = "Nenhum";
        if (typeof groupRedutor === 'number' && groupRedutor > 0) redutorDisplay = formatPercentage(groupRedutor);
        else if (groupRedutor === "CAMPANHA PARCELA ORIGINAL") redutorDisplay = "CAMPANHA PARCELA ORIGINAL";

        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            {redutorDisplay !== "Nenhum" ? (
              <>
                <ActionButton onClick={() => { setUserRedutorChoice('keep'); setCustomRedutorInput(''); addMessageToChat(CHAT_PROMPTS.askDilutionPeriod, 'bot', <ClockIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_DILUTION_PERIOD); }} icon={<CheckCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Manter ({redutorDisplay})</ActionButton>
                <ActionButton onClick={() => { setUserRedutorChoice('alter'); setManualFieldValue(''); addMessageToChat(CHAT_PROMPTS.askNewRedutorPercent, 'bot', <PencilSquareIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_NEW_REDUTOR_PERCENT); }} icon={<PencilSquareIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Alterar Redutor</ActionButton>
              </>
            ) : (
              <>
                <ActionButton onClick={() => { setUserRedutorChoice('add'); setManualFieldValue(''); addMessageToChat(CHAT_PROMPTS.askNewRedutorPercent, 'bot', <PencilSquareIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_NEW_REDUTOR_PERCENT); }} icon={<PlusCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Adicionar Redutor</ActionButton>
                <ActionButton onClick={() => { setUserRedutorChoice('no_add'); setCustomRedutorInput(''); addMessageToChat(CHAT_PROMPTS.askDilutionPeriod, 'bot', <ClockIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_DILUTION_PERIOD); }} icon={<ExclamationCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Seguir sem Redutor</ActionButton>
              </>
            )}
            <ActionButton onClick={() => setAppStep(selectedGroupNumberForDetailView ? AppStep.VIEW_GROUP_CREDIT_VALUES : AppStep.CHOOSE_GROUP_SEARCH_METHOD)} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar (Seleção Grupo)</ActionButton>
          </div>
        );
      case AppStep.ASK_DILUTION_PERIOD:
        const dilutionOptions = [
            { label: "Não Diluir", value: null },
            { label: "1 mês", value: 1 }, { label: "3 meses", value: 3 }, { label: "5 meses", value: 5 },
            { label: "12 meses", value: 12 }, { label: "24 meses", value: 24 },
        ];
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            {dilutionOptions.map(opt => (
              <ActionButton key={opt.label} onClick={() => { setInitialChosenDilutionPeriod(opt.value); addMessageToChat(`${contextPrefix}Período de diluição da Tx.Adm.Antec.: ${opt.label}. ${CHAT_PROMPTS.askLanceStrategy}`, 'bot', <PuzzlePieceIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_LANCE_STRATEGY); }} icon={<InformationCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>{opt.label}</ActionButton>
            ))}
            <ActionButton onClick={() => setAppStep(userRedutorChoice === 'alter' || userRedutorChoice === 'add' ? AppStep.ASK_NEW_REDUTOR_PERCENT : AppStep.ASK_OVERRIDE_REDUTOR)} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar (Redutor)</ActionButton>
          </div>
        );
      case AppStep.ASK_LANCE_STRATEGY:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            {selectedGroup?.LanceFixoPercent !== undefined && selectedGroup.LanceFixoPercent > 0 && (
              <ActionButton onClick={() => { setChosenLanceStrategy('fixo'); setUseEmbutidoForLivreBid(false); addMessageToChat(`${contextPrefix}Estratégia: Lance Fixo. ${CHAT_PROMPTS.askTipoContratacao}`, 'bot', <UserGroupIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_TIPO_CONTRATACAO); }} icon={<BanknotesIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Lance Fixo do Grupo ({formatPercentage(selectedGroup.LanceFixoPercent)})</ActionButton>
            )}
            <ActionButton onClick={() => { setChosenLanceStrategy('livre'); if (!selectedGroup?.LanceEmbutidoPercent || selectedGroup.LanceEmbutidoPercent <= 0) { setUseEmbutidoForLivreBid(false); addMessageToChat(`${contextPrefix}Estratégia: Lance Livre (Recurso Próprio). ${CHAT_PROMPTS.askTipoContratacao}`, 'bot', <UserGroupIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_TIPO_CONTRATACAO); } else { addMessageToChat(`${contextPrefix}Estratégia: Lance Livre. Usar lance embutido de ${formatPercentage(selectedGroup.LanceEmbutidoPercent)}?`, 'bot', <QuestionMarkCircleIcon className="h-5 w-5"/>); } }} icon={<ScaleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Lance Livre</ActionButton>
            {appStep === AppStep.ASK_LANCE_STRATEGY && chosenLanceStrategy === 'livre' && selectedGroup?.LanceEmbutidoPercent && selectedGroup.LanceEmbutidoPercent > 0 && useEmbutidoForLivreBid === null && (
              <div className="w-full flex flex-wrap gap-2 p-2 justify-center border-t mt-2 pt-2">
                <p className="w-full text-center text-sm text-gray-700 mb-1">Este grupo permite Lance Embutido de {formatPercentage(selectedGroup.LanceEmbutidoPercent)}. Deseja usá-lo com seu Lance Livre?</p>
                <ActionButton onClick={() => { setUseEmbutidoForLivreBid(true); addMessageToChat(`${contextPrefix}Lance Livre com Embutido. ${CHAT_PROMPTS.askTipoContratacao}`, 'bot', <UserGroupIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_TIPO_CONTRATACAO); }} variant="success" icon={<CheckCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Sim, usar Embutido</ActionButton>
                <ActionButton onClick={() => { setUseEmbutidoForLivreBid(false); addMessageToChat(`${contextPrefix}Lance Livre (Só Recurso Próprio). ${CHAT_PROMPTS.askTipoContratacao}`, 'bot', <UserGroupIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_TIPO_CONTRATACAO); }} variant="danger" icon={<ExclamationCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Não, só Recurso Próprio</ActionButton>
              </div>
            )}
            <ActionButton onClick={() => setAppStep(AppStep.ASK_DILUTION_PERIOD)} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar (Diluição)</ActionButton>
          </div>
        );
      case AppStep.ASK_TIPO_CONTRATACAO:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => { setSimulationParams(prev => ({ ...prev, tipoContratacao: 'fisica' })); addMessageToChat(`${contextPrefix}Tipo: Pessoa Física. ${CHAT_PROMPTS.askFGTSValue}`, 'bot', <BanknotesIcon className="h-5 w-5"/>); setAppStep(AppStep.ASK_FGTS_VALUE); }} icon={<UserCircleIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Pessoa Física (PF)</ActionButton>
            <ActionButton onClick={() => { setSimulationParams(prev => ({ ...prev, tipoContratacao: 'juridica', valorFGTS: 0 })); let nextPrompt = chosenLanceStrategy === 'fixo' ? CHAT_PROMPTS.askContemplationParcela.replace("{MAX_PRAZO}", String(effectivePrazoForPrompt)) : CHAT_PROMPTS.askLanceLivrePercentInput; addMessageToChat(`${contextPrefix}Tipo: Pessoa Jurídica. ${nextPrompt}`, 'bot', <BuildingLibraryIcon className="h-5 w-5"/>); setAppStep(chosenLanceStrategy === 'fixo' ? AppStep.ASK_CONTEMPLATION_PARCELA : AppStep.ASK_LANCE_LIVRE_PERCENT); }} icon={<BuildingLibraryIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Pessoa Jurídica (PJ)</ActionButton>
            <ActionButton onClick={() => { setAppStep(AppStep.ASK_LANCE_STRATEGY); setChosenLanceStrategy(null); setUseEmbutidoForLivreBid(null);}} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar (Estratégia Lance)</ActionButton>
          </div>
        );
      case AppStep.ASK_SHARE_METHOD:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => {
                if (sharingContext === 'single' && simulationResult) {
                    setAppStep(AppStep.ASK_WHATSAPP_SHARE_TYPE);
                    addMessageToChat(CHAT_PROMPTS.askWhatsAppShareType, 'bot', <PhoneIcon className="h-5 w-5"/>);
                } else {
                    setWhatsAppShareType('completo'); 
                    setAppStep(AppStep.ASK_WHATSAPP_NUMBER);
                    addMessageToChat(CHAT_PROMPTS.askWhatsAppNumber, 'bot', <PhoneIcon className="h-5 w-5"/>);
                }
            }} icon={<PhoneIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>WhatsApp</ActionButton>
            <ActionButton onClick={() => { setAppStep(AppStep.ASK_EMAIL_ADDRESS); addMessageToChat(CHAT_PROMPTS.askEmailAddress, 'bot', <EnvelopeIcon className="h-5 w-5"/>); }} icon={<EnvelopeIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>E-mail</ActionButton>
            <ActionButton onClick={() => {
                if (sharingContext === 'amortization') {
                    setAppStep(AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS);
                    addMessageToChat(CHAT_PROMPTS.showingAmortizationDetails.replace("{STRATEGY_NAME}", amortizationDetails?.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'Reduzir Prazo' : 'Reduzir Parcela'), 'bot', <DocumentChartBarIcon className="h-6 w-6 text-blue-500" />);
                } else if (sharingContext === 'merged') {
                    setAppStep(AppStep.SHOW_MERGED_SIMULATION_RESULT);
                    addMessageToChat(CHAT_PROMPTS.mergedSimulationReady, 'bot', <CheckCircleIcon className="h-6 w-6 text-green-500" />);
                } else {
                    setAppStep(AppStep.SHOW_SIMULATION_RESULT);
                    addMessageToChat(CHAT_PROMPTS.simulationResultActions, 'bot', <CalculatorIcon className="h-6 w-6 text-blue-500" />);
                }
                setSharingContext(null);
            }} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Cancelar</ActionButton>
          </div>
        );
       case AppStep.ASK_WHATSAPP_SHARE_TYPE:
        return (
          <div className="flex flex-wrap gap-2 p-2 justify-center">
            <ActionButton onClick={() => {
                setWhatsAppShareType('completo');
                setAppStep(AppStep.ASK_WHATSAPP_NUMBER);
                addMessageToChat(CHAT_PROMPTS.askWhatsAppNumber, 'bot', <PhoneIcon className="h-5 w-5"/>);
            }} icon={<Bars3BottomLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Resultado Completo</ActionButton>
            <ActionButton onClick={() => {
                setWhatsAppShareType('resumo');
                setAppStep(AppStep.ASK_WHATSAPP_NUMBER);
                addMessageToChat(CHAT_PROMPTS.askWhatsAppNumber, 'bot', <PhoneIcon className="h-5 w-5"/>);
            }} icon={<ChatBubbleBottomCenterTextIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Resumo</ActionButton>
            <ActionButton onClick={() => {
                 setAppStep(AppStep.ASK_SHARE_METHOD);
                 setSharingContext(sharingContext); 
                 addMessageToChat(CHAT_PROMPTS.askShareMethod, 'bot', <ShareIcon className="h-6 w-6 text-blue-500" />);
            }} variant="secondary" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>} disabled={commonContextActionsDisabled}>Voltar</ActionButton>
          </div>
        );
      default: return null;
    }
  };

  const renderDistinctGroupsList = () => {
    if (appStep !== AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION || distinctGroupsForDisplay.length === 0) return null;
    const totalPages = Math.ceil(distinctGroupsForDisplay.length / ITEMS_PER_PAGE);
    const paginatedGroups = distinctGroupsForDisplay.slice((currentDistinctGroupsPage - 1) * ITEMS_PER_PAGE, currentDistinctGroupsPage * ITEMS_PER_PAGE);

    return (
      <div className="p-3 bg-white shadow-lg rounded-lg my-4 border border-gray-200">
        <h3 className="text-md sm:text-lg font-semibold mb-3 text-blue-700">Grupos Disponíveis (Pág. {currentDistinctGroupsPage}/{totalPages})</h3>
        <div className="space-y-4">
          {paginatedGroups.map((group) => (
            <div key={group.nomeGrupo} className="p-3 border border-gray-200 rounded-md hover:shadow-lg transition-shadow cursor-pointer bg-gray-50 hover:bg-gray-100" onClick={() => showCreditValuesForPortoGroup(group.nomeGrupo)}>
              <h4 className="font-bold text-base text-blue-600 mb-2">{group.nomeGrupo}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 text-xs">
                <InfoItem label="Valor (R$)" value={`${formatCurrency(group.valorCreditoMin, false)} - ${formatCurrency(group.valorCreditoMax, false)}`} valueClassName="font-semibold"/>
                <InfoItem label="Parcela (R$)" value={`${group.parcelaReaisMin !== undefined ? formatCurrency(group.parcelaReaisMin, false) : 'N/A'} - ${group.parcelaReaisMax !== undefined ? formatCurrency(group.parcelaReaisMax, false) : 'N/A'}`} />
                <InfoItem label="Produto" value={group.produtoRepresentativo} />
                <InfoItem label="Tipo" value={group.tipoBemRepresentativo} />
                <InfoItem label="Prazo Orig." value={`${group.prazoOriginalMeses}m`} />
                <InfoItem label="Meses Rest." value={group.mesesRestantesRepresentativo ? `${group.mesesRestantesRepresentativo}m` : 'N/A'} />
                <InfoItem label="TX Adm" value={formatPercentage(group.taxaAdmTotal)} />
                <InfoItem label="TX Ant." value={formatPercentage(group.taxaAdmAntecipadaRepresentativa)} />
                <InfoItem label="F.R." value={formatPercentage(group.fundoReserva)} />
                <InfoItem label="Seguro" value={group.seguroRepresentativo ? formatPercentage(group.seguroRepresentativo, 3) : 'N/A'} />
                <InfoItem label="Redutor" value={group.redutorParcelaRepresentativo} />
                <InfoItem label="L. Embutido" value={formatPercentage(group.lanceEmbutido)} />
                <InfoItem label="L. Fixo" value={group.lanceFixoRepresentativo !== undefined ? formatPercentage(group.lanceFixoRepresentativo) : 'N/A'} />
                <InfoItem label="L. Mínimo" value={group.lanceMinimoRepresentativo} />
                <InfoItem label="Média Lances (6M)" value={group.mediaLance6MRepresentativo || 'N/A'} />
                <InfoItem label="Lances Contempl. (Últ. Mês)" value={group.lancesContempladosUltimoMesRepresentativo || 'N/A'} />
                <InfoItem label="Vagas Disp." value={group.vagasDisponiveisRepresentativa || 'N/A'} />
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex justify-between items-center">
            <ActionButton onClick={() => setCurrentDistinctGroupsPage(p => Math.max(1, p - 1))} disabled={currentDistinctGroupsPage === 1} icon={<ChevronLeftIcon className="h-5 w-5"/>}>Anterior</ActionButton>
            <span className="text-sm text-gray-700">Página {currentDistinctGroupsPage} de {totalPages}</span>
            <ActionButton onClick={() => setCurrentDistinctGroupsPage(p => Math.min(totalPages, p + 1))} disabled={currentDistinctGroupsPage === totalPages} icon={<ChevronRightIcon className="h-5 w-5"/>}>Próxima</ActionButton>
          </div>
        )}
        <ActionButton onClick={() => { setAppStep(AppStep.CHOOSE_GROUP_SEARCH_METHOD); addMessageToChat(CHAT_PROMPTS.chooseGroupSearchMethod, 'bot', <ListBulletIcon className="h-5 w-5"/>); setActiveFilterCriteria({});}} variant="secondary" className="w-full mt-4" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>}>Voltar para Tipos de Busca</ActionButton>
      </div>
    );
  };


  const renderCurrentGroupsList = () => {
    if (appStep !== AppStep.VIEW_GROUP_CREDIT_VALUES || currentGroups.length === 0 || !selectedGroupNumberForDetailView) return null;
    const totalPages = Math.ceil(currentGroups.length / ITEMS_PER_PAGE);
    const paginatedGroups = currentGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
      <div className="p-3 bg-white shadow-lg rounded-lg my-4 border border-gray-200">
        <h3 className="text-md sm:text-lg font-semibold mb-3 text-blue-700">Opções para Grupo: {selectedGroupNumberForDetailView} <span className="text-sm font-normal text-gray-500">(Pág. {currentPage}/{totalPages})</span></h3>
        <div className="space-y-3">
          {paginatedGroups.map((group) => (
            <div key={group.id} className="p-3 border border-gray-200 rounded-md hover:shadow-lg transition-shadow cursor-pointer bg-gray-50 hover:bg-gray-100" onClick={() => handleCreditValueSelection(group)}>
              <h4 className="font-bold text-base text-blue-600 mb-1">{group.Bem}</h4>
              <InfoItem label="Crédito" value={formatCurrency(group.ValorDoCredito)} valueClassName="font-semibold" />
              <InfoItem label="Parcela" value={group.ParcelaOriginalReais !== undefined ? formatCurrency(group.ParcelaOriginalReais) : "N/A (Calcular)"} />
              <InfoItem label="Prazo Grupo" value={`${group.PrazoOriginalMeses}m (Restantes: ${group.MesesRestantes || group.PrazoOriginalMeses}m)`} />
              <InfoItem label="Tx.Adm" value={formatPercentage(group.TaxaAdministracaoTotal)} />
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex justify-between items-center">
            <ActionButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} icon={<ChevronLeftIcon className="h-5 w-5"/>}>Anterior</ActionButton>
            <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
            <ActionButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} icon={<ChevronRightIcon className="h-5 w-5"/>}>Próxima</ActionButton>
          </div>
        )}
        <ActionButton onClick={() => { setAppStep(AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION); }} variant="secondary" className="w-full mt-4" icon={<ArrowUturnLeftIcon className="h-5 w-5"/>}>Voltar para Lista de Grupos</ActionButton>
      </div>
    );
  };

  
  const renderSimulationResultCard = () => {
    if (appStep !== AppStep.SHOW_SIMULATION_RESULT || !simulationResult) return null;
    const result = simulationResult;

    const renderPostContemplationOption = (outcome: PostContemplationOutcome, optionName: string, colorTheme: 'green' | 'indigo') => {
        let parcelaSubsequenteSemSeguro: number | undefined = undefined;
        let parcelaSubsequenteComSeguro: number | undefined = undefined;

        if (outcome.prazoRestantePosContemplacao > (outcome.numParcelasComAdesaoPosContemplacao || 0) && 
            outcome.adesaoPorParcelaDiluidaPosContemplacao && 
            outcome.parcelPostContemplacaoSemSeguroBeforeFloor !== undefined) {
            
            parcelaSubsequenteSemSeguro = (outcome.parcelPostContemplacaoSemSeguroBeforeFloor || 0) - (outcome.adesaoPorParcelaDiluidaPosContemplacao || 0);
            if(outcome.pisoParcelaReferenciaSemSeguro && parcelaSubsequenteSemSeguro < outcome.pisoParcelaReferenciaSemSeguro) {
                parcelaSubsequenteSemSeguro = outcome.pisoParcelaReferenciaSemSeguro;
            }
            parcelaSubsequenteSemSeguro = PortoConsortiumLogic.toDecimalPlaces(parcelaSubsequenteSemSeguro);

            if (result.tipoContratacao === 'fisica' && outcome.novoValorSeguroAposContemplacao !== undefined) {
                parcelaSubsequenteComSeguro = PortoConsortiumLogic.toDecimalPlaces(parcelaSubsequenteSemSeguro + (outcome.novoValorSeguroAposContemplacao || 0));
            }
        }

        return (
            <div className={`p-3 bg-${colorTheme}-50 rounded-md border border-${colorTheme}-200`}>
                <h5 className={`font-semibold text-${colorTheme}-700 mb-2`}>{optionName}</h5>
                <InfoItem label="Prazo Restante" value={`${outcome.prazoRestantePosContemplacao} parcelas`} info={outcome.wasParcelPostContemplationAdjustedByFloor && outcome.prazoRestanteOriginalAnteParcelFloorAdjustment !== outcome.prazoRestantePosContemplacao ? `(Original: ${outcome.prazoRestanteOriginalAnteParcelFloorAdjustment}m, ajustado pelo piso)` : undefined}/>
                {outcome.numParcelasComAdesaoPosContemplacao && outcome.numParcelasComAdesaoPosContemplacao > 0 && outcome.adesaoPorParcelaDiluidaPosContemplacao ? (
                   <>
                     <InfoItem label={`Parcela (s/seg, ${outcome.numParcelasComAdesaoPosContemplacao}x iniciais)`} value={formatCurrency(outcome.parcelaPosContemplacaoSemSeguro)} info={`Inclui ${formatCurrency(outcome.adesaoPorParcelaDiluidaPosContemplacao)} de TAA diluída` + (outcome.wasParcelPostContemplationAdjustedByFloor ? ' e ajustada pelo piso' : '')} />
                     {result.tipoContratacao === 'fisica' && outcome.parcelaPosContemplacaoComSeguro !== undefined && (
                        <InfoItem label={`Parcela (c/seg PF, ${outcome.numParcelasComAdesaoPosContemplacao}x iniciais)`} value={formatCurrency(outcome.parcelaPosContemplacaoComSeguro)} />
                     )}
                     {parcelaSubsequenteSemSeguro !== undefined && (
                        <>
                           <InfoItem label="Parcela (s/seg, subsequentes)" value={formatCurrency(parcelaSubsequenteSemSeguro)} />
                           {result.tipoContratacao === 'fisica' && parcelaSubsequenteComSeguro !== undefined && (
                             <InfoItem label="Parcela (c/seg PF, subsequentes)" value={formatCurrency(parcelaSubsequenteComSeguro)} />
                           )}
                        </>
                     )}
                   </>
                ): (
                    <>
                      <InfoItem label="Nova Parcela (s/seg)" value={formatCurrency(outcome.parcelaPosContemplacaoSemSeguro)} info={outcome.wasParcelPostContemplationAdjustedByFloor ? "(Ajustada pelo piso)" : undefined} />
                      {result.tipoContratacao === 'fisica' && outcome.parcelaPosContemplacaoComSeguro !== undefined && (
                        <InfoItem label="Nova Parcela (c/seg PF)" value={formatCurrency(outcome.parcelaPosContemplacaoComSeguro)} />
                      )}
                    </>
                )}
                 {result.tipoContratacao === 'fisica' && outcome.novoValorSeguroAposContemplacao && outcome.novoValorSeguroAposContemplacao > 0 && (
                    <InfoItem label="Novo Seguro (PF)" value={formatCurrency(outcome.novoValorSeguroAposContemplacao)} />
                )}
            </div>
        );
    };

    return (
      <div className="p-4 bg-white shadow-lg rounded-lg my-4 border border-gray-200">
        <h3 className="text-lg sm:text-xl font-semibold mb-3 text-blue-800 flex items-center">
          <CalculatorIcon className="h-6 w-6 mr-2 text-blue-600"/>
          {SIMULATION_TITLE_PREFIX}: {result.bem.toUpperCase()} - {result.nomeGrupo}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
            <InfoItem label="Crédito" value={formatCurrency(result.valorCreditoOriginal)} valueClassName="font-bold text-blue-700"/>
            <InfoItem label="Prazo Grupo" value={`${result.prazoOriginalGrupoMeses}m`} />
            <InfoItem label="Prazo Simulado" value={`${result.effectivePrazoSimulacao}m`} />
            <InfoItem label="Tipo Contratação" value={result.tipoContratacao === 'fisica' ? 'Pessoa Física (PF)' : 'Pessoa Jurídica (PJ)'} />
            <InfoItem label="Tx.Adm Total" value={result.taxaAdmTotalDisplay} />
            <InfoItem label="Tx.Adm Antecipada" value={result.taxaAdmAntecDisplay} info={result.isDilutionEffectivelyActive && result.effectiveChosenDilutionPeriodInMonths && result.effectiveChosenDilutionPeriodInMonths > 0 ? `${formatCurrency(result.totalDilutableAdhesionValue)} diluído em ${result.effectiveChosenDilutionPeriodInMonths}x de ${formatCurrency(result.adhesionInstallmentValueDuringDilution)}` : undefined}/>
            <InfoItem label="Fundo de Reserva" value={result.fundoReservaDisplay} />
            <InfoItem label="Redutor Aplicado" value={result.effectiveRedutorDisplay || 'Nenhum'} />
            {result.valorCreditoComRedutorAplicado !== undefined && result.valorCreditoComRedutorAplicado !== result.valorCreditoOriginal && (
                <InfoItem label="Crédito c/ Redutor" value={formatCurrency(result.valorCreditoComRedutorAplicado)} />
            )}
            <InfoItem label="Lance Embutido Grupo" value={result.lanceEmbutidoDisplay} />
            {result.lanceFixoDisplay && result.lanceFixoDisplay !== "N/A" && (
                <InfoItem label="Lance Fixo Grupo" value={result.lanceFixoDisplay} />
            )}
            {result.seguroVidaDisplay && result.seguroVidaDisplay !== "N/A" && result.tipoContratacao === 'fisica' && (
                <InfoItem label="Seguro Vida (PF)" value={result.seguroVidaDisplay} />
            )}
        </div>

        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Parcelas Iniciais Estimadas (Antes da Contemplação na {result.parcelaContemplacaoInput}ª)</h4>
        <div className="space-y-1 text-sm p-3 bg-gray-50 rounded-md border border-gray-200">
           {result.isDilutionEffectivelyActive && result.effectiveChosenDilutionPeriodInMonths && result.effectiveChosenDilutionPeriodInMonths > 0 && result.parcelValueDuringDilutionSemSeguro !== undefined ? (
                <>
                    <InfoItem label={`Primeiras ${result.effectiveChosenDilutionPeriodInMonths} parcelas (c/ redutor ${result.effectiveRedutorDisplay} e diluição TAA)`}>
                        <div className="ml-2">
                            <InfoItem label="Parcela (s/seg)" value={formatCurrency(result.parcelValueDuringDilutionSemSeguro)} />
                            {result.tipoContratacao === 'fisica' && result.parcelValueDuringDilutionComSeguro !== undefined && (
                                <InfoItem label="Parcela (c/seg PF)" value={formatCurrency(result.parcelValueDuringDilutionComSeguro)} />
                            )}
                            {result.parcelaBaseOriginalParaDiluicaoSemSeguro !== undefined && result.adhesionInstallmentValueDuringDilution > 0 && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)') && (
                                <InfoItem label="Base Reduzida (s/ TAA diluída)" value={formatCurrency(result.parcelaBaseOriginalParaDiluicaoSemSeguro)} info="Valor da parcela com redutor, antes de somar a TAA diluída."/>
                            )}
                        </div>
                    </InfoItem>
                    {result.effectiveChosenDilutionPeriodInMonths < (result.parcelaContemplacaoInput -1) && (
                         <InfoItem label="Parcelas subsequentes (após diluição, antes da contemplação)">
                             <div className="ml-2">
                                {result.parcelaOriginalReduzidaSemSeguro !== undefined && result.parcelaOriginalReduzidaSemSeguro !== result.parcelaOriginalNormalSemSeguro && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)') && result.effectiveRedutorDisplay !== "CAMPANHA PARCELA ORIGINAL" ? (
                                   <>
                                        <InfoItem label="Parcela Reduzida (s/seg)" value={formatCurrency(result.parcelaOriginalReduzidaSemSeguro)} />
                                        {result.tipoContratacao === 'fisica' && result.parcelaOriginalReduzidaComSeguro !== undefined && (
                                            <InfoItem label="Parcela Reduzida (c/seg PF)" value={formatCurrency(result.parcelaOriginalReduzidaComSeguro)} />
                                        )}
                                   </>
                                ) : (
                                    <>
                                        <InfoItem label="Parcela Normal (s/seg)" value={formatCurrency(result.parcelaOriginalNormalSemSeguro)} />
                                        {result.tipoContratacao === 'fisica' && result.parcelaOriginalNormalComSeguro !== undefined && (
                                            <InfoItem label="Parcela Normal (c/seg PF)" value={formatCurrency(result.parcelaOriginalNormalComSeguro)} />
                                        )}
                                    </>
                                )}
                             </div>
                         </InfoItem>
                    )}
                </>
            ) : (
                <>
                  {result.parcelaOriginalReduzidaSemSeguro !== undefined && (result.effectiveRedutorDisplay !== 'Nenhum' && result.effectiveRedutorDisplay !== 'Nenhum (0%)') && result.effectiveRedutorDisplay !== "CAMPANHA PARCELA ORIGINAL" && (
                    <>
                        <InfoItem label="Parcela Reduzida (s/seg)" value={formatCurrency(result.parcelaOriginalReduzidaSemSeguro)} />
                        {result.tipoContratacao === 'fisica' && result.parcelaOriginalReduzidaComSeguro !== undefined && (
                            <InfoItem label="Parcela Reduzida (c/seg PF)" value={formatCurrency(result.parcelaOriginalReduzidaComSeguro)} />
                        )}
                    </>
                  )}
                   <InfoItem label="Parcela Normal/Integral (s/seg)" value={formatCurrency(result.parcelaOriginalNormalSemSeguro)} />
                   {result.tipoContratacao === 'fisica' && result.parcelaOriginalNormalComSeguro !== undefined && (
                        <InfoItem label="Parcela Normal/Integral (c/seg PF)" value={formatCurrency(result.parcelaOriginalNormalComSeguro)} />
                   )}
                </>
            )}
        </div>

        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Lance Ofertado (Contemplação na {result.parcelaContemplacaoInput}ª)</h4>
        <div className="space-y-1 text-sm p-3 bg-gray-50 rounded-md border border-gray-200">
          {result.chosenLanceStrategy === 'fixo' && result.valorTotalLanceFixo ? (
            <InfoItem label="Estratégia" value={`Lance Fixo do Grupo (${formatPercentage(result.selectedGroupData?.LanceFixoPercent || 0)})`} info={`Valor: ${formatCurrency(result.valorTotalLanceFixo)}`} />
          ) : (
            <>
              <InfoItem label="Estratégia" value="Lance Livre" info={result.useGroupLanceEmbutidoForLivre && result.representatividadeLanceEmbutido > 0 ? `Utilizando Embutido de ${formatPercentage(result.selectedGroupData?.LanceEmbutidoPercent || 0)}: ${formatCurrency(result.representatividadeLanceEmbutido)}` : ''} />
              <InfoItem label="Lance Livre (Oferta Total)" value={`${formatPercentage(result.lanceLivrePercentualInput)} da Categoria`} info={`Valor: ${formatCurrency(result.valorLanceLivreCalculado)}`} />
            </>
          )}
          {result.tipoContratacao === 'fisica' && result.chosenLanceStrategy !== 'fixo' && (
            <InfoItem label="FGTS Utilizado" value={formatCurrency(result.valorFGTSInput)} />
          )}
           {(result.chosenLanceStrategy !== 'fixo' || (result.chosenLanceStrategy === 'fixo' && result.tipoContratacao === 'juridica') ) && (
                <InfoItem label="Recurso Próprio Total (Dinheiro)" value={formatCurrency(result.recursoProprioNecessario)} />
            )}

          <InfoItem label={result.chosenLanceStrategy === 'fixo' ? "Crédito Líquido Pós Lance Fixo" : (result.useGroupLanceEmbutidoForLivre && (result.selectedGroupData?.LanceEmbutidoPercent || 0) > 0 ? "Crédito Líquido (após Embutido)" : "Crédito Líquido Recebido")} value={formatCurrency(result.creditoLiquidoFinal)} valueClassName="font-bold text-green-600" />
        </div>

        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Pós-Contemplação (Estimativas)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {renderPostContemplationOption(result.reduzirParcelaOutcome, "Opção: Reduzir Parcela", "green")}
           {renderPostContemplationOption(result.reduzirPrazoOutcome, "Opção: Reduzir Prazo", "indigo")}
        </div>

        <div className="mt-6 space-x-0 space-y-2 sm:space-x-2 sm:space-y-0 flex flex-col sm:flex-row justify-center">
            <ActionButton onClick={() => handleShowAmortizationDetails('reduzir_parcela')} icon={<EyeIcon className="h-5 w-5"/>} variant="secondary" size="sm">Detalhar Amortização (Red. Parcela)</ActionButton>
            <ActionButton onClick={() => handleShowAmortizationDetails('reduzir_prazo')} icon={<EyeIcon className="h-5 w-5"/>} variant="secondary" size="sm">Detalhar Amortização (Red. Prazo)</ActionButton>
            <ActionButton onClick={() => handleInitiateShare('single')} icon={<ShareIcon className="h-5 w-5"/>} variant="primary" size="sm">Compartilhar Simulação</ActionButton>
             <ActionButton onClick={() => handleGeneratePdf('single')} icon={<PrinterIcon className="h-5 w-5"/>} variant="secondary" size="sm">Gerar PDF</ActionButton>
        </div>
        <p className="text-xs text-gray-500 mt-4">{SIMULATION_OBSERVATIONS}</p>
      </div>
    );
  };
  
  const renderAmortizationDetailsCard = () => {
    if (appStep !== AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS || !amortizationDetails) return null;
    const result = amortizationDetails;
    return (
      <div className="p-4 bg-white shadow-lg rounded-lg my-4 border border-gray-200">
        <h3 className="text-lg sm:text-xl font-semibold mb-3 text-blue-800">
            <DocumentChartBarIcon className="h-6 w-6 mr-2 inline-block text-blue-600"/>
            Detalhes do Cálculo de Amortização ({result.amortizacaoPreferidaConsiderada === 'reduzir_prazo' ? 'Reduzir Prazo' : 'Reduzir Parcela'})
        </h3>
        
        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Dados Base Utilizados:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm p-3 bg-gray-50 rounded-md border">
            <InfoItem label="Crédito Contratado" value={formatCurrency(result.dadosBase.creditoContratado)} />
            <InfoItem label="Taxa Adm. Total (Grupo)" value={formatPercentage(result.dadosBase.taxaAdmTotalPercent)} />
            <InfoItem label="Categoria Original do Plano" value={formatCurrency(result.dadosBase.creditoMaisTaxasOriginal)} info="Base de cálculo para parcelas e lances." />
            <InfoItem label="Prazo Simulado (Efetivo)" value={`${result.dadosBase.prazoInicial} meses`} />
            <InfoItem label="Parcela Integral (s/seg, ref. Q)" value={formatCurrency(result.dadosBase.parcelaIntegralCalculo)} />
            <InfoItem label="Nº Parcelas Pagas (até contemplação)" value={`${result.dadosBase.parcelasPagasContemplacao}`} />
            <InfoItem label="Valor Total do Lance Ofertado" value={formatCurrency(result.dadosBase.lanceOfertadoTotalOriginal)} info="Valor total do lance da simulação."/>
            <InfoItem label="Recursos do Cliente (Lance Bruto)" value={formatCurrency(result.dadosBase.recursosDoClienteParaLanceBruto)} info="Rec. Próprio + FGTS (se PF)."/>
             {result.dadosBase.valorDeixadoDeSerPagoCalculado && result.dadosBase.valorDeixadoDeSerPagoCalculado > 0 && (
                <InfoItem label="Valor Descontado por Redutor (VDSP)" value={formatCurrency(result.dadosBase.valorDeixadoDeSerPagoCalculado)} />
             )}
            <InfoItem label="Lance Líquido para Amortização" value={formatCurrency(result.dadosBase.lanceLiquidoUsadoParaAmortizacao)} info="Lance Total Ofertado menos VDSP (se houver)." valueClassName="font-semibold text-green-600"/>
        </div>

        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Passos do Cálculo:</h4>
        <div className="space-y-3 text-sm">
            {result.steps.map((step, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                    <h5 className="font-semibold text-blue-600 mb-1">{step.stepNumber === 0 || step.stepNumber === 0.1 ? step.title : `Passo ${result.steps.filter(s => s.stepNumber > 0).findIndex(s => s.stepNumber === step.stepNumber) + 1}: ${step.title}`}</h5>
                    <InfoItem label="Fórmula" value={step.formula} valueClassName="italic text-gray-600"/>
                    <InfoItem label="Cálculo" value={step.calculation} />
                    <InfoItem label="Resultado" value={step.result} valueClassName="font-medium"/>
                    {step.explanation && <InfoItem label="Explicação" value={step.explanation} />}
                </div>
            ))}
        </div>
        
        <h4 className="text-md font-semibold mt-4 mb-2 text-blue-700">Conferência Final:</h4>
        <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-sm">
           <p>{result.conferencia.comment}</p>
        </div>

        <div className="mt-6 flex justify-center space-x-2">
             <ActionButton onClick={() => handleInitiateShare('amortization')} icon={<ShareIcon className="h-5 w-5"/>} variant="primary" size="sm">Compartilhar Detalhamento</ActionButton>
             <ActionButton onClick={() => handleGeneratePdf('amortization')} icon={<PrinterIcon className="h-5 w-5"/>} variant="secondary" size="sm">Gerar PDF</ActionButton>
        </div>
      </div>
    );
  };

  const renderMergedSimulationCard = () => {
    if (appStep !== AppStep.SHOW_MERGED_SIMULATION_RESULT || !finalMergedResult) return null;
    const result = finalMergedResult;
    return (
        <div className="p-4 bg-white shadow-lg rounded-lg my-4 border border-gray-200">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-purple-800 flex items-center">
                <ArrowsRightLeftIcon className="h-6 w-6 mr-2 text-purple-600"/>
                Junção de {result.numberOfQuotas} Cotas Porto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4 p-3 bg-purple-50 rounded-md border border-purple-200">
                <InfoItem label="Crédito Total Original" value={formatCurrency(result.totalCreditoOriginal)} valueClassName="font-bold text-purple-700"/>
                <InfoItem label="Recurso Próprio Total (Lances)" value={formatCurrency(result.totalRecursoProprioNecessario)} />
                {result.totalParcelaOriginalConsolidadaSemSeguro === result.totalParcelaOriginalConsolidadaSemSeguro ? (
                    <InfoItem label="Parcela Inicial Consolidada (s/seg)" value={formatCurrency(result.totalParcelaOriginalConsolidadaSemSeguro)} />
                ) : (
                    <InfoItem label="Parcela Inicial Consolidada (s/seg)" value={`${formatCurrency(result.totalParcelaOriginalConsolidadaSemSeguro)} a ${formatCurrency(result.totalParcelaOriginalConsolidadaSemSeguro)}`} info="Varia conforme diluição individual"/>
                )}
                {result.totalParcelaOriginalConsolidadaComSeguro !== undefined && (
                     <InfoItem label="Parcela Inicial Consolidada (c/seg PF)" value={formatCurrency(result.totalParcelaOriginalConsolidadaComSeguro)} info="Considera seguro para cotas PF"/>
                )}
                 <InfoItem label="Parcela Pós-Cont. Consolidada (s/seg, Red. Parcela)" value={formatCurrency(result.totalParcelaPosContemplacaoConsolidadaSemSeguroReduzirParcela)} info="Valor inicial, pode variar com TAA e piso."/>
                {result.totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela !== undefined && (
                    <InfoItem label="Parcela Pós-Cont. Consolidada (c/seg PF, Red. Parcela)" value={formatCurrency(result.totalParcelaPosContemplacaoConsolidadaComSeguroReduzirParcela)} />
                )}
                <InfoItem label="Prazo Médio Restante (Red. Parcela)" value={`${result.mediaPrazoRestantePosContemplacaoReduzirParcela.toFixed(0)} parcelas`} />
                <InfoItem label="Total Tx.Adm.Antec. Diluível" value={formatCurrency(result.totalDilutableAdhesionValueSum)} />
            </div>
            <h4 className="text-md font-semibold mt-4 mb-2 text-purple-700">Detalhes Individuais das Cotas:</h4>
            <div className="space-y-2 text-xs">
                {result.individualSimulations.map((sim, index) => (
                    <div key={sim.selectedGroupData.id} className="p-2 bg-gray-50 border border-gray-200 rounded">
                        <InfoItem label={`Cota ${index + 1}`} value={`${sim.nomeGrupo} - ${sim.bem}`} valueClassName="font-medium"/>
                        <InfoItem label="Crédito" value={formatCurrency(sim.valorCreditoOriginal)} />
                        <InfoItem label="Rec. Próprio" value={formatCurrency(sim.recursoProprioNecessario + (sim.tipoContratacao === 'fisica' ? sim.valorFGTSInput : 0))} />
                        <InfoItem label="Parc. Pós (s/seg, Red.Parc)" value={formatCurrency(sim.reduzirParcelaOutcome.parcelaPosContemplacaoSemSeguro)} />
                    </div>
                ))}
            </div>
             <div className="mt-6 flex justify-center space-x-2">
                <ActionButton onClick={() => handleInitiateShare('merged')} icon={<ShareIcon className="h-5 w-5"/>} variant="primary" size="sm">Compartilhar Junção</ActionButton>
                <ActionButton onClick={() => handleGeneratePdf('merged')} icon={<PrinterIcon className="h-5 w-5"/>} variant="secondary" size="sm">Gerar PDF da Junção</ActionButton>
            </div>
            <p className="text-xs text-gray-500 mt-4">{MERGED_SIMULATION_DISCLAIMER}</p>
            <p className="text-xs text-gray-500 mt-1">{SIMULATION_OBSERVATIONS}</p>
        </div>
    );
  };
  

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-white shadow-xl">
      <header className="bg-blue-600 text-white p-4 text-center">
        <h1 className="text-xl font-semibold">Especialista Consórcio Porto</h1>
      </header>
      <div ref={contentAreaRef} className="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                msg.type === 'user' ? 'bg-blue-500 text-white' : 
                msg.type === 'bot' ? 'bg-white text-gray-800 border border-gray-200' : 
                'bg-red-100 text-red-700 border border-red-300'
            }`}>
              <div className="flex items-center">
                {msg.icon && <span className="mr-2">{React.cloneElement(msg.icon as React.ReactElement<{ className?: string }>, { className: "h-5 w-5" })}</span>}
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {appStep === AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION && renderDistinctGroupsList()}
        {appStep === AppStep.VIEW_GROUP_CREDIT_VALUES && renderCurrentGroupsList()}
        {appStep === AppStep.SHOW_SIMULATION_RESULT && renderSimulationResultCard()}
        {appStep === AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS && renderAmortizationDetailsCard()}
        {appStep === AppStep.SHOW_MERGED_SIMULATION_RESULT && renderMergedSimulationCard()}
      </div>
      
      <div className="p-2 border-t border-gray-200 bg-white">
        {renderActionButtons()}
        {(appStep.toString().startsWith("ASK_MANUAL_GROUP") || appStep === AppStep.ASK_NEW_REDUTOR_PERCENT) && (
             <form onSubmit={(e) => { e.preventDefault(); handleManualStepSubmit(); }} className="flex gap-2">
                 <input
                    type="text"
                    value={manualFieldValue}
                    onChange={(e) => setManualFieldValue(e.target.value)}
                    placeholder="Digite o valor..."
                    className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                 />
                 <ActionButton type="submit" disabled={isLoading} icon={<PaperAirplaneIcon className="h-5 w-5"/>}>Enviar</ActionButton>
             </form>
        )}
        {![
            AppStep.VIEW_DISTINCT_GROUPS_FOR_SELECTION, 
            AppStep.VIEW_GROUP_CREDIT_VALUES, 
            AppStep.SHOW_SIMULATION_RESULT, 
            AppStep.SHOW_AMORTIZATION_CALCULATION_DETAILS,
            AppStep.SHOW_MERGED_SIMULATION_RESULT,
            AppStep.CHOOSE_GROUP_SEARCH_METHOD,
            AppStep.ASK_IF_ADD_MORE_FILTERS,
            AppStep.CHOOSE_ADDITIONAL_FILTER_TYPE,
            AppStep.ASK_OVERRIDE_REDUTOR,
            AppStep.ASK_DILUTION_PERIOD,
            AppStep.ASK_LANCE_STRATEGY,
            AppStep.ASK_TIPO_CONTRATACAO,
            AppStep.ASK_SHARE_METHOD,
            AppStep.ASK_WHATSAPP_SHARE_TYPE,
          ].includes(appStep) && !appStep.toString().startsWith("ASK_MANUAL_GROUP") && appStep !== AppStep.ASK_NEW_REDUTOR_PERCENT &&  (
          <form onSubmit={(e) => { e.preventDefault(); handleUserInput(); }} className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={isLoading || isDataLoading ? "Aguarde..." : "Digite sua mensagem ou filtro..."}
              className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading || isDataLoading}
            />
            <ActionButton type="submit" disabled={isLoading || isDataLoading || !userInput.trim()} icon={<PaperAirplaneIcon className="h-5 w-5"/>}>Enviar</ActionButton>
          </form>
        )}
      </div>
    </div>
  );
};

export default App;
