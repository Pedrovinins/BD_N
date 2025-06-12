
import { 
    PortoGroupData, PortoSimulationParams, PortoSimulationResult, TipoContratacao, 
    formatPercentage, CreditFilterValue, PrazoFilterValue, FilterCriteria, 
    AmortizacaoPreferida, UserRedutorOverride, AmortizationCalculationResult, AmortizationStepDetail,
    formatCurrency, PostContemplationOutcome, AmortizationCalculationData
} from '../types';

const safeParseFloat = (value: any, defaultValue = 0): number => {
    if (value === null || value === undefined || String(value).trim() === "") return defaultValue;
    const s = String(value).replace(',', '.');
    const num = parseFloat(s);
    return isNaN(num) ? defaultValue : num;
};

export const toDecimalPlaces = (num: number, places: number = 2): number => {
    if (isNaN(num) || !isFinite(num)) return 0;
    const factor = Math.pow(10, places);
    return Math.round(num * factor) / factor;
};

const calcularTaxaAdministrativaDiluidaPercentDisplay = ( 
    taxaAdministrativaTotalPercent: number,
    taxaAdministrativaAntecipadaPercent: number
): number => {
    return toDecimalPlaces(taxaAdministrativaTotalPercent - taxaAdministrativaAntecipadaPercent);
};

const calcularCategoria = (
    valorCredito: number,
    taxaAdminTotalPercent: number,
    fundoReservaPercent: number
): number => {
    const taxaAdminTotalDecimal = taxaAdminTotalPercent / 100;
    const fundoReservaDecimal = fundoReservaPercent / 100;
    const categoria = valorCredito * (1 + taxaAdminTotalDecimal + fundoReservaDecimal);
    return toDecimalPlaces(categoria);
};


const calcularValorSeguro = (
    baseDeCalculoSeguro: number, 
    seguroVidaApolicePercent: number | undefined, 
    tipoContratacao: TipoContratacao
): number => {
    if (!seguroVidaApolicePercent || tipoContratacao === "juridica" || baseDeCalculoSeguro <=0) {
        return 0.00;
    }
    const taxaSeguroDecimal = seguroVidaApolicePercent / 100; 
    return toDecimalPlaces(baseDeCalculoSeguro * taxaSeguroDecimal);
};


const calcularRepresentatividadeLanceEmbutidoDoGrupo = ( 
    valorCredito: number,
    lanceEmbutidoPercentDoGrupo: number 
): number => {
    return toDecimalPlaces(valorCredito * (lanceEmbutidoPercentDoGrupo / 100));
};

const calcularValorTotalLanceFixo = (
    categoria: number, 
    lanceFixoPercent: number | undefined
): number => {
    if (lanceFixoPercent === undefined || lanceFixoPercent <= 0) return 0;
    return toDecimalPlaces(categoria * (lanceFixoPercent / 100));
};

const calcularParcelaPuraPJ = (
    categoria: number, 
    prazoEfetivo: number
): number => {
    if (prazoEfetivo === 0) return 0;
    return toDecimalPlaces(categoria / prazoEfetivo);
};

const calcularParcelaOriginalReduzidaPJ = (
    categoria: number, 
    prazoEfetivo: number,
    effectiveRedutorValue: number | "CAMPANHA PARCELA ORIGINAL" 
): number | undefined => {
    if (prazoEfetivo === 0 && categoria > 0) return undefined;

    if (effectiveRedutorValue === "CAMPANHA PARCELA ORIGINAL") {
        return undefined; 
    }
    
    if (typeof effectiveRedutorValue === 'number' && effectiveRedutorValue > 0) {
        if (prazoEfetivo > 0 && categoria > 0) {
            const parcelaPura = categoria / prazoEfetivo;
            return toDecimalPlaces(parcelaPura * (1 - (effectiveRedutorValue / 100)));
        }
        return undefined;
    }
    
    return undefined; 
};


