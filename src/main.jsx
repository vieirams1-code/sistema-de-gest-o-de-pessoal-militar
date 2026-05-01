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
  HistoricoPromocao,
  ResetOperacionalLog,
  BaseConhecimentoProcedimento,
  AssistenteLog,
  ProcedimentoProcesso,
  ProcedimentoEnvolvido,
  ProcedimentoPendencia,
  ProcedimentoViatura,
  ProcedimentoPrazoHistorico,
} from '@/api/entities'
import { base44 } from '@/api/base44Client'


// Mantém o módulo de entidades carregado no bundle para sincronização/publicação no runtime Base44.
void ImportacaoMilitares;
void ImportacaoAlteracoesLegado;
void PunicaoDisciplinar;
void ImpedimentoMedalha;
void CreditoExtraFerias;
void HistoricoPromocao;
void ResetOperacionalLog;
void BaseConhecimentoProcedimento;
void AssistenteLog;
void ProcedimentoProcesso;
void ProcedimentoEnvolvido;
void ProcedimentoPendencia;
void ProcedimentoViatura;
void ProcedimentoPrazoHistorico;
void base44.entities.ImportacaoMilitares;
void base44.entities.ImportacaoAlteracoesLegado;
void base44.entities.PunicaoDisciplinar;
void base44.entities.ImpedimentoMedalha;
void base44.entities.CreditoExtraFerias;
void base44.entities.HistoricoPromocao;
void base44.entities.ResetOperacionalLog;
void base44.entities.BaseConhecimentoProcedimento;
void base44.entities.AssistenteLog;
void base44.entities.ProcedimentoProcesso;
void base44.entities.ProcedimentoEnvolvido;
void base44.entities.ProcedimentoPendencia;
void base44.entities.ProcedimentoViatura;
void base44.entities.ProcedimentoPrazoHistorico;

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
