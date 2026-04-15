import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { ImportacaoMilitares, ImportacaoAtestados, ImportacaoAlteracoesLegado, PunicaoDisciplinar } from '@/api/entities'
import { base44 } from '@/api/base44Client'


// Mantém o módulo de entidades carregado no bundle para sincronização/publicação no runtime Base44.
void ImportacaoMilitares;
void ImportacaoAtestados;
void ImportacaoAlteracoesLegado;
void PunicaoDisciplinar;
void base44.entities.ImportacaoMilitares;
void base44.entities.ImportacaoAtestados;
void base44.entities.ImportacaoAlteracoesLegado;
void base44.entities.PunicaoDisciplinar;

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