const calculatePostContemplationForStrategy = (
    amortizacaoPreferida: AmortizacaoPreferida,
    saldoDevedorParaCalculoAmortizacao: number,
    parcelaIntegralReferenciaSemRedutor: number, // Parcela base (categoria/prazo) sem redutor e sem TAA diluída
    effectivePrazoSimulacao: number, // Prazo efetivo da simulação
    parcelaContemplacao: number, // Parcela da contemplação
    isDilutionEffectivelyActive: boolean,
    effectiveChosenDilutionPeriodInMonths: number | null,
    adhesionInstallmentValueDuringDilution: number, // Valor da TAA diluído por parcela
    pisoParcelaReferenciaSemSeguro: number, // 50% da parcelaIntegralReferenciaSemRedutor
    tipoContratacao: TipoContratacao,
    seguroVidaApolicePercent: number | undefined
): PostContemplationOutcome => {

    let initialPrazoRestantePosContemplacao: number;
    let initialParcelaPosContemplacaoSemSeguro: number; // Parcela principal, sem TAA diluída e sem seguro

    if (amortizacaoPreferida === 'reduzir_prazo') {
        initialParcelaPosContemplacaoSemSeguro = parcelaIntegralReferenciaSemRedutor; 
        if (initialParcelaPosContemplacaoSemSeguro > 0 && saldoDevedorParaCalculoAmortizacao > 0) {
             initialPrazoRestantePosContemplacao = Math.ceil(toDecimalPlaces(saldoDevedorParaCalculoAmortizacao / initialParcelaPosContemplacaoSemSeguro, 6));
        } else if (saldoDevedorParaCalculoAmortizacao <= 0) {
             initialPrazoRestantePosContemplacao = 0;
        } else { 
             initialPrazoRestantePosContemplacao = effectivePrazoSimulacao - Math.max(0,(parcelaContemplacao -1)); 
        }
    } else { // Reduzir Parcela
        initialPrazoRestantePosContemplacao = effectivePrazoSimulacao - parcelaContemplacao; 
        if (saldoDevedorParaCalculoAmortizacao > 0 && initialPrazoRestantePosContemplacao <= 0) {
            initialPrazoRestantePosContemplacao = 1; 
        } else {
            initialPrazoRestantePosContemplacao = Math.max(0, initialPrazoRestantePosContemplacao);
        }
        
        if (initialPrazoRestantePosContemplacao > 0) {
            initialParcelaPosContemplacaoSemSeguro = toDecimalPlaces(saldoDevedorParaCalculoAmortizacao / initialPrazoRestantePosContemplacao);
        } else {
            initialParcelaPosContemplacaoSemSeguro = (saldoDevedorParaCalculoAmortizacao > 0) ? saldoDevedorParaCalculoAmortizacao : 0; 
        }
    }
    initialPrazoRestantePosContemplacao = Math.max(0, initialPrazoRestantePosContemplacao);

    let parcelaPosContemplacaoSemSeguroComAdesao = initialParcelaPosContemplacaoSemSeguro;
    let numParcelasComAdesaoPosContemplacao: number | undefined = 0;
    let adesaoPorParcelaDiluidaPosContemplacao: number | undefined = 0;

    if (isDilutionEffectivelyActive && effectiveChosenDilutionPeriodInMonths && effectiveChosenDilutionPeriodInMonths > 0 && adhesionInstallmentValueDuringDilution > 0) {
        const parcelasDeDiluicaoConsumidas = Math.min(effectiveChosenDilutionPeriodInMonths, Math.max(0, parcelaContemplacao -1) ); 
        const parcelasDeDiluicaoRestantesAposContemplar = Math.max(0, effectiveChosenDilutionPeriodInMonths - parcelasDeDiluicaoConsumidas);
        
        if (parcelasDeDiluicaoRestantesAposContemplar > 0) {
            numParcelasComAdesaoPosContemplacao = Math.min(parcelasDeDiluicaoRestantesAposContemplar, initialPrazoRestantePosContemplacao);
            adesaoPorParcelaDiluidaPosContemplacao = adhesionInstallmentValueDuringDilution;
            if (numParcelasComAdesaoPosContemplacao > 0) {
                parcelaPosContemplacaoSemSeguroComAdesao = toDecimalPlaces(initialParcelaPosContemplacaoSemSeguro + adesaoPorParcelaDiluidaPosContemplacao);
            }
        }
    }

    let finalParcelaPosContemplacaoSemSeguro = parcelaPosContemplacaoSemSeguroComAdesao;
    let finalPrazoRestantePosContemplacao = initialPrazoRestantePosContemplacao;
    let wasParcelPostContemplationAdjustedByFloor = false;
    const parcelPostContemplacaoSemSeguroBeforeFloor = parcelaPosContemplacaoSemSeguroComAdesao; 
    const prazoRestanteOriginalAnteParcelFloorAdjustment = initialPrazoRestantePosContemplacao;

    if (finalParcelaPosContemplacaoSemSeguro < pisoParcelaReferenciaSemSeguro && finalPrazoRestantePosContemplacao > 0) {
        finalParcelaPosContemplacaoSemSeguro = pisoParcelaReferenciaSemSeguro;
        wasParcelPostContemplationAdjustedByFloor = true;

        if (amortizacaoPreferida === 'reduzir_parcela') {
            // Se a parcela com adesão bateu no piso, a parcela principal (sem adesão) deve ser recalculada para o novo prazo.
            let parcelaPrincipalNoPiso = finalParcelaPosContemplacaoSemSeguro;
            if (numParcelasComAdesaoPosContemplacao && numParcelasComAdesaoPosContemplacao > 0 && adesaoPorParcelaDiluidaPosContemplacao) {
                 parcelaPrincipalNoPiso = Math.max(0, finalParcelaPosContemplacaoSemSeguro - adesaoPorParcelaDiluidaPosContemplacao);
            }
            
            if (parcelaPrincipalNoPiso > 0 && saldoDevedorParaCalculoAmortizacao > 0) {
                finalPrazoRestantePosContemplacao = Math.ceil(toDecimalPlaces(saldoDevedorParaCalculoAmortizacao / parcelaPrincipalNoPiso, 6));
            } else if (saldoDevedorParaCalculoAmortizacao <=0) {
                 finalPrazoRestantePosContemplacao = 0;
            }
            
            // Reajustar numParcelasComAdesao com o novo prazo
            if (numParcelasComAdesaoPosContemplacao && numParcelasComAdesaoPosContemplacao > 0 && adesaoPorParcelaDiluidaPosContemplacao) {
                const parcelasDeDiluicaoConsumidas = Math.min(effectiveChosenDilutionPeriodInMonths || 0, Math.max(0, parcelaContemplacao -1) );
                const parcelasDeDiluicaoRestantesAposContemplar = Math.max(0, (effectiveChosenDilutionPeriodInMonths || 0) - parcelasDeDiluicaoConsumidas);
                numParcelasComAdesaoPosContemplacao = Math.min(parcelasDeDiluicaoRestantesAposContemplar, finalPrazoRestantePosContemplacao);
                if(numParcelasComAdesaoPosContemplacao === 0) adesaoPorParcelaDiluidaPosContemplacao = 0;
            }
        }
    }
    
    finalPrazoRestantePosContemplacao = Math.max(0, finalPrazoRestantePosContemplacao);
    if (finalPrazoRestantePosContemplacao === 0 && saldoDevedorParaCalculoAmortizacao > 0) {
        finalParcelaPosContemplacaoSemSeguro = saldoDevedorParaCalculoAmortizacao; 
        finalPrazoRestantePosContemplacao = 1;
    }
     if (finalPrazoRestantePosContemplacao > 0 && finalParcelaPosContemplacaoSemSeguro <= 0 && saldoDevedorParaCalculoAmortizacao > 0){
        finalParcelaPosContemplacaoSemSeguro = toDecimalPlaces(saldoDevedorParaCalculoAmortizacao/finalPrazoRestantePosContemplacao);
         if (finalParcelaPosContemplacaoSemSeguro < pisoParcelaReferenciaSemSeguro && finalPrazoRestantePosContemplacao > 0) { 
            finalParcelaPosContemplacaoSemSeguro = pisoParcelaReferenciaSemSeguro;
            wasParcelPostContemplationAdjustedByFloor = true;
         }
    }


    let novoValorSeguroAposContemplacao: number | undefined;
    let finalParcelaPosContemplacaoComSeguro: number | undefined;

    if (tipoContratacao === "fisica" && seguroVidaApolicePercent !== undefined && seguroVidaApolicePercent > 0) {
        // O seguro pós-contemplação incide sobre o saldo devedor remanescente
        novoValorSeguroAposContemplacao = calcularValorSeguro(saldoDevedorParaCalculoAmortizacao, seguroVidaApolicePercent, tipoContratacao);
        finalParcelaPosContemplacaoComSeguro = toDecimalPlaces(finalParcelaPosContemplacaoSemSeguro + novoValorSeguroAposContemplacao);
    }

    return {
        parcelaPosContemplacaoSemSeguro: finalParcelaPosContemplacaoSemSeguro,
        parcelaPosContemplacaoComSeguro: finalParcelaPosContemplacaoComSeguro,
        prazoRestantePosContemplacao: finalPrazoRestantePosContemplacao,
        novoValorSeguroAposContemplacao,
        adesaoPorParcelaDiluidaPosContemplacao,
        numParcelasComAdesaoPosContemplacao,
        wasParcelPostContemplationAdjustedByFloor,
        parcelPostContemplacaoSemSeguroBeforeFloor,
        prazoRestanteOriginalAnteParcelFloorAdjustment,
        pisoParcelaReferenciaSemSeguro,
    };
};


