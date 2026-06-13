# Relatório de Auditoria: Padronização de Posto/Graduação e Quadro

## 1. Sumário Executivo

Este relatório apresenta a auditoria técnica do uso de campos relacionados a posto/graduação e quadro na entidade Militar, visando a padronização para os campos canônicos `posto_graduacao` e `quadro`.

- **Total de ocorrências de aliases:** 559
- **Distribuição por Risco:**
  - Baixo: 366
  - Alto (Módulo Sensível): 193

## 2. Detalhamento por Finalidade

- **Leitura:** 334
- **Gravação:** 96
- **Importação:** 15
- **Templates/documentos:** 109
- **Filtro:** 4
- **Exportação:** 1

## 3. Lista Técnica de Ocorrências

| Arquivo | Função/Componente | Campo | Finalidade | Risco |
| :--- | :--- | :--- | :--- | :--- |
| src/services/militar360Service.js:39 | montarMilitar | `postoGraduacao` | leitura | Baixo |
| src/services/medalhasTempoServicoService.js:101 | isPracaComComportamentoInvalido | `posto` | gravação | Alto (Módulo Sensível) |
| src/services/medalhasTempoServicoService.js:228 | criarIndicacaoAutomatica | `posto` | leitura | Alto (Módulo Sensível) |
| src/services/historicoImportacoesMilitaresService.js:160 | normalizarLinha | `posto` | importação | Baixo |
| src/services/historicoImportacoesMilitaresService.js:471 | exportarCsvHistoricoHumano | `posto` | importação | Baixo |
| src/services/historicoImportacoesMilitaresService.js:486 | exportarCsvHistoricoHumano | `posto` | importação | Baixo |
| src/services/creditoExtraFeriasRules.js:20 | criarPayloadCreditoExtraFerias | `posto_grad` | leitura | Baixo |
| src/services/afastamentosVigentesService.js:66 | mapAtestadosVigentes | `postoGraduacao` | leitura | Baixo |
| src/services/afastamentosVigentesService.js:85 | mapFeriasVigentes | `postoGraduacao` | leitura | Baixo |
| src/services/afastamentosVigentesService.js:118 | mapRegistroLivroVigentes | `postoGraduacao` | leitura | Baixo |
| src/services/afastamentosVigentesService.js:145 | mapLtipVigentes | `postoGraduacao` | leitura | Baixo |
| src/services/migracaoAlteracoesLegadoService.js:86 | DESTINO_FINAL | `cargo` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:58 | isMilitarTemporarioParaControleAtestados | `quadro_atual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:59 | isMilitarTemporarioParaControleAtestados | `quadroAtual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:60 | isMilitarTemporarioParaControleAtestados | `militar_quadro` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:61 | isMilitarTemporarioParaControleAtestados | `quadro_militar` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:325 | montarMilitarBase | `quadro_atual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:326 | montarMilitarBase | `quadroAtual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:327 | montarMilitarBase | `militar_quadro` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:328 | montarMilitarBase | `militar_quadro` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:330 | montarMilitarBase | `quadro_atual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:331 | montarMilitarBase | `quadroAtual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:333 | montarMilitarBase | `quadro_atual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:334 | montarMilitarBase | `quadroAtual` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:353 | montarMilitarBase | `postoGraduacao` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:355 | montarMilitarBase | `postoGraduacao` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:356 | montarMilitarBase | `posto_grad` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:359 | montarMilitarBase | `posto` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:364 | montarMilitarBase | `postoGraduacao` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:365 | montarMilitarBase | `posto_grad` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:368 | montarMilitarBase | `posto` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:370 | montarMilitarBase | `postoGraduacao` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:371 | montarMilitarBase | `posto_grad` | leitura | Baixo |
| src/services/controleAtestadosTemporariosService.js:374 | montarMilitarBase | `posto` | leitura | Baixo |
| src/services/documentosMilitares/documentoMilitarVarsService.js:83 | montarVariaveisDocumentoMilitar | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarVarsService.js:84 | montarVariaveisDocumentoMilitar | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.test.js:31 | Global/Unknown | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.test.js:39 | Global/Unknown | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:23 | obterFuncaoSignatario | `cargo` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:52 | obterQuadroSignatario | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:70 | normalizarSignatarioMilitar | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:76 | normalizarSignatarioMilitar | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:81 | normalizarSignatarioMilitar | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:89 | montarLinhaIdentificacaoSignatario | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:91 | montarLinhaIdentificacaoSignatario | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:97 | montarAssinaturaSignatario | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:98 | montarAssinaturaSignatario | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:111 | montarVariaveisSignatarioDocumentoMilitar | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:115 | montarVariaveisSignatarioDocumentoMilitar | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:116 | montarVariaveisSignatarioDocumentoMilitar | `graduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:118 | montarVariaveisSignatarioDocumentoMilitar | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:124 | montarVariaveisSignatarioDocumentoMilitar | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/documentosMilitares/documentoMilitarSignatarioService.js:128 | montarVariaveisSignatarioDocumentoMilitar | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/services/migracaoMilitaresService.js:103 | __setMigracaoMilitaresClientForTests | `posto` | leitura | Baixo |
| src/services/migracaoMilitaresService.js:450 | mapQuadro | `postoGraduacao` | leitura | Baixo |
| src/services/migracaoMilitaresService.js:454 | mapQuadro | `postoGraduacao` | leitura | Baixo |
| src/services/migracaoMilitaresService.js:455 | mapQuadro | `posto` | leitura | Baixo |
| src/services/migracaoMilitaresService.js:1446 | compararCamposConferencia | `posto` | leitura | Baixo |
| src/services/promocaoService.js:28 | isPromocaoFormacaoTerceiroSargento | `postoGraduacao` | gravação | Baixo |
| src/services/promocaoService.js:29 | isPromocaoFormacaoTerceiroSargento | `postoGraduacao` | gravação | Baixo |
| src/services/promocaoService.js:30 | isPromocaoFormacaoTerceiroSargento | `postoGraduacao` | gravação | Baixo |
| src/services/promocaoService.js:42 | isPromocaoInicioCadeia | `posto` | gravação | Baixo |
| src/services/promocaoService.js:43 | isPromocaoInicioCadeia | `posto` | leitura | Baixo |
| src/services/promocaoService.js:67 | validarPublicacaoPromocaoBase | `posto` | leitura | Baixo |
| src/services/promocaoService.js:110 | validarPublicacaoPromocaoBase | `posto` | leitura | Baixo |
| src/services/promocaoService.js:130 | montarPayloadHistoricoPublicacao | `posto_graduacao_atual` | leitura | Baixo |
| src/services/promocaoService.js:131 | montarPayloadHistoricoPublicacao | `quadro_atual` | leitura | Baixo |
| src/services/promocaoService.js:170 | resolverHistoricoPublicacao | `posto` | leitura | Baixo |
| src/services/promocaoService.js:412 | restaurarCadastroMilitarDaPromocao | `quadroAtual` | gravação | Baixo |
| src/services/promocaoService.js:417 | restaurarCadastroMilitarDaPromocao | `quadroAtual` | leitura | Baixo |
| src/services/promocaoService.js:420 | restaurarCadastroMilitarDaPromocao | `posto` | leitura | Baixo |
| src/services/promocaoService.js:788 | postoGraduacaoBaseAnterior | `posto` | leitura | Baixo |
| src/services/promocaoService.js:807 | calcularInsercaoPorAntiguidadeAnterior | `posto` | leitura | Baixo |
| src/services/promocaoService.js:828 | calcularInsercaoPorAntiguidadeAnterior | `posto` | leitura | Baixo |
| src/services/promocaoService.js:869 | calcularInsercaoPorAntiguidadeAnterior | `posto` | leitura | Baixo |
| src/services/promocaoService.js:1007 | indicePostoGraduacao | `postoGraduacao` | leitura | Baixo |
| src/services/promocaoService.js:1008 | indicePostoGraduacao | `postoGraduacao` | gravação | Baixo |
| src/services/promocaoService.js:1009 | indicePostoGraduacao | `posto` | leitura | Baixo |
| src/services/promocaoService.js:1022 | ordenarPromocoes | `posto` | gravação | Baixo |
| src/services/promocaoService.js:1023 | ordenarPromocoes | `posto` | leitura | Baixo |
| src/services/promocaoService.js:1066 | avaliarCompatibilidadePromocao | `posto` | leitura | Baixo |
| src/services/promocaoService.js:1118 | motivosBloqueioVinculoProvavel | `posto` | leitura | Baixo |
| src/services/__tests__/creditoExtraFeriasService.test.js:25 | Global/Unknown | `posto_grad` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:134 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:261 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:450 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:997 | rejeitaSemEscrita | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:1002 | rejeitaSemEscrita | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:1083 | rejeitaSemEscrita | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:1103 | rejeitaSemEscrita | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoService.test.js:1261 | detalleSemEspacos | `posto` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:34 | normalizar | `posto` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:66 | obterPostoCanonico | `quadroAtual` | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:71 | obterPostoCanonico | `quadroAtual` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:73 | obterPostoCanonico | `posto` | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:102 | obterPostoCanonico | `posto_graduacao_atual` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:103 | obterPostoCanonico | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:111 | obterPostoCanonico | `posto` | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:112 | obterPostoCanonico | `militar_quadro` | gravação | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:127 | obterPostoCanonico | `posto_graduacao_atual` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:129 | obterPostoCanonico | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/sincronizacaoPromocaoRafael.test.js:130 | obterPostoCanonico | `posto` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:212 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:223 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:237 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:248 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:255 | criarAnalise | `posto` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:259 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:260 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:266 | criarAnalise | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:274 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:289 | criarAnalise | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:298 | criarAnalise | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:314 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:323 | criarAnalise | `posto_grad` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:324 | criarAnalise | `quadro_atual` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:333 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:355 | criarAnalise | `postoGraduacao` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:366 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:402 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/controleAtestadosTemporariosService.test.js:420 | criarAnalise | `militar_quadro` | leitura | Baixo |
| src/services/__tests__/globalMilitarSearchService.test.js:49 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoRegressaoIntegrada.test.js:39 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/promocaoRegressaoIntegrada.test.js:106 | Global/Unknown | `posto` | leitura | Baixo |
| src/services/__tests__/militar360Service.test.js:54 | Global/Unknown | `posto` | gravação | Baixo |
| src/components/dashboard/AfastamentosVigentesPanel.jsx:197 | AfastamentoRow | `postoGraduacao` | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js:3 | Global/Unknown | `postoGraduacao` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js:42 | Global/Unknown | `posto` | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js:45 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js:46 | Global/Unknown | `posto` | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.test.js:55 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:31 | abreviarPostoGraduacao | `postoGraduacao` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:32 | abreviarPostoGraduacao | `postoGraduacao` | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:47 | abreviarPostoGraduacao | `posto` | gravação | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:48 | abreviarPostoGraduacao | `posto` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:55 | montarLinhaAssinatura | `postoGraduacao` | leitura | Baixo |
| src/components/folha-alteracoes/postoGraduacao.js:57 | montarLinhaAssinatura | `postoGraduacao` | gravação | Baixo |
| src/components/folha-alteracoes/folhaAlteracoesHistorico.test.js:139 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/folha-alteracoes/folhaAlteracoesHistorico.test.js:156 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/migracao-militares/TabelaLinhasImportacaoMilitares.jsx:48 | TabelaLinhasImportacaoMilitares | `posto` | importação | Baixo |
| src/components/militar/MilitarTagsBulkPanel.jsx:207 | toggleTag | `posto_grad` | filtro | Baixo |
| src/components/militar/NomeMilitar.jsx:4 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx:106 | destacarNomeGuerra | `posto` | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx:112 | NomeMilitar | `posto` | gravação | Baixo |
| src/components/militar/NomeMilitar.jsx:113 | NomeMilitar | `posto` | gravação | Baixo |
| src/components/militar/NomeMilitar.jsx:125 | NomeMilitar | `posto` | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx:128 | formatNomeMilitarTexto | `posto` | leitura | Baixo |
| src/components/militar/NomeMilitar.jsx:129 | formatNomeMilitarTexto | `posto` | gravação | Baixo |
| src/components/militar/MapaDeLotacao.jsx:122 | MilitarCompactCard | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:39 | getPostoIndex | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:40 | getPostoIndex | `posto` | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:62 | MilitaresDistribuicaoView | `posto` | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:75 | MilitaresDistribuicaoView | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:76 | MilitaresDistribuicaoView | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:77 | MilitaresDistribuicaoView | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:82 | MilitaresDistribuicaoView | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:150 | togglePosto | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:151 | togglePosto | `posto` | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:158 | togglePosto | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:163 | togglePosto | `posto` | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:164 | togglePosto | `posto` | gravação | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:167 | togglePosto | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:168 | togglePosto | `posto` | leitura | Baixo |
| src/components/militar/MilitaresDistribuicaoView.jsx:174 | togglePosto | `posto` | leitura | Baixo |
| src/components/militar/GlobalMilitarSearch.jsx:314 | renderResultCard | `posto` | gravação | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx:33 | Global/Unknown | `postoGraduacao` | leitura | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx:169 | formatarMilitarPrincipal | `posto` | gravação | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx:174 | formatarMilitarPrincipal | `posto` | filtro | Baixo |
| src/components/ferias/PeriodoAquisitivoGenerator.jsx:408 | registrarBloqueio | `posto` | gravação | Baixo |
| src/components/utils/templateUtils.js:64 | aplicarTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:109 | buildVarsLivro | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:111 | buildVarsLivro | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:125 | buildVarsLivro | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:128 | buildVarsLivro | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:154 | buildPreviewTemplateVars | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:177 | buildPreviewTemplateVars | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/components/utils/templateUtils.js:188 | buildPreviewTemplateVars | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:190 | buildPreviewTemplateVars | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:199 | buildPreviewTemplateVars | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.js:202 | buildPreviewTemplateVars | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:9 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:16 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:20 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:28 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:113 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:131 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:145 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:147 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:148 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:149 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:152 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:153 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:154 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:158 | Global/Unknown | `qbmp` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:159 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.test.js:162 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:17 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:28 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:30 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:38 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:67 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:71 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:77 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:86 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:93 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:97 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:118 | Global/Unknown | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/components/utils/templateUtils.test.js:129 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:137 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:159 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:183 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:190 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:194 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateUtils.test.js:202 | Global/Unknown | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:17 | abreviarPosto | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:18 | abreviarPosto | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:19 | abreviarPosto | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:26 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:27 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:29 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:30 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:32 | resolveQuadroTemplate | `quadro_atual` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:34 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:36 | resolveQuadroTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:47 | normalizarPostoTemplate | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:49 | montarPostoNomeTemplate | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:50 | montarPostoNomeTemplate | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:68 | buildTemplateVarsContrato | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:69 | buildTemplateVarsContrato | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:70 | buildTemplateVarsContrato | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:73 | buildTemplateVarsContrato | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:112 | buildTemplateVarsContrato | `posto` | templates/documentos | Baixo |
| src/components/utils/templateContratoUtils.js:116 | buildTemplateVarsContrato | `militar_quadro` | templates/documentos | Baixo |
| src/components/livro/livroRegistrosMapper.js:288 | mapMilitar | `militar_quadro` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/RankIcon.jsx:3 | normalizeRank | `rank` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/RankIcon.jsx:12 | RankIcon | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/RankIcon.jsx:35 | getIconProps | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx:23 | PromocaoFuturaModal | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx:42 | PromocaoFuturaModal | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoFuturaModal.jsx:54 | PromocaoFuturaModal | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:23 | InsigniaBox | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:25 | InsigniaBox | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:73 | PromocaoAtualCard | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:102 | PromocaoAnteriorItem | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:107 | PromocaoAnteriorItem | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:110 | PromocaoAnteriorItem | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocoesTimeline.jsx:134 | PromocoesTimeline | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.test.js:137 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.test.js:164 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:35 | indicePosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:70 | resolverQuadroPromocao | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:78 | resolverQuadroPromocao | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:164 | resolverQuadroPromocaoFutura | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:168 | resolverQuadroPromocaoFutura | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:219 | resolverQuadroAnteriorPromocaoColetiva | `quadroAtual` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:220 | resolverQuadroAnteriorPromocaoColetiva | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:297 | validarLinhaPromocaoColetiva | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:298 | validarLinhaPromocaoColetiva | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:317 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:318 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:320 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:327 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:328 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:330 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/promocaoHistoricaUtils.js:331 | mesmoAtoDataPostoQuadro | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:51 | onSelectPosto | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:67 | onSelectPosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:73 | onSelectPosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:84 | onSelectPosto | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:97 | onSelectPosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:146 | onSelectPosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoHistoricaModal.jsx:163 | onSelectPosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx:218 | abrirPromocaoOrigem | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx:226 | abrirPromocaoOrigem | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx:262 | abrirPromocaoOrigem | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/CarreiraAntiguidadePanel.jsx:270 | abrirPromocaoOrigem | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx:127 | PromocaoAtualModal | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx:176 | PromocaoAtualModal | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx:198 | PromocaoAtualModal | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/antiguidade/PromocaoAtualModal.jsx:210 | PromocaoAtualModal | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:71 | obterPostoExibicaoMilitar | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:72 | obterPostoExibicaoMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:73 | obterPostoExibicaoMilitar | `graduacao` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:114 | militarPassaFiltroModal | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:179 | LinhaMilitarEfetivo | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:189 | LinhaMilitarEfetivo | `posto` | filtro | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:278 | ModalEfetivoUnidade | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:461 | separarMilitaresLista | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:464 | separarMilitaresLista | `posto` | leitura | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:473 | ListaPersonCard | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/efetivo-gestor/VisualizacoesGestor.jsx:479 | ListaPersonCard | `posto` | gravação | Alto (Módulo Sensível) |
| src/components/rp/templateValidation.test.js:10 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.test.js:112 | Global/Unknown | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.test.js:155 | aplicarTemplateLocal | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:338 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:344 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:357 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:365 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:378 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:385 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:399 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:404 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:414 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:424 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:434 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:447 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:453 | normalizarEscopoTemplate | `militar_quadro` | templates/documentos | Baixo |
| src/components/rp/templateValidation.js:455 | normalizarEscopoTemplate | `posto` | templates/documentos | Baixo |
| src/components/documentosMilitares/DocumentoMilitarPreview.jsx:55 | DocumentoMilitarPreview | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/components/documentosMilitares/DocumentoMilitarPreview.jsx:62 | DocumentoMilitarPreview | `postoGraduacao` | templates/documentos | Alto (Módulo Sensível) |
| src/components/admin/SaneamentoPromocaoDivergenteDialog.jsx:47 | SaneamentoPromocaoDivergenteDialog | `posto` | leitura | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx:11 | Global/Unknown | `posto` | leitura | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx:30 | handleMilitarSelect | `posto` | gravação | Baixo |
| src/components/migracao-alteracoes-legado/SelecaoMilitarDestino.jsx:66 | handleMilitarSelect | `posto` | leitura | Baixo |
| src/components/funcoes-tags/IconeCatalogo.jsx:32 | CATEGORIAS_ICONE | `graduacao` | leitura | Baixo |
| src/hooks/central-pendencias/useCentralPendencias.js:45 | mapPromocoesPrevistasPendentes | `posto_graduacao_atual` | gravação | Baixo |
| src/hooks/central-pendencias/useCentralPendencias.js:46 | mapPromocoesPrevistasPendentes | `posto_grad` | gravação | Baixo |
| src/utils/promocao/ordenacaoPromocao.js:75 | ordenarPorAntiguidadeAnterior | `posto` | gravação | Baixo |
| src/utils/promocao/ordenacaoPromocao.js:77 | ordenarPorAntiguidadeAnterior | `posto` | leitura | Baixo |
| src/utils/promocao/buildPromocaoContext.js:7 | isPostoDestinoPromocaoInicial | `postoGraduacao` | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js:8 | isPostoDestinoPromocaoInicial | `postoGraduacao` | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js:50 | buildPromocaoContext | `posto` | gravação | Baixo |
| src/utils/promocao/buildPromocaoContext.js:52 | buildPromocaoContext | `posto` | gravação | Baixo |
| src/utils/promocao/__tests__/ordenacaoPromocao.test.js:20 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/promocao/__tests__/buildPromocaoContext.test.js:56 | basePromocao | `posto` | leitura | Baixo |
| src/utils/promocao/__tests__/deveAtualizarCadastroMilitarPorPromocao.test.js:29 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/inconsistenciasCadastrais.js:25 | listarInconsistenciasCadastraisMilitar | `posto` | leitura | Baixo |
| src/utils/antiguidade/importarPromocoes.js:13 | STATUS | `quadro_atual` | importação | Alto (Módulo Sensível) |
| src/utils/antiguidade/importarPromocoes.js:23 | gerarPreviaImportacao | `quadro_atual` | importação | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js:111 | normalizarTextoPreviaAntiguidade | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js:114 | normalizarTextoPreviaAntiguidade | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js:313 | isPostoQuadroIncompativel | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js:314 | isPostoQuadroIncompativel | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/calcularPreviaAntiguidadeGeral.js:412 | montarCadeiaAntiguidadeMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js:14 | obterHistoricoAtivoMaisRecenteCompativel | `quadroAtual` | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js:22 | obterHistoricoAtivoMaisRecenteCompativel | `quadroAtual` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js:35 | validarDadosAntiguidade | `postoGraduacao` | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/validarDadosAntiguidade.js:38 | validarDadosAntiguidade | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js:13 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js:65 | ordenarMilitaresPorAntiguidadeInstitucional | `posto` | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/ordenacaoMilitarInstitucional.js:66 | ordenarMilitaresPorAntiguidadeInstitucional | `posto` | gravação | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:32 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:143 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:158 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:336 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:451 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/calcularPreviaAntiguidadeGeral.test.js:473 | promocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/selecionarPromocaoAtual.test.js:7 | historico | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/antiguidade/__tests__/selecionarPromocaoAtual.test.js:10 | historico | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/militarPostoGraduacao.js:5 | getPostoGraduacaoOficial | `posto_grad` | leitura | Baixo |
| src/utils/militarPostoGraduacao.js:6 | getPostoGraduacaoOficial | `posto` | leitura | Baixo |
| src/utils/militarPostoGraduacao.js:7 | getPostoGraduacaoOficial | `graduacao` | leitura | Baixo |
| src/utils/militarPostoGraduacao.js:13 | normalizarPostoGraduacaoMilitar | `postoGraduacao` | gravação | Baixo |
| src/utils/militarPostoGraduacao.js:14 | normalizarPostoGraduacaoMilitar | `postoGraduacao` | leitura | Baixo |
| src/utils/militarPostoGraduacao.js:15 | normalizarPostoGraduacaoMilitar | `postoGraduacao` | leitura | Baixo |
| src/utils/militarPostoGraduacao.js:18 | normalizarPostoGraduacaoMilitar | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:99 | isPraca | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:100 | isPraca | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:153 | temRegraArt | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:154 | temRegraArt | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:202 | calcularComportamento | `postoGraduacao` | gravação | Baixo |
| src/utils/calcularComportamento.js:203 | calcularComportamento | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:209 | calcularComportamento | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:233 | calcularComportamento | `postoGraduacao` | gravação | Baixo |
| src/utils/calcularComportamento.js:303 | calcularProximaMelhoria | `postoGraduacao` | gravação | Baixo |
| src/utils/calcularComportamento.js:304 | calcularProximaMelhoria | `postoGraduacao` | leitura | Baixo |
| src/utils/calcularComportamento.js:307 | calcularProximaMelhoria | `postoGraduacao` | gravação | Baixo |
| src/utils/calcularComportamento.js:326 | calcularProximaMelhoria | `postoGraduacao` | gravação | Baixo |
| src/utils/rp/rpVarsService.js:88 | montarVariaveisTemplateRP | `posto` | gravação | Baixo |
| src/utils/rp/rpVarsService.js:93 | montarVariaveisTemplateRP | `quadro_atual` | leitura | Baixo |
| src/utils/rp/rpVarsService.js:114 | montarVariaveisTemplateRP | `militar_quadro` | leitura | Baixo |
| src/utils/rp/rpVarsService.js:138 | montarVariaveisTemplateRP | `posto` | leitura | Baixo |
| src/utils/rp/rpVarsService.js:143 | montarVariaveisTemplateRP | `militar_quadro` | leitura | Baixo |
| src/utils/funcoesTags/decoracaoInstitucionalMilitar.js:88 | ordenarComDestaqueInstitucional | `rank` | leitura | Baixo |
| src/utils/funcoesTags/decoracaoInstitucionalMilitar.js:89 | ordenarComDestaqueInstitucional | `rank` | leitura | Baixo |
| src/utils/funcoesTags/__tests__/destaqueInstitucionalEfetivo.test.js:5 | Global/Unknown | `rank` | leitura | Alto (Módulo Sensível) |
| src/utils/postoQuadroCompatibilidade.js:61 | normalizarTexto | `posto` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:64 | classificarPostoGraduacao | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:65 | classificarPostoGraduacao | `postoGraduacao` | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js:72 | isPostoOficial | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:73 | isPostoOficial | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:76 | isPostoPraca | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:77 | isPostoPraca | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:80 | getQuadrosCompativeis | `postoGraduacao` | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js:81 | getQuadrosCompativeis | `postoGraduacao` | gravação | Baixo |
| src/utils/postoQuadroCompatibilidade.js:103 | isQuadroCompativel | `postoGraduacao` | leitura | Baixo |
| src/utils/postoQuadroCompatibilidade.js:106 | isQuadroCompativel | `postoGraduacao` | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js:63 | removerQuadroAnexado | `qbmp` | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js:138 | removerQuadroAnexado | `posto` | leitura | Baixo |
| src/utils/postoGraduacaoHierarquia.js:200 | getSugestaoAtualizacaoCadastro | `posto_graduacao_atual` | gravação | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:15 | Global/Unknown | `posto_grad` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:16 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:17 | Global/Unknown | `graduacao` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:24 | Global/Unknown | `posto_grad` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:25 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:26 | Global/Unknown | `graduacao` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:36 | Global/Unknown | `posto_grad` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:39 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:48 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:52 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:53 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:62 | Global/Unknown | `rank` | leitura | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:74 | Global/Unknown | `posto` | gravação | Baixo |
| src/utils/__tests__/militarPostoGraduacao.test.js:78 | Global/Unknown | `posto` | leitura | Baixo |
| src/utils/__tests__/postoGraduacaoHierarquia.test.js:106 | sugestao | `posto` | leitura | Baixo |
| src/utils/__tests__/postoGraduacaoHierarquia.test.js:112 | sugestao | `posto` | leitura | Baixo |
| src/utils/efetivo/gestorClassificacao.js:1 | resolvePostoGraduacao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:62 | obterGrupoHierarquicoMilitar | `posto` | gravação | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:65 | obterGrupoHierarquicoMilitar | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:66 | obterGrupoHierarquicoMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:67 | obterGrupoHierarquicoMilitar | `graduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:72 | obterGrupoHierarquicoMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:73 | obterGrupoHierarquicoMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:74 | obterGrupoHierarquicoMilitar | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/montarArvoreLotacaoMilitares.js:137 | obterPostoGraduacao | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:28 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:29 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:35 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:36 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:42 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:43 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:49 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:50 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:57 | Global/Unknown | `graduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:58 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:59 | Global/Unknown | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:72 | Global/Unknown | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:75 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:78 | Global/Unknown | `graduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:83 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:84 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:85 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:92 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:97 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:98 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:99 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:100 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:101 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:125 | Global/Unknown | `graduacao` | leitura | Alto (Módulo Sensível) |
| src/utils/efetivo/__tests__/montarArvoreLotacaoMilitares.test.js:141 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:330 | compareCampoEfetivo | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:421 | buildFiltrosSanitizadosAuditoria | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:480 | buildFetchMilitaresPayload | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:481 | buildFetchMilitaresPayload | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:648 | resetSelectedColumns | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:909 | carregar | `posto` | gravação | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:922 | carregar | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:925 | carregar | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/ExtracaoEfetivo.jsx:928 | carregar | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:31 | pluralizePosto | `posto` | gravação | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:32 | pluralizePosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:33 | pluralizePosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:34 | pluralizePosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:35 | pluralizePosto | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:89 | buildResumoListagem | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:93 | buildResumoListagem | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:94 | buildResumoListagem | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:101 | buildResumoListagem | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:164 | buildListagemTokens | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:204 | getOptionCareer | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/components/CommandCenter.jsx:649 | CommandCenter | `posto` | gravação | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/catalogoCamposEfetivo.js:50 | EXTRACAO_EFETIVO_FIELDS | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/extracaoEfetivo/__tests__/catalogoCamposEfetivo.test.js:34 | Global/Unknown | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/ControleAtestadosTemporarios.jsx:49 | AnaliseTableRow | `postoGraduacao` | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx:79 | getPostoGraduacaoAtestado | `posto` | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx:80 | getPostoGraduacaoAtestado | `graduacao` | leitura | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx:719 | atualizarEncaminhamentoNoCache | `postoGraduacao` | gravação | Baixo |
| src/pages/ExtratoAtestadosMedicos.jsx:731 | atualizarEncaminhamentoNoCache | `postoGraduacao` | gravação | Baixo |
| src/pages/AntiguidadePrevia.jsx:25 | Global/Unknown | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx:63 | Global/Unknown | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx:327 | AntiguidadePrevia | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx:522 | alternarLinha | `postoGraduacao` | leitura | Alto (Módulo Sensível) |
| src/pages/AntiguidadePrevia.jsx:526 | alternarLinha | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/IndicacoesDomPedroII.jsx:177 | prioridade | `posto` | leitura | Baixo |
| src/pages/IndicacoesDomPedroII.jsx:186 | prioridade | `posto` | gravação | Baixo |
| src/pages/Medalhas.jsx:234 | handleConfirmarExcluirMedalha | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/consultaMilitar/gestorHelpers.test.js:9 | Global/Unknown | `posto_grad` | leitura | Baixo |
| src/pages/consultaMilitar/consultaMilitarColumns.js:82 | CONSULTA_MILITAR_COLUNAS_ALLOWLIST | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:168 | diagnosticarCriacaoPromocao | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:222 | montarRastreamento | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:259 | montarRastreamento | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:367 | PainelMilitares | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:646 | confirmarCriacaoPromocao | `posto` | leitura | Baixo |
| src/pages/RastreamentoPromocoes.jsx:711 | confirmarCriacaoPromocao | `posto` | gravação | Baixo |
| src/pages/RastreamentoPromocoes.jsx:753 | confirmarCriacaoPromocao | `posto` | gravação | Baixo |
| src/pages/RastreamentoPromocoes.jsx:1065 | confirmarCriacaoPromocao | `posto` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:244 | MilitarCard | `posto` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:245 | MilitarCard | `quadro_atual` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:284 | MilitarCard | `posto` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:492 | DetalhePromocao | `posto_graduacao_atual` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:496 | DetalhePromocao | `quadro_atual` | leitura | Baixo |
| src/pages/DetalhePromocao.jsx:508 | DetalhePromocao | `posto` | leitura | Baixo |
| src/pages/DetalhePromocao.jsx:855 | confirmarExclusaoPromocao | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/DetalhePromocao.jsx:885 | confirmarExclusaoPromocao | `posto` | leitura | Baixo |
| src/pages/DetalhePromocao.jsx:1081 | confirmarPublicacaoPromocao | `posto` | gravação | Baixo |
| src/pages/DetalhePromocao.jsx:1085 | confirmarPublicacaoPromocao | `posto` | leitura | Baixo |
| src/pages/DetalhePromocao.jsx:1254 | confirmarPublicacaoPromocao | `quadro_atual` | leitura | Baixo |
| src/pages/DetalhePromocao.jsx:1311 | confirmarPublicacaoPromocao | `posto` | leitura | Baixo |
| src/pages/TemplatesTexto.jsx:245 | isTipoOcultoNoFrontend | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:265 | isTipoOcultoNoFrontend | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:285 | isTipoOcultoNoFrontend | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:304 | isTipoOcultoNoFrontend | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:323 | isTipoOcultoNoFrontend | `militar_quadro` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:677 | isTipoOcultoNoFrontend | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/TemplatesTexto.jsx:693 | isTipoOcultoNoFrontend | `posto` | templates/documentos | Alto (Módulo Sensível) |
| src/pages/FolhaAlteracoes.jsx:16 | Global/Unknown | `postoGraduacao` | leitura | Baixo |
| src/pages/CreditosExtraordinariosFerias.jsx:226 | CreditosExtraordinariosFerias | `posto_grad` | leitura | Baixo |
| src/pages/CreditosExtraordinariosFerias.jsx:653 | toggleMilitar | `posto` | gravação | Baixo |
| src/pages/Publicacoes.jsx:110 | montarNomeInstitucional | `postoGraduacao` | leitura | Baixo |
| src/pages/Publicacoes.jsx:111 | montarNomeInstitucional | `postoGraduacao` | filtro | Baixo |
| src/pages/Publicacoes.jsx:189 | normalizarRegistro | `postoGraduacao` | gravação | Baixo |
| src/pages/Publicacoes.jsx:191 | normalizarRegistro | `posto` | leitura | Baixo |
| src/pages/Publicacoes.jsx:192 | normalizarRegistro | `posto` | leitura | Baixo |
| src/pages/Publicacoes.jsx:196 | normalizarRegistro | `militar_quadro` | leitura | Alto (Módulo Sensível) |
| src/pages/Publicacoes.jsx:197 | normalizarRegistro | `militar_quadro` | leitura | Baixo |
| src/pages/Publicacoes.jsx:247 | normalizarRegistro | `postoGraduacao` | leitura | Baixo |
| src/pages/Publicacoes.jsx:248 | normalizarRegistro | `militar_quadro` | leitura | Baixo |
| src/pages/Publicacoes.jsx:249 | normalizarRegistro | `postoGraduacao` | leitura | Baixo |
| src/pages/Militares.jsx:78 | Global/Unknown | `graduacao` | leitura | Baixo |
| src/pages/VerMilitar.jsx:104 | isOficial | `postoGraduacao` | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx:213 | handleChange | `quadroAtual` | gravação | Baixo |
| src/pages/CadastrarMilitar.jsx:214 | handleChange | `quadroAtual` | gravação | Baixo |
| src/pages/CadastrarMilitar.jsx:222 | handleChange | `quadroAtual` | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx:232 | handleChange | `posto` | leitura | Baixo |
| src/pages/CadastrarMilitar.jsx:267 | handleChange | `posto` | leitura | Baixo |
| src/pages/AntiguidadeImportarPromocoes.jsx:131 | AntiguidadeImportarPromocoes | `quadroAtual` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:132 | AntiguidadeImportarPromocoes | `quadroAtual` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:133 | AntiguidadeImportarPromocoes | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:134 | AntiguidadeImportarPromocoes | `quadroAtual` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:135 | AntiguidadeImportarPromocoes | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:369 | atualizarCopiaOrdemPromocaoAnterior | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:384 | atualizarCopiaOrdemPromocaoAnterior | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:402 | atualizarCopiaOrdemPromocaoAnterior | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/AntiguidadeImportarPromocoes.jsx:430 | atualizarCopiaOrdemPromocaoAnterior | `posto` | importação | Alto (Módulo Sensível) |
| src/pages/MigracaoAlteracoesLegado.jsx:188 | MigracaoAlteracoesLegado | `posto` | leitura | Baixo |
| src/pages/ApuracaoMedalhasTempoServico.jsx:221 | prioridade | `posto` | gravação | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx:226 | prioridade | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx:285 | getCellState | `posto` | leitura | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx:295 | getCellState | `posto` | gravação | Alto (Módulo Sensível) |
| src/pages/ApuracaoMedalhasTempoServico.jsx:511 | refreshQueries | `posto` | leitura | Alto (Módulo Sensível) |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:191 | isPraca | `postoGraduacao` | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:192 | isPraca | `postoGraduacao` | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:262 | temRegraArt | `postoGraduacao` | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:263 | temRegraArt | `postoGraduacao` | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:321 | calcularComportamento | `postoGraduacao` | gravação | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:322 | calcularComportamento | `postoGraduacao` | leitura | Baixo |
| base44/functions/verificarComportamentoDisciplinarDryRun/entry.ts:335 | calcularComportamento | `postoGraduacao` | gravação | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts:20 | Global/Unknown | `posto` | leitura | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts:178 | obterPostoCanonico | `quadroAtual` | gravação | Baixo |
| base44/functions/sincronizarGraduacoesPromocao/entry.ts:183 | obterPostoCanonico | `quadroAtual` | leitura | Baixo |
| base44/functions/publicarPromocaoOficial/entry.ts:155 | parseBase | `posto_graduacao_atual` | leitura | Baixo |
| base44/functions/publicarPromocaoOficial/entry.ts:156 | parseBase | `quadro_atual` | leitura | Baixo |
| base44/functions/gerirRascunhoGratificacaoFuncao/entry.ts:175 | montarRegistroGratificacao | `posto` | leitura | Baixo |
| base44/functions/gerarRelatorioDpDintelAtestados/entry.ts:158 | buildReportLines | `postoGraduacao` | gravação | Baixo |
| base44/functions/gerarRelatorioDpDintelAtestados/entry.ts:170 | buildReportLines | `postoGraduacao` | leitura | Baixo |
| base44/functions/utils.ts:38 | atualizarCadastroMilitar | `posto` | gravação | Baixo |
| base44/functions/utils.ts:39 | atualizarCadastroMilitar | `militar_quadro` | gravação | Baixo |
| base44/functions/utils.ts:91 | atualizarCadastroMilitar | `posto` | leitura | Baixo |
| base44/functions/registrarAuditoriaExportacaoEfetivo/entry.ts:39 | Global/Unknown | `postoGraduacao` | exportação | Alto (Módulo Sensível) |
