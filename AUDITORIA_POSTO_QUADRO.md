# Relatório de Auditoria de Campos de Posto/Graduação e Quadro

## Sumário

- Total de ocorrências: 499

### Por Risco
- Baixo: 316
- Alto (Módulo Sensível): 183

### Por Finalidade
- leitura: 318
- gravação: 96
- importação: 15
- templates/documentos: 65
- filtro: 4
- exportação: 1

## Detalhamento das Ocorrências

| Arquivo | Função/Componente | Campo | Finalidade | Risco |
| --- | --- | --- | --- | --- |
| src/services/militar360Service.js | montarMilitar | postoGraduacao | leitura | Baixo |
| src/services/medalhasTempoServicoService.js | isPracaComComportamentoInvalido | posto | gravação | Alto (Módulo Sensível) |
| src/services/medalhasTempoServicoService.js | criarIndicacaoAutomatica | posto | leitura | Alto (Módulo Sensível) |
| src/services/historicoImportacoesMilitaresService.js | normalizarLinha | posto | importação | Baixo |
| src/services/historicoImportacoesMilitaresService.js | exportarCsvHistoricoHumano | posto | importação | Baixo |
| src/services/historicoImportacoesMilitaresService.js | exportarCsvHistoricoHumano | posto | importação | Baixo |
| src/services/creditoExtraFeriasRules.js | criarPayloadCreditoExtraFerias | posto_grad | leitura | Baixo |
| src/services/afastamentosVigentesService.js | mapAtestadosVigentes | postoGraduacao | leitura | Baixo |
| src/services/afastamentosVigentesService.js | mapFeriasVigentes | postoGraduacao | leitura | Baixo |
| src/services/afastamentosVigentesService.js | mapRegistroLivroVigentes | postoGraduacao | leitura | Baixo |
| src/services/afastamentosVigentesService.js | mapLtipVigentes | postoGraduacao | leitura | Baixo |
| src/services/migracaoAlteracoesLegadoService.js | DESTINO_FINAL | cargo | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | isMilitarTemporarioParaControleAtestados | quadro_atual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | isMilitarTemporarioParaControleAtestados | quadroAtual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | isMilitarTemporarioParaControleAtestados | quadro_militar | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadro_atual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadroAtual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadro_atual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadroAtual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadro_atual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | quadroAtual | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | postoGraduacao | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | postoGraduacao | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto_grad | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | postoGraduacao | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto_grad | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | postoGraduacao | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto_grad | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js | montarMilitarBase | posto | leitura | Baixo |
| src/services/documentosMilitares/documentoMilitarVarsService.js | montarVariaveisDocumentoMilitar | posto | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.test.js | Global/Unknown | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.test.js | Global/Unknown | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | obterFuncaoSignatario | cargo | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | normalizarSignatarioMilitar | posto | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | normalizarSignatarioMilitar | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | normalizarSignatarioMilitar | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarLinhaIdentificacaoSignatario | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarLinhaIdentificacaoSignatario | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarAssinaturaSignatario | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarAssinaturaSignatario | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarVariaveisSignatarioDocumentoMilitar | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarVariaveisSignatarioDocumentoMilitar | posto | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarVariaveisSignatarioDocumentoMilitar | graduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarVariaveisSignatarioDocumentoMilitar | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js | montarVariaveisSignatarioDocumentoMilitar | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/services/migracaoMilitaresService.js | __setMigracaoMilitaresClientForTests | posto | leitura | Baixo |
| src/services/migracaoMilitaresService.js | mapQuadro | postoGraduacao | leitura | Baixo |
| src/services/migracaoMilitaresService.js | mapQuadro | postoGraduacao | leitura | Baixo |
| src/services/migracaoMilitaresService.js | mapQuadro | posto | leitura | Baixo |
| src/services/migracaoMilitaresService.js | compararCamposConferencia | posto | leitura | Baixo |
| src/services/promocaoService.js | isPromocaoFormacaoTerceiroSargento | postoGraduacao | gravação | Baixo |
| src/services/promocaoService.js | isPromocaoFormacaoTerceiroSargento | postoGraduacao | gravação | Baixo |
| src/services/promocaoService.js | isPromocaoFormacaoTerceiroSargento | postoGraduacao | gravação | Baixo |
| src/services/promocaoService.js | isPromocaoInicioCadeia | posto | gravação | Baixo |
| src/services/promocaoService.js | isPromocaoInicioCadeia | posto | leitura | Baixo |
| src/services/promocaoService.js | validarPublicacaoPromocaoBase | posto | leitura | Baixo |
| src/services/promocaoService.js | validarPublicacaoPromocaoBase | posto | leitura | Baixo |
| src/services/promocaoService.js | montarPayloadHistoricoPublicacao | posto_graduacao_atual | leitura | Baixo |
| src/services/promocaoService.js | montarPayloadHistoricoPublicacao | quadro_atual | leitura | Baixo |
| src/services/promocaoService.js | resolverHistoricoPublicacao | posto | leitura | Baixo |
| src/services/promocaoService.js | restaurarCadastroMilitarDaPromocao | quadroAtual | gravação | Baixo |
| src/services/promocaoService.js | restaurarCadastroMilitarDaPromocao | quadroAtual | leitura | Baixo |
| src/services/promocaoService.js | restaurarCadastroMilitarDaPromocao | posto | leitura | Baixo |
| src/services/promocaoService.js | postoGraduacaoBaseAnterior | posto | leitura | Baixo |
| src/services/promocaoService.js | calcularInsercaoPorAntiguidadeAnterior | posto | leitura | Baixo |
| src/services/promocaoService.js | calcularInsercaoPorAntiguidadeAnterior | posto | leitura | Baixo |
| src/services/promocaoService.js | calcularInsercaoPorAntiguidadeAnterior | posto | leitura | Baixo |
| src/services/promocaoService.js | indicePostoGraduacao | postoGraduacao | leitura | Baixo |
| src/services/promocaoService.js | indicePostoGraduacao | postoGraduacao | gravação | Baixo |
| src/services/promocaoService.js | indicePostoGraduacao | posto | leitura | Baixo |
| src/services/promocaoService.js | ordenarPromocoes | posto | gravação | Baixo |
| src/services/promocaoService.js | ordenarPromocoes | posto | leitura | Baixo |
| src/services/promocaoService.js | avaliarCompatibilidadePromocao | posto | leitura | Baixo |
| src/services/promocaoService.js | motivosBloqueioVinculoProvavel | posto | leitura | Baixo |
| src/services/__tests__/creditoExtraFeriasService.test.js | Global/Unknown | posto_grad | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | rejeitaSemEscrita | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | rejeitaSemEscrita | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | rejeitaSemEscrita | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | rejeitaSemEscrita | posto | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js | detalleSemEspacos | posto | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | normalizar | posto | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | quadroAtual | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | quadroAtual | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | posto | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | posto_graduacao_atual | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | quadro_atual | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | posto | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | quadro_atual | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | posto_graduacao_atual | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | quadro_atual | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js | obterPostoCanonico | posto | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | posto | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | quadro_atual | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | quadro_atual | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | quadro_atual | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | posto_grad | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | quadro_atual | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js | criarAnalise | postoGraduacao | leitura | Baixo |
| src/services/__tests__/globalMilitarSearchService.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/promocaoRegressaoIntegrada.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/promocaoRegressaoIntegrada.test.js | Global/Unknown | posto | leitura | Baixo |
| src/services/__tests__/militar360Service.test.js | Global/Unknown | posto | gravação | Baixo |
| src/components/dashboard/AfastamentosVigentesPanel.jsx | AfastamentoRow | postoGraduacao | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js | Global/Unknown | postoGraduacao | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js | Global/Unknown | posto | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js | Global/Unknown | posto | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | abreviarPostoGraduacao | postoGraduacao | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | abreviarPostoGraduacao | postoGraduacao | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | abreviarPostoGraduacao | posto | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | abreviarPostoGraduacao | posto | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | montarLinhaAssinatura | postoGraduacao | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js | montarLinhaAssinatura | postoGraduacao | gravação | Baixo |
| src/components/folha-alteracoes/folhaAlteracoesHistorico.test.js | Global/Unknown | posto | leitura | Baixo |
| src/components/folha-alteracoes/folhaAlteracoesHistorico.test.js | Global/Unknown | posto | leitura | Baixo |
| src/components/migracao-militares/TabelaLinhasImportacaoMilitares.jsx | TabelaLinhasImportacaoMilitares | posto | importação | Baixo |
| src/components/militar/MilitarTagsBulkPanel.jsx | toggleTag | posto_grad | filtro | Baixo |
| src/components/militar/NomeMilitar.jsx | Global/Unknown | posto | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx | destacarNomeGuerra | posto | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx | NomeMilitar | posto | gravação | Baixo |
| src/components/militar/NomeMilitar.jsx | NomeMilitar | posto | gravação | Baixo |
| src/components/militar/NomeMilitar.jsx | NomeMilitar | posto | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx | formatNomeMilitarTexto | posto | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx | formatNomeMilitarTexto | posto | gravação | Baixo |
| src/components/militar/MapaDeLotacao.jsx | MilitarCompactCard | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | getPostoIndex | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | getPostoIndex | posto | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | MilitaresDistribuicaoView | posto | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | MilitaresDistribuicaoView | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | MilitaresDistribuicaoView | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | MilitaresDistribuicaoView | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | MilitaresDistribuicaoView | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx | togglePosto | posto | leitura | Baixo |
| src/components/militar/GlobalMilitarSearch.jsx | renderResultCard | posto | gravação | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx | Global/Unknown | postoGraduacao | leitura | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx | formatarMilitarPrincipal | posto | gravação | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx | formatarMilitarPrincipal | posto | filtro | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx | registrarBloqueio | posto | gravação | Baixo |
| src/components/utils/templateUtils.js | buildVarsLivro | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.js | buildPreviewTemplateVars | posto | templates/documentos | Alto (Módulo Sensível) |
| src/components/utils/templateUtils.js | buildPreviewTemplateVars | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.js | buildPreviewTemplateVars | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.js | buildPreviewTemplateVars | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | qbmp | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Alto (Módulo Sensível) |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | abreviarPosto | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | abreviarPosto | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | abreviarPosto | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | resolveQuadroTemplate | quadro_atual | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | normalizarPostoTemplate | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | montarPostoNomeTemplate | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | montarPostoNomeTemplate | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | buildTemplateVarsContrato | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | buildTemplateVarsContrato | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | buildTemplateVarsContrato | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | buildTemplateVarsContrato | posto | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js | buildTemplateVarsContrato | posto | templates/documentos | Baixo |
| src/components/antiguidade/RankIcon.jsx | normalizeRank | rank | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/RankIcon.jsx | RankIcon | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/RankIcon.jsx | getIconProps | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx | PromocaoFuturaModal | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx | PromocaoFuturaModal | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx | PromocaoFuturaModal | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | InsigniaBox | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | InsigniaBox | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | PromocaoAtualCard | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | PromocaoAnteriorItem | posto | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | PromocaoAnteriorItem | posto | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | PromocaoAnteriorItem | posto | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx | PromocoesTimeline | posto | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | indicePosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroPromocao | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroPromocao | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroPromocaoFutura | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroPromocaoFutura | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroAnteriorPromocaoColetiva | quadroAtual | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | resolverQuadroAnteriorPromocaoColetiva | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | validarLinhaPromocaoColetiva | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | validarLinhaPromocaoColetiva | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js | mesmoAtoDataPostoQuadro | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx | onSelectPosto | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx | abrirPromocaoOrigem | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx | abrirPromocaoOrigem | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx | abrirPromocaoOrigem | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx | abrirPromocaoOrigem | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx | PromocaoAtualModal | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx | PromocaoAtualModal | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx | PromocaoAtualModal | posto | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx | PromocaoAtualModal | posto | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | obterPostoExibicaoMilitar | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | obterPostoExibicaoMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | obterPostoExibicaoMilitar | graduacao | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | militarPassaFiltroModal | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | LinhaMilitarEfetivo | posto | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | LinhaMilitarEfetivo | posto | filtro | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | ModalEfetivoUnidade | posto | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | separarMilitaresLista | posto | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | separarMilitaresLista | posto | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | ListaPersonCard | posto | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx | ListaPersonCard | posto | gravação | Alto (Módulo Sensível) |
| src/components/rp/templateValidation.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.test.js | Global/Unknown | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.test.js | aplicarTemplateLocal | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/rp/templateValidation.js | normalizarEscopoTemplate | posto | templates/documentos | Baixo |
| src/components/documentosMilitares/DocumentoMilitarPreview.jsx | DocumentoMilitarPreview | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/components/documentosMilitares/DocumentoMilitarPreview.jsx | DocumentoMilitarPreview | postoGraduacao | templates/documentos | Alto (Módulo Sensível) |
| src/components/admin/SaneamentoPromocaoDivergenteDialog.jsx | SaneamentoPromocaoDivergenteDialog | posto | leitura | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx | Global/Unknown | posto | leitura | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx | handleMilitarSelect | posto | gravação | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx | handleMilitarSelect | posto | leitura | Baixo |
| src/components/funcoes-tags/IconeCatalogo.jsx | CATEGORIAS_ICONE | graduacao | leitura | Baixo |
| src/hooks/central-pendencias/useCentralPendencias.js | mapPromocoesPrevistasPendentes | posto_graduacao_atual | gravação | Baixo |
| src/hooks/central-pendencias/useCentralPendencias.js | mapPromocoesPrevistasPendentes | posto_grad | gravação | Baixo |
| src/utils/promocao/ordenacaoPromocao.js | ordenarPorAntiguidadeAnterior | posto | gravação | Baixo |
| src/utils/promocao/ordenacaoPromocao.js | ordenarPorAntiguidadeAnterior | posto | leitura | Baixo |
| src/utils/promocao/buildPromocaoContext.js | isPostoDestinoPromocaoInicial | postoGraduacao | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js | isPostoDestinoPromocaoInicial | postoGraduacao | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js | buildPromocaoContext | posto | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js | buildPromocaoContext | posto | gravação | Baixo |
| src/utils/promocao/__tests__/ordenacaoPromocao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/promocao/__tests__/buildPromocaoContext.test.js | basePromocao | posto | leitura | Baixo |
| src/utils/promocao/__tests__/deveAtualizarCadastroMilitarPorPromocao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/inconsistenciasCadastrais.js | listarInconsistenciasCadastraisMilitar | posto | leitura | Baixo |
| src/utils/antiguidade/importarPromocoes.js | STATUS | quadro_atual | importação | Alto (Módulo Sensível) |
| src/utils/antiguidade/importarPromocoes.js | gerarPreviaImportacao | quadro_atual | importação | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js | normalizarTextoPreviaAntiguidade | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js | normalizarTextoPreviaAntiguidade | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js | isPostoQuadroIncompativel | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js | isPostoQuadroIncompativel | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js | montarCadeiaAntiguidadeMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js | obterHistoricoAtivoMaisRecenteCompativel | quadroAtual | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js | obterHistoricoAtivoMaisRecenteCompativel | quadroAtual | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js | validarDadosAntiguidade | postoGraduacao | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js | validarDadosAntiguidade | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js | ordenarMilitaresPorAntiguidadeInstitucional | posto | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js | ordenarMilitaresPorAntiguidadeInstitucional | posto | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js | promocao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/selecionarPromocaoAtual.test.js | historico | posto | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/selecionarPromocaoAtual.test.js | historico | posto | leitura | Alto (Módulo Sensível) |
| src/utils/militarPostoGraduacao.js | getPostoGraduacaoOficial | posto_grad | leitura | Baixo |
| src/utils/militarPostoGraduacao.js | getPostoGraduacaoOficial | posto | leitura | Baixo |
| src/utils/militarPostoGraduacao.js | getPostoGraduacaoOficial | graduacao | leitura | Baixo |
| src/utils/militarPostoGraduacao.js | normalizarPostoGraduacaoMilitar | postoGraduacao | gravação | Baixo |
| src/utils/militarPostoGraduacao.js | normalizarPostoGraduacaoMilitar | postoGraduacao | leitura | Baixo |
| src/utils/militarPostoGraduacao.js | normalizarPostoGraduacaoMilitar | postoGraduacao | leitura | Baixo |
| src/utils/militarPostoGraduacao.js | normalizarPostoGraduacaoMilitar | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | isPraca | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | isPraca | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | temRegraArt | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | temRegraArt | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | calcularComportamento | postoGraduacao | gravação | Baixo |
| src/utils/calcularComportamento.js | calcularComportamento | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | calcularComportamento | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | calcularComportamento | postoGraduacao | gravação | Baixo |
| src/utils/calcularComportamento.js | calcularProximaMelhoria | postoGraduacao | gravação | Baixo |
| src/utils/calcularComportamento.js | calcularProximaMelhoria | postoGraduacao | leitura | Baixo |
| src/utils/calcularComportamento.js | calcularProximaMelhoria | postoGraduacao | gravação | Baixo |
| src/utils/calcularComportamento.js | calcularProximaMelhoria | postoGraduacao | gravação | Baixo |
| src/utils/rp/rpVarsService.js | montarVariaveisTemplateRP | posto | gravação | Baixo |
| src/utils/rp/rpVarsService.js | montarVariaveisTemplateRP | quadro_atual | leitura | Baixo |
| src/utils/rp/rpVarsService.js | montarVariaveisTemplateRP | posto | leitura | Baixo |
| src/utils/funcoesTags/decoracaoInstitucionalMilitar.js | ordenarComDestaqueInstitucional | rank | leitura | Baixo |
| src/utils/funcoesTags/decoracaoInstitucionalMilitar.js | ordenarComDestaqueInstitucional | rank | leitura | Baixo |
| src/utils/funcoesTags/__tests__/destaqueInstitucionalEfetivo.test.js | Global/Unknown | rank | leitura | Alto (Módulo Sensível) |
| src/utils/postoQuadroCompatibilidade.js | normalizarTexto | posto | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | classificarPostoGraduacao | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | classificarPostoGraduacao | postoGraduacao | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isPostoOficial | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isPostoOficial | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isPostoPraca | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isPostoPraca | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | getQuadrosCompativeis | postoGraduacao | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js | getQuadrosCompativeis | postoGraduacao | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isQuadroCompativel | postoGraduacao | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js | isQuadroCompativel | postoGraduacao | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js | removerQuadroAnexado | qbmp | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js | removerQuadroAnexado | posto | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js | getSugestaoAtualizacaoCadastro | posto_graduacao_atual | gravação | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto_grad | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | graduacao | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto_grad | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | graduacao | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto_grad | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | rank | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | gravação | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js | Global/Unknown | posto | leitura | Baixo |
| src/utils/__tests__/postoGraduacaoHierarquia.test.js | sugestao | posto | leitura | Baixo |
| src/utils/__tests__/postoGraduacaoHierarquia.test.js | sugestao | posto | leitura | Baixo |
| src/utils/efetivo/gestorClassificacao.js | resolvePostoGraduacao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | posto | gravação | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | graduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterGrupoHierarquicoMilitar | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js | obterPostoGraduacao | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | graduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | graduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | graduacao | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | compareCampoEfetivo | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | buildFiltrosSanitizadosAuditoria | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | buildFetchMilitaresPayload | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | buildFetchMilitaresPayload | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | resetSelectedColumns | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | carregar | posto | gravação | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | carregar | posto | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | carregar | posto | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx | carregar | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | pluralizePosto | posto | gravação | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | pluralizePosto | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | pluralizePosto | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | pluralizePosto | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | pluralizePosto | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | buildResumoListagem | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | buildResumoListagem | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | buildResumoListagem | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | buildResumoListagem | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | buildListagemTokens | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | getOptionCareer | posto | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx | CommandCenter | posto | gravação | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/catalogoCamposEfetivo.js | EXTRACAO_EFETIVO_FIELDS | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/__tests__/catalogoCamposEfetivo.test.js | Global/Unknown | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/ControleAtestadosTemporarios.jsx | AnaliseTableRow | postoGraduacao | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx | getPostoGraduacaoAtestado | posto | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx | getPostoGraduacaoAtestado | graduacao | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx | atualizarEncaminhamentoNoCache | postoGraduacao | gravação | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx | atualizarEncaminhamentoNoCache | postoGraduacao | gravação | Baixo |
| src/pages/AntiguidadePrevia.jsx | Global/Unknown | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx | Global/Unknown | posto | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx | AntiguidadePrevia | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx | alternarLinha | postoGraduacao | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx | alternarLinha | posto | leitura | Alto (Módulo Sensível) |
| src/pages/IndicacoesDomPedroII.jsx | prioridade | posto | leitura | Baixo |
| src/pages/IndicacoesDomPedroII.jsx | prioridade | posto | gravação | Baixo |
| src/pages/Medalhas.jsx | handleConfirmarExcluirMedalha | posto | leitura | Alto (Módulo Sensível) |
| src/pages/consultaMilitar/gestorHelpers.test.js | Global/Unknown | posto_grad | leitura | Baixo |
| src/pages/consultaMilitar/consultaMilitarColumns.js | CONSULTA_MILITAR_COLUNAS_ALLOWLIST | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | diagnosticarCriacaoPromocao | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | montarRastreamento | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | montarRastreamento | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | PainelMilitares | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | confirmarCriacaoPromocao | posto | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx | confirmarCriacaoPromocao | posto | gravação | Baixo |
| src/pages/RastreamentoPromocoes.jsx | confirmarCriacaoPromocao | posto | gravação | Baixo |
| src/pages/RastreamentoPromocoes.jsx | confirmarCriacaoPromocao | posto | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | MilitarCard | posto | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | MilitarCard | quadro_atual | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | MilitarCard | posto | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | DetalhePromocao | posto_graduacao_atual | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | DetalhePromocao | quadro_atual | leitura | Baixo |
| src/pages/DetalhePromocao.jsx | DetalhePromocao | posto | leitura | Baixo |
| src/pages/DetalhePromocao.jsx | confirmarExclusaoPromocao | posto | leitura | Alto (Módulo Sensível) |
| src/pages/DetalhePromocao.jsx | confirmarExclusaoPromocao | posto | leitura | Baixo |
| src/pages/DetalhePromocao.jsx | confirmarPublicacaoPromocao | posto | gravação | Baixo |
| src/pages/DetalhePromocao.jsx | confirmarPublicacaoPromocao | posto | leitura | Baixo |
| src/pages/DetalhePromocao.jsx | confirmarPublicacaoPromocao | quadro_atual | leitura | Baixo |
| src/pages/DetalhePromocao.jsx | confirmarPublicacaoPromocao | posto | leitura | Baixo |
| src/pages/TemplatesTexto.jsx | isTipoOcultoNoFrontend | posto | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx | isTipoOcultoNoFrontend | posto | templates/documentos | Alto (Módulo Sensível) |
| src/pages/FolhaAlteracoes.jsx | Global/Unknown | postoGraduacao | leitura | Baixo |
| src/pages/CreditosExtraordinariosFerias.jsx | CreditosExtraordinariosFerias | posto_grad | leitura | Baixo |
| src/pages/CreditosExtraordinariosFerias.jsx | toggleMilitar | posto | gravação | Baixo |
| src/pages/Publicacoes.jsx | montarNomeInstitucional | postoGraduacao | leitura | Baixo |
| src/pages/Publicacoes.jsx | montarNomeInstitucional | postoGraduacao | filtro | Baixo |
| src/pages/Publicacoes.jsx | normalizarRegistro | postoGraduacao | gravação | Baixo |
| src/pages/Publicacoes.jsx | normalizarRegistro | posto | leitura | Baixo |
| src/pages/Publicacoes.jsx | normalizarRegistro | posto | leitura | Baixo |
| src/pages/Publicacoes.jsx | normalizarRegistro | postoGraduacao | leitura | Baixo |
| src/pages/Publicacoes.jsx | normalizarRegistro | postoGraduacao | leitura | Baixo |
| src/pages/Militares.jsx | Global/Unknown | graduacao | leitura | Baixo |
| src/pages/VerMilitar.jsx | isOficial | postoGraduacao | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx | handleChange | quadroAtual | gravação | Baixo |
| src/pages/CadastrarMilitar.jsx | handleChange | quadroAtual | gravação | Baixo |
| src/pages/CadastrarMilitar.jsx | handleChange | quadroAtual | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx | handleChange | posto | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx | handleChange | posto | leitura | Baixo |
| src/pages/AntiguidadeImportarPromocoes.jsx | AntiguidadeImportarPromocoes | quadroAtual | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | AntiguidadeImportarPromocoes | quadroAtual | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | AntiguidadeImportarPromocoes | posto | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | AntiguidadeImportarPromocoes | quadroAtual | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | AntiguidadeImportarPromocoes | posto | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | atualizarCopiaOrdemPromocaoAnterior | posto | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | atualizarCopiaOrdemPromocaoAnterior | posto | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | atualizarCopiaOrdemPromocaoAnterior | posto | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx | atualizarCopiaOrdemPromocaoAnterior | posto | importação | Alto (Módulo Sensível) |
| src/pages/MigracaoAlteracoesLegado.jsx | MigracaoAlteracoesLegado | posto | leitura | Baixo |
| src/pages/ApuracaoMedalhasTempoServico.jsx | prioridade | posto | gravação | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx | prioridade | posto | leitura | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx | getCellState | posto | leitura | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx | getCellState | posto | gravação | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx | refreshQueries | posto | leitura | Alto (Módulo Sensível) |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | isPraca | postoGraduacao | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | isPraca | postoGraduacao | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | temRegraArt | postoGraduacao | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | temRegraArt | postoGraduacao | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | calcularComportamento | postoGraduacao | gravação | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | calcularComportamento | postoGraduacao | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts | calcularComportamento | postoGraduacao | gravação | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts | Global/Unknown | posto | leitura | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts | obterPostoCanonico | quadroAtual | gravação | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts | obterPostoCanonico | quadroAtual | leitura | Baixo |
| base44/functions/publicarPromocaoOficial/entry.ts | parseBase | posto_graduacao_atual | leitura | Baixo |
| base44/functions/publicarPromocaoOficial/entry.ts | parseBase | quadro_atual | leitura | Baixo |
| base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts | montarRegistroGratificacao | posto | leitura | Baixo |
| base44/functions/gerarRelatorioDpDintelAtestados/entry.ts | buildReportLines | postoGraduacao | gravação | Baixo |
| base44/functions/gerarRelatorioDpDintelAtestados/entry.ts | buildReportLines | postoGraduacao | leitura | Baixo |
| base44/functions/utils.ts | atualizarCadastroMilitar | posto | gravação | Baixo |
| base44/functions/utils.ts | atualizarCadastroMilitar | quadro_atual | gravação | Baixo |
| base44/functions/utils.ts | atualizarCadastroMilitar | posto | leitura | Baixo |
| base44/functions/registrarAuditoriaExportacaoEfetivo/entry.ts | Global/Unknown | postoGraduacao | exportação | Alto (Módulo Sensível) |