export const calculatePortoSimulationDetails = (params: PortoSimulationParams): PortoSimulationResult => {
    const { 
        selectedGroupData: g, 
        tipoContratacao, 
        valorFGTS,
        parcelaContemplacao, 
        chosenLanceStrategy,
        useGroupLanceEmbutidoForLivre,
        userRedutorOverride, 
        initialChosenDilutionPeriodInMonths 
    } = params;

    const valorCredito = g.ValorDoCredito;
    const effectivePrazoSimulacao = (g.MesesRestantes !== undefined && g.MesesRestantes > 0 && g.MesesRestantes <= g.PrazoOriginalMeses) 
                               ? g.MesesRestantes 
                               : g.PrazoOriginalMeses;

    let effectiveRedutorValue: UserRedutorOverride | number | "CAMPANHA PARCELA ORIGINAL";
    if (userRedutorOverride === null) { 
        effectiveRedutorValue = 0;
    } else if (userRedutorOverride !== undefined) {
        effectiveRedutorValue = userRedutorOverride;
    } else {
        effectiveRedutorValue = g.Redutor; 
    }

    let effectiveRedutorDisplay = "Nenhum";
    let numericEffectiveRedutorPercent = 0;

    if (effectiveRedutorValue === "CAMPANHA PARCELA ORIGINAL") {
        effectiveRedutorDisplay = "CAMPANHA PARCELA ORIGINAL";
    } else if (typeof effectiveRedutorValue === 'number' && effectiveRedutorValue > 0) {
        effectiveRedutorDisplay = formatPercentage(effectiveRedutorValue);
        numericEffectiveRedutorPercent = effectiveRedutorValue;
    } else if (typeof effectiveRedutorValue === 'number' && effectiveRedutorValue === 0) {
        effectiveRedutorDisplay = "Nenhum (0%)";
        numericEffectiveRedutorPercent = 0;
    }

    const valorCreditoComRedutorAplicado = valorCredito * (1 - (numericEffectiveRedutorPercent / 100));
    
    const taxaAdmTotalOriginalPercent = g.TaxaAdministracaoTotal;
    const taxaAdmAntecipadaOriginalPercent = g.TaxaAdministracaoAntecipada;
    const fundoReservaOriginalPercent = g.FundoDeReserva;

    const totalDilutableAdhesionValue = toDecimalPlaces(valorCredito * (taxaAdmAntecipadaOriginalPercent / 100));

    const categoriaFull = calcularCategoria(
        valorCredito,
        taxaAdmTotalOriginalPercent,
        fundoReservaOriginalPercent
    );
    const parcelaIntegralReferenciaSemRedutor = calcularParcelaPuraPJ(categoriaFull, effectivePrazoSimulacao);
    const pisoParcelaReferenciaSemSeguro = toDecimalPlaces(0.5 * parcelaIntegralReferenciaSemRedutor);

    let isDilutionEffectivelyActive = false;
    let effectiveChosenDilutionPeriodInMonths: number | null = null;
    let adhesionInstallmentValueDuringDilution = 0;
    let parcelValueDuringDilutionSemSeguro: number | undefined = undefined;
    let parcelValueDuringDilutionComSeguro: number | undefined = undefined;
    let parcelaBaseOriginalParaDiluicaoSemSeguro: number | undefined = undefined;


    if (initialChosenDilutionPeriodInMonths !== null && initialChosenDilutionPeriodInMonths > 0 && totalDilutableAdhesionValue > 0) {
        effectiveChosenDilutionPeriodInMonths = initialChosenDilutionPeriodInMonths; 
        
        const taxaAdmParaParcelaBaseDiluicaoPercent = Math.max(0, taxaAdmTotalOriginalPercent - taxaAdmAntecipadaOriginalPercent);
        const categoriaParaParcelaBaseDiluicao = calcularCategoria(valorCredito, taxaAdmParaParcelaBaseDiluicaoPercent, fundoReservaOriginalPercent);
        
        const parcelaPuraBaseSemRedutorParaDiluicao = calcularParcelaPuraPJ(categoriaParaParcelaBaseDiluicao, effectivePrazoSimulacao);
        
        let tempParcelaBaseComRedutorParaDiluicao: number | undefined;
        if (effectiveRedutorValue === "CAMPANHA PARCELA ORIGINAL") { // Assume full parcel if "campanha" and TAA is being diluted
            tempParcelaBaseComRedutorParaDiluicao = parcelaPuraBaseSemRedutorParaDiluicao;
        } else if (typeof effectiveRedutorValue === 'number' && effectiveRedutorValue > 0) {
            tempParcelaBaseComRedutorParaDiluicao = toDecimalPlaces(parcelaPuraBaseSemRedutorParaDiluicao * (1 - (effectiveRedutorValue / 100)));
        } else { // No redutor or Redutor is 0%
            tempParcelaBaseComRedutorParaDiluicao = parcelaPuraBaseSemRedutorParaDiluicao;
        }
        parcelaBaseOriginalParaDiluicaoSemSeguro = tempParcelaBaseComRedutorParaDiluicao;

        adhesionInstallmentValueDuringDilution = toDecimalPlaces(totalDilutableAdhesionValue / effectiveChosenDilutionPeriodInMonths);
        
        if (adhesionInstallmentValueDuringDilution > 0) {
            parcelValueDuringDilutionSemSeguro = toDecimalPlaces(parcelaBaseOriginalParaDiluicaoSemSeguro + adhesionInstallmentValueDuringDilution);
            isDilutionEffectivelyActive = true;

            if (tipoContratacao === "fisica" && g.SeguroVidaApolicePercent !== undefined && g.SeguroVidaApolicePercent > 0 && parcelValueDuringDilutionSemSeguro !== undefined) {
                const valorSeguroParaDiluicao = calcularValorSeguro(categoriaFull, g.SeguroVidaApolicePercent, tipoContratacao); // Seguro sobre categoria cheia
                parcelValueDuringDilutionComSeguro = toDecimalPlaces(parcelValueDuringDilutionSemSeguro + valorSeguroParaDiluicao);
            }
        } else {
            isDilutionEffectivelyActive = false; 
            parcelValueDuringDilutionSemSeguro = parcelaBaseOriginalParaDiluicaoSemSeguro; 
            if (tipoContratacao === "fisica" && g.SeguroVidaApolicePercent !== undefined && g.SeguroVidaApolicePercent > 0 && parcelValueDuringDilutionSemSeguro !== undefined) {
                 const valorSeguroParaDiluicao = calcularValorSeguro(categoriaFull, g.SeguroVidaApolicePercent, tipoContratacao);
                 parcelValueDuringDilutionComSeguro = toDecimalPlaces(parcelValueDuringDilutionSemSeguro + valorSeguroParaDiluicao);
            }
        }

    } else { 
        isDilutionEffectivelyActive = false;
        effectiveChosenDilutionPeriodInMonths = null;
        adhesionInstallmentValueDuringDilution = 0;
    }


    const parcelaPuraNormalSemRedutor = calcularParcelaPuraPJ(categoriaFull, effectivePrazoSimulacao);
    const parcelaPuraNormalComRedutor = calcularParcelaOriginalReduzidaPJ(categoriaFull, effectivePrazoSimulacao, effectiveRedutorValue);

    const parcelaOriginalNormalSemSeguro = parcelaPuraNormalComRedutor !== undefined 
        ? parcelaPuraNormalComRedutor 
        : parcelaPuraNormalSemRedutor;
    
    let parcelaOriginalReduzidaSemSeguro: number | undefined = undefined;
    if (effectiveRedutorValue !== "CAMPANHA PARCELA ORIGINAL" && typeof effectiveRedutorValue === 'number' && effectiveRedutorValue > 0) {
        parcelaOriginalReduzidaSemSeguro = parcelaPuraNormalComRedutor;
    }


    let valorSeguroInicialNormal: number | undefined;
    let parcelaOriginalNormalComSeguro: number | undefined;
    let parcelaOriginalReduzidaComSeguro: number | undefined;

    if (tipoContratacao === "fisica" && g.SeguroVidaApolicePercent !== undefined && g.SeguroVidaApolicePercent > 0) {
        valorSeguroInicialNormal = calcularValorSeguro(categoriaFull, g.SeguroVidaApolicePercent, tipoContratacao);
        parcelaOriginalNormalComSeguro = toDecimalPlaces(parcelaOriginalNormalSemSeguro + valorSeguroInicialNormal);

        if (parcelaOriginalReduzidaSemSeguro !== undefined) { 
            parcelaOriginalReduzidaComSeguro = toDecimalPlaces(parcelaOriginalReduzidaSemSeguro + valorSeguroInicialNormal);
        }
    }
    
    const representatividadeLanceEmbutidoGrupo = calcularRepresentatividadeLanceEmbutidoDoGrupo(valorCredito, g.LanceEmbutidoPercent);

    let valorTotalLanceOfertadoSimulacao: number; 
    let finalLanceLivrePercentualInputForResult: number = 0;
    let lanceLivreReaisInput = params.lanceLivreReais;
    let lanceLivrePercentualInput = params.lanceLivrePercentual;

    if (chosenLanceStrategy === 'fixo') {
        valorTotalLanceOfertadoSimulacao = calcularValorTotalLanceFixo(categoriaFull, g.LanceFixoPercent);
        finalLanceLivrePercentualInputForResult = g.LanceFixoPercent || 0; 
    } else { // Lance Livre
        let lanceLivreParteCliente = 0;
        if (lanceLivreReaisInput !== undefined && lanceLivreReaisInput > 0) {
            lanceLivreParteCliente = lanceLivreReaisInput;
        } else if (lanceLivrePercentualInput !== undefined && lanceLivrePercentualInput > 0) {
            lanceLivreParteCliente = toDecimalPlaces(categoriaFull * (lanceLivrePercentualInput / 100));
        } else {
            lanceLivreParteCliente = 0;
        }

        valorTotalLanceOfertadoSimulacao = lanceLivreParteCliente;
        if (useGroupLanceEmbutidoForLivre && representatividadeLanceEmbutidoGrupo > 0) {
            valorTotalLanceOfertadoSimulacao = toDecimalPlaces(valorTotalLanceOfertadoSimulacao + representatividadeLanceEmbutidoGrupo);
        }
        
        if (categoriaFull > 0) {
             finalLanceLivrePercentualInputForResult = toDecimalPlaces((valorTotalLanceOfertadoSimulacao / categoriaFull) * 100, 2);
        } else {
             finalLanceLivrePercentualInputForResult = 0; 
        }
    }

    let recursoProprioParaLance = valorTotalLanceOfertadoSimulacao;
    if (chosenLanceStrategy === 'livre' && useGroupLanceEmbutidoForLivre) {
        recursoProprioParaLance = Math.max(0, toDecimalPlaces(valorTotalLanceOfertadoSimulacao - representatividadeLanceEmbutidoGrupo));
    }
    if (tipoContratacao === 'fisica' && valorFGTS > 0 && chosenLanceStrategy !== 'fixo') {
        recursoProprioParaLance = Math.max(0, toDecimalPlaces(recursoProprioParaLance - valorFGTS));
    }

    const creditoLiquidoFinal = toDecimalPlaces(
        (chosenLanceStrategy === 'fixo' || (chosenLanceStrategy === 'livre' && !useGroupLanceEmbutidoForLivre))
            ? valorCredito
            : Math.max(0, valorCredito - representatividadeLanceEmbutidoGrupo) 
    );
    
    let valorPagoAteContemplacao = 0;
    for (let i = 1; i < parcelaContemplacao; i++) {
        if (isDilutionEffectivelyActive && effectiveChosenDilutionPeriodInMonths && i <= effectiveChosenDilutionPeriodInMonths) {
            valorPagoAteContemplacao += (parcelValueDuringDilutionSemSeguro || 0);
        } else {
            valorPagoAteContemplacao += (parcelaOriginalNormalSemSeguro);
        }
    }
    valorPagoAteContemplacao = toDecimalPlaces(valorPagoAteContemplacao);

    const saldoDevedorContabilAntesDoLance = toDecimalPlaces(categoriaFull - valorPagoAteContemplacao);
    const saldoDevedorParaAmortizacaoComLance = Math.max(0, toDecimalPlaces(saldoDevedorContabilAntesDoLance - valorTotalLanceOfertadoSimulacao));

    const reduzirParcelaOutcome = calculatePostContemplationForStrategy(
        'reduzir_parcela', 
        saldoDevedorParaAmortizacaoComLance,
        parcelaOriginalNormalSemSeguro, // Parcela integral s/ redutor e s/ diluição TAA
        effectivePrazoSimulacao,
        parcelaContemplacao,
        isDilutionEffectivelyActive,
        effectiveChosenDilutionPeriodInMonths,
        adhesionInstallmentValueDuringDilution,
        pisoParcelaReferenciaSemSeguro,
        tipoContratacao,
        g.SeguroVidaApolicePercent
    );

    const reduzirPrazoOutcome = calculatePostContemplationForStrategy(
        'reduzir_prazo',
        saldoDevedorParaAmortizacaoComLance,
        parcelaOriginalNormalSemSeguro, // Parcela integral s/ redutor e s/ diluição TAA
        effectivePrazoSimulacao,
        parcelaContemplacao,
        isDilutionEffectivelyActive,
        effectiveChosenDilutionPeriodInMonths,
        adhesionInstallmentValueDuringDilution,
        pisoParcelaReferenciaSemSeguro,
        tipoContratacao,
        g.SeguroVidaApolicePercent
    );


    return {
        nomeGrupo: g.NomeGrupo,
        bem: g.Bem,
        valorCreditoOriginal: valorCredito,
        prazoOriginalGrupoMeses: g.PrazoOriginalMeses,
        effectivePrazoSimulacao,
        tipoContratacao,
        lanceLivrePercentualInput: finalLanceLivrePercentualInputForResult,
        parcelaContemplacaoInput: parcelaContemplacao,
        valorFGTSInput: valorFGTS,
        chosenLanceStrategy,
        useGroupLanceEmbutidoForLivre,
        selectedGroupData: g,
        userRedutorOverride,
        
        initialChosenDilutionPeriodInMonths,
        effectiveChosenDilutionPeriodInMonths,
        isDilutionEffectivelyActive,
        totalDilutableAdhesionValue,
        adhesionInstallmentValueDuringDilution,
        parcelValueDuringDilutionSemSeguro,
        parcelValueDuringDilutionComSeguro,
        pisoParcelaReferenciaSemSeguro,
        parcelaBaseOriginalParaDiluicaoSemSeguro,

        categoria: categoriaFull,
        valorCreditoComRedutorAplicado,
        
        parcelaOriginalReduzidaSemSeguro,
        parcelaOriginalNormalSemSeguro,
        
        valorSeguroInicial: valorSeguroInicialNormal,
        parcelaOriginalReduzidaComSeguro,
        parcelaOriginalNormalComSeguro,

        representatividadeLanceEmbutido: representatividadeLanceEmbutidoGrupo,
        valorTotalLanceFixo: chosenLanceStrategy === 'fixo' ? valorTotalLanceOfertadoSimulacao : undefined,
        
        valorLanceLivreCalculado: chosenLanceStrategy === 'livre' ? valorTotalLanceOfertadoSimulacao : 0,
        recursoProprioNecessario: recursoProprioParaLance,
        
        creditoLiquidoFinal,

        reduzirParcelaOutcome,
        reduzirPrazoOutcome,
        
        taxaAdmTotalDisplay: formatPercentage(taxaAdmTotalOriginalPercent),
        taxaAdmAntecDisplay: formatPercentage(taxaAdmAntecipadaOriginalPercent),
        taxaAdmDiluidaDisplay: formatPercentage(calcularTaxaAdministrativaDiluidaPercentDisplay(taxaAdmTotalOriginalPercent, taxaAdmAntecipadaOriginalPercent)),
        fundoReservaDisplay: formatPercentage(fundoReservaOriginalPercent),
        lanceEmbutidoDisplay: formatPercentage(g.LanceEmbutidoPercent),
        lanceFixoDisplay: g.LanceFixoPercent !== undefined ? formatPercentage(g.LanceFixoPercent) : "N/A",
        redutorDisplay: formatPercentage(g.Redutor === "CAMPANHA PARCELA ORIGINAL" ? 0 : g.Redutor),
        seguroVidaDisplay: g.SeguroVidaApolicePercent !== undefined ? formatPercentage(g.SeguroVidaApolicePercent, 3) : "N/A",
        effectiveRedutorDisplay,
        dilutionPeriodDisplay: effectiveChosenDilutionPeriodInMonths ? `${effectiveChosenDilutionPeriodInMonths} meses` : "Não diluído",
    };
};


