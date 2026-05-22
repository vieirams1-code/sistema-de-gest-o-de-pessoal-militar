import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import {
  ImportacaoMilitares,
  ImportacaoAlteracoesLegado,
  PunicaoDisciplinar,
  ImpedimentoMedalha,
  CreditoExtraFerias,
  HistoricoPromocaoMilitarV2,
  Promocao,
  PromocaoMilitar,
  ResetOperacionalLog,
  BaseConhecimentoProcedimento,
  AssistenteLog,
  ProcedimentoProcesso,
  ProcedimentoEnvolvido,
  ProcedimentoPendencia,
  ProcedimentoViatura,
  ProcedimentoPrazoHistorico,
  FuncaoMilitar,
  MilitarFuncao,
  TagGrupo,
  Tag,
  MilitarTag,
  FeriasTag,
} from '@/api/entities'


// Mantém o módulo de entidades carregado no bundle para sincronização/publicação no runtime Base44.
void ImportacaoMilitares;
void ImportacaoAlteracoesLegado;
void PunicaoDisciplinar;
void ImpedimentoMedalha;
void CreditoExtraFerias;
void HistoricoPromocaoMilitarV2;
void Promocao;
void PromocaoMilitar;
void ResetOperacionalLog;
void BaseConhecimentoProcedimento;
void AssistenteLog;
void ProcedimentoProcesso;
void ProcedimentoEnvolvido;
void ProcedimentoPendencia;
void ProcedimentoViatura;
void ProcedimentoPrazoHistorico;
void FuncaoMilitar;
void MilitarFuncao;
void TagGrupo;
void Tag;
void MilitarTag;
void FeriasTag;

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