export const applyPortoFiltersAndSort = (
    groups: PortoGroupData[],
    criteria: FilterCriteria
): PortoGroupData[] => {
    let filtered = [...groups];

    if (criteria.credit) {
        if (typeof criteria.credit === 'number') {
            filtered = filtered.filter(g => g.ValorDoCredito === criteria.credit);
        } else if (typeof criteria.credit === 'object' && criteria.credit !== null) {
            // Type guard ensures criteria.credit is { min: number; max: number } here
            filtered = filtered.filter(g => g.ValorDoCredito >= criteria.credit!.min && g.ValorDoCredito <= criteria.credit!.max);
        }
    }

    if (criteria.prazo) {
        const targetPrazo = (g: PortoGroupData) => g.MesesRestantes !== undefined && g.MesesRestantes > 0 ? g.MesesRestantes : g.PrazoOriginalMeses;
        if (typeof criteria.prazo === 'number') {
            filtered = filtered.filter(g => targetPrazo(g) === criteria.prazo);
        } else if (typeof criteria.prazo === 'object' && criteria.prazo !== null) {
            // Type guard ensures criteria.prazo is { min: number; max: number } here
            filtered = filtered.filter(g => targetPrazo(g) >= criteria.prazo!.min && targetPrazo(g) <= criteria.prazo!.max);
        }
    }

    if (criteria.textSearch) {
        const searchTerm = criteria.textSearch.toLowerCase().trim();
        filtered = filtered.filter(g => 
            g.NomeGrupo.toLowerCase().includes(searchTerm) ||
            g.Bem.toLowerCase().includes(searchTerm) ||
            (g.TipoBem && g.TipoBem.toLowerCase().includes(searchTerm))
        );
    }

    if (criteria.desiredNetCreditEmbutido) {
        const desiredNet = criteria.desiredNetCreditEmbutido;
        filtered = filtered.filter(g => {
            if (g.LanceEmbutidoPercent <= 0) return false; // Must have embutido
            if (g.ValorDoCredito <= desiredNet) return false; // Total credit must be > desired net credit

            const requiredEmbutidoValue = g.ValorDoCredito - desiredNet;
            const requiredEmbutidoPercent = (requiredEmbutidoValue / g.ValorDoCredito) * 100;
            
            return desiredNet >= 0.70 * g.ValorDoCredito && // Net credit is at least 70% of total
                   requiredEmbutidoPercent <= g.LanceEmbutidoPercent; // Group's embutido allowance is sufficient
        });
    }

    return filtered.sort((a, b) => {
        if (a.NomeGrupo.localeCompare(b.NomeGrupo) !== 0) {
            return a.NomeGrupo.localeCompare(b.NomeGrupo);
        }
        return a.ValorDoCredito - b.ValorDoCredito;
    });
};

export const calculateAmortizationStepByStep = (
    simulationResult: PortoSimulationResult,
    amortizacaoPreferida: AmortizacaoPreferida
): AmortizationCalculationResult => {

    const dadosBase: AmortizationCalculationData = {
        creditoContratado: simulationResult.valorCreditoOriginal,
        taxaAdmTotalPercent: simulationResult.selectedGroupData.TaxaAdministracaoTotal,
        creditoMaisTaxasOriginal: simulationResult.categoria,
        prazoInicial: simulationResult.effectivePrazoSimulacao,
        parcelaIntegralCalculo: simulationResult.parcelaOriginalNormalSemSeguro,
        parcelasPagasContemplacao: simulationResult.parcelaContemplacaoInput -1,
        lanceOfertadoTotalOriginal: simulationResult.chosenLanceStrategy === 'fixo' ? (simulationResult.valorTotalLanceFixo || 0) : simulationResult.valorLanceLivreCalculado,
        recursosDoClienteParaLanceBruto: simulationResult.recursoProprioNecessario + (simulationResult.tipoContratacao === 'fisica' ? simulationResult.valorFGTSInput : 0),
        lanceLiquidoUsadoParaAmortizacao: 0, // Será calculado abaixo
    };

    const numParcelasPagas = simulationResult.parcelaContemplacaoInput -1;
    let valorTotalPagoEfetivamenteAteContemplacao = 0;
    for (let i = 1; i <= numParcelasPagas; i++) {
        if (simulationResult.isDilutionEffectivelyActive && simulationResult.effectiveChosenDilutionPeriodInMonths && i <= simulationResult.effectiveChosenDilutionPeriodInMonths) {
            valorTotalPagoEfetivamenteAteContemplacao += (simulationResult.parcelValueDuringDilutionSemSeguro || simulationResult.parcelaOriginalNormalSemSeguro);
        } else {
            valorTotalPagoEfetivamenteAteContemplacao += simulationResult.parcelaOriginalNormalSemSeguro; 
        }
    }
    valorTotalPagoEfetivamenteAteContemplacao = toDecimalPlaces(valorTotalPagoEfetivamenteAteContemplacao);

    const valorTotalNominalDasParcelasAteContemplacao = toDecimalPlaces(simulationResult.parcelaOriginalNormalSemSeguro * numParcelasPagas);
    dadosBase.valorDeixadoDeSerPagoCalculado = toDecimalPlaces(valorTotalNominalDasParcelasAteContemplacao - valorTotalPagoEfetivamenteAteContemplacao);
    
    let lanceOfertadoTotal = dadosBase.lanceOfertadoTotalOriginal;
    if (simulationResult.useGroupLanceEmbutidoForLivre && simulationResult.representatividadeLanceEmbutido > 0 && simulationResult.chosenLanceStrategy !== 'fixo') {
        lanceOfertadoTotal -= simulationResult.representatividadeLanceEmbutido; // Consider only client's part for VDSP adjustment if embutido used
    }
    
    dadosBase.lanceLiquidoUsadoParaAmortizacao = toDecimalPlaces(lanceOfertadoTotal - (dadosBase.valorDeixadoDeSerPagoCalculado || 0));
    if (dadosBase.lanceLiquidoUsadoParaAmortizacao < 0) dadosBase.lanceLiquidoUsadoParaAmortizacao = 0; // Lance cannot be negative


    const steps: AmortizationStepDetail[] = [];
    
    steps.push({
        stepNumber: 0, // Marcador para dados base
        title: "Cálculo do Saldo Devedor Contábil (Pré-Lance)",
        formula: "Saldo Devedor Contábil = Categoria Total - Σ(Parcelas Puras Pagas)",
        calculation: `${formatCurrency(simulationResult.categoria)} - Σ(${formatCurrency(simulationResult.parcelaOriginalNormalSemSeguro)} x ${numParcelasPagas} pagas)`,
        result: `${formatCurrency(toDecimalPlaces(simulationResult.categoria - (simulationResult.parcelaOriginalNormalSemSeguro * numParcelasPagas)))}`,
        explanation: "Representa o valor total que ainda precisa ser pago do plano, considerando apenas a amortização do principal e taxas, antes de aplicar o lance."
    });
    
    const saldoDevedorContabilPreLance = toDecimalPlaces(simulationResult.categoria - (simulationResult.parcelaOriginalNormalSemSeguro * numParcelasPagas));

    steps.push({
        stepNumber: 0.1, // Marcador para dados base
        title: "Saldo Devedor para Amortização (Pós-Lance)",
        formula: "Saldo Devedor Pós-Lance = Saldo Devedor Contábil Pré-Lance - Lance Líquido para Amortização",
        calculation: `${formatCurrency(saldoDevedorContabilPreLance)} - ${formatCurrency(dadosBase.lanceLiquidoUsadoParaAmortizacao)}`,
        result: `${formatCurrency(toDecimalPlaces(saldoDevedorContabilPreLance - dadosBase.lanceLiquidoUsadoParaAmortizacao))}`,
        explanation: "Este é o valor efetivo que será utilizado para recalcular as parcelas ou o prazo restante."
    });

    const saldoDevedorFinalParaCalculo = Math.max(0, toDecimalPlaces(saldoDevedorContabilPreLance - dadosBase.lanceLiquidoUsadoParaAmortizacao));
    
    let resultadoFinal: PostContemplationOutcome;
    if (amortizacaoPreferida === 'reduzir_parcela') {
        resultadoFinal = simulationResult.reduzirParcelaOutcome;
    } else {
        resultadoFinal = simulationResult.reduzirPrazoOutcome;
    }

    steps.push({
        stepNumber: 1,
        title: `Recálculo (${amortizacaoPreferida === 'reduzir_prazo' ? 'Prazo com Parcela Mantida' : 'Parcela com Prazo Mantido'})`,
        formula: amortizacaoPreferida === 'reduzir_prazo' 
            ? "Novo Prazo = Saldo Devedor Pós-Lance / Parcela Integral de Referência"
            : "Nova Parcela Principal = Saldo Devedor Pós-Lance / Prazo Restante Original",
        calculation: amortizacaoPreferida === 'reduzir_prazo'
            ? `${formatCurrency(saldoDevedorFinalParaCalculo)} / ${formatCurrency(simulationResult.parcelaOriginalNormalSemSeguro)}`
            : `${formatCurrency(saldoDevedorFinalParaCalculo)} / ${simulationResult.effectivePrazoSimulacao - simulationResult.parcelaContemplacaoInput}`,
        result: amortizacaoPreferida === 'reduzir_prazo'
            ? `${resultadoFinal.prazoRestanteOriginalAnteParcelFloorAdjustment || resultadoFinal.prazoRestantePosContemplacao} meses (arredondado para cima)`
            : `${formatCurrency(resultadoFinal.parcelPostContemplacaoSemSeguroBeforeFloor || resultadoFinal.parcelaPosContemplacaoSemSeguro)} (sem TAA diluída ainda)`,
        explanation: "Calcula a nova parcela ou prazo com base no saldo devedor após o lance."
    });

    if (resultadoFinal.adesaoPorParcelaDiluidaPosContemplacao && resultadoFinal.numParcelasComAdesaoPosContemplacao && resultadoFinal.numParcelasComAdesaoPosContemplacao > 0) {
        steps.push({
            stepNumber: 2,
            title: "Aplicação da Diluição da Taxa de Adm. Antecipada (TAA)",
            formula: "Parcela c/ TAA = Parcela Principal Pós-Lance + (TAA Total / Nº Meses Diluição Pós-Cont.)",
            calculation: `${formatCurrency(resultadoFinal.parcelPostContemplacaoSemSeguroBeforeFloor! - resultadoFinal.adesaoPorParcelaDiluidaPosContemplacao)} + ${formatCurrency(resultadoFinal.adesaoPorParcelaDiluidaPosContemplacao)}`,
            result: `${formatCurrency(resultadoFinal.parcelPostContemplacaoSemSeguroBeforeFloor!)} (para as primeiras ${resultadoFinal.numParcelasComAdesaoPosContemplacao} parcelas pós-cont.)`,
            explanation: "A TAA restante é diluída nas parcelas iniciais pós-contemplação."
        });
    }
    
    if (resultadoFinal.wasParcelPostContemplationAdjustedByFloor) {
         steps.push({
            stepNumber: 3,
            title: "Ajuste pelo Piso da Parcela (50%)",
            formula: "Parcela Final = MAX(Parcela Calculada, Piso da Parcela)",
            calculation: `MAX(${formatCurrency(resultadoFinal.parcelPostContemplacaoSemSeguroBeforeFloor!)}, ${formatCurrency(resultadoFinal.pisoParcelaReferenciaSemSeguro!)})`,
            result: `${formatCurrency(resultadoFinal.parcelaPosContemplacaoSemSeguro)}`,
            explanation: `A parcela não pode ser inferior a 50% da parcela integral de referência (${formatCurrency(resultadoFinal.pisoParcelaReferenciaSemSeguro!)}). Se 'Reduzir Parcela' foi escolhido e o piso foi atingido, o prazo pode ter sido recalculado para ${resultadoFinal.prazoRestantePosContemplacao} meses.`
        });
    }
    
    const valorCalculadoFinal = resultadoFinal.parcelaPosContemplacaoSemSeguro;

    return {
        dadosBase,
        steps,
        conferencia: {
            valorCalculadoFinal,
            diferenca: 0, // Conferência é mais complexa que uma simples diferença
            matches: true, // Assumindo que os passos acima levam ao resultado da simulação
            comment: `A parcela final (s/seg) calculada é ${formatCurrency(valorCalculadoFinal)} por ${resultadoFinal.prazoRestantePosContemplacao} meses. ${resultadoFinal.numParcelasComAdesaoPosContemplacao && resultadoFinal.numParcelasComAdesaoPosContemplacao > 0 ? `As primeiras ${resultadoFinal.numParcelasComAdesaoPosContemplacao} incluem TAA diluída.` : ''} ${resultadoFinal.wasParcelPostContemplationAdjustedByFloor ? 'Ajustada pelo piso.' : ''}`
        },
        amortizacaoPreferidaConsiderada: amortizacaoPreferida,
    };
};
