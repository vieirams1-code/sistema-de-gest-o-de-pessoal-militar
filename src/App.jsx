import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import RequireAdmin from '@/components/auth/RequireAdmin';
import RequireModuleAccess from '@/components/auth/RequireModuleAccess';

const { Pages, Layout } = pagesConfig;
const homeRoute = '/VerMilitar';

const adminOnlyPages = new Set([
  // Exceção temporária: Mantido em admin puro (RequireAdmin) até a criação
  // de uma action key específica na arquitetura (ex: gerir_solicitacoes_atualizacao).
  'SolicitacoesAtualizacao',
  'Subgrupamentos',
  'HistoricoImportacoesMilitares',
  'MigracaoAlteracoesLegado',
]);


const moduleGuardByPage = {
  Home: { moduleKey: 'militares', moduleName: 'Dashboard' },
  AgendarJISO: { moduleKey: 'atestados', moduleName: 'Atestados' },
  AgendaJISO: { moduleKey: 'atestados', moduleName: 'Atestados' }, // alias legado
  EditarJISO: { moduleKey: 'atestados', moduleName: 'Atestados' },
  EditarJiso: { moduleKey: 'atestados', moduleName: 'Atestados' }, // alias legado
  Atestados: { moduleKey: 'atestados', moduleName: 'Atestados' },
  CadastrarAtestado: { moduleKey: 'atestados', moduleName: 'Atestados' },
  VerAtestado: { moduleKey: 'atestados', moduleName: 'Atestados' },
  Ferias: { moduleKey: 'ferias', moduleName: 'Férias' },
  Militares: { moduleKey: 'militares', moduleName: 'Efetivo' },
  Armamentos: { moduleKey: 'armamentos', moduleName: 'Armamentos' },
  Medalhas: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  ApuracaoMedalhasTempoServico: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  CadastrarPublicacao: { moduleKey: 'publicacoes', moduleName: 'Controle de Publicações' },
  Publicacoes: { moduleKey: 'publicacoes', moduleName: 'Controle de Publicações' },
  QuadroOperacional: { moduleKey: 'quadro_operacional', moduleName: 'Quadro Operacional' },
  AgendaAcoesOperacionais: { moduleKey: 'quadro_operacional', moduleName: 'Quadro Operacional' },
  LotacaoMilitares: { moduleKey: 'militares', moduleName: 'Efetivo' },
  EstruturaOrganizacional: { moduleKey: 'militares', moduleName: 'Efetivo' },
  CadastrarArmamento: { moduleKey: 'armamentos', moduleName: 'Armamentos' },
  CadastrarMilitar: { moduleKey: 'militares', moduleName: 'Efetivo' },
  FichaMilitar: { moduleKey: 'militares', moduleName: 'Efetivo' },
  CadastrarFerias: { moduleKey: 'ferias', moduleName: 'Férias' },
  PeriodosAquisitivos: { moduleKey: 'ferias', moduleName: 'Férias' },
  CadastrarRegistroLivro: { moduleKey: 'livro', moduleName: 'Livro de Registros' },
  Livro: { moduleKey: 'livro', moduleName: 'Livro de Registros' },
  RP: { moduleKey: 'livro', moduleName: 'Registro de Publicações' },
  CadastrarRegistroRP: { moduleKey: 'livro', moduleName: 'Registro de Publicações' },
  AvaliacaoComportamento: { moduleKey: 'militares', moduleName: 'Efetivo' },
  DetalheComportamento: { moduleKey: 'militares', moduleName: 'Efetivo' },
  FolhaAlteracoes: { moduleKey: 'folha_alteracoes', moduleName: 'Folha de Alterações' },
  CadastrarMedalha: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  CadastrarPunicao: { moduleKey: 'militares', moduleName: 'Efetivo' },
  RegistrosMilitar: { moduleKey: 'militares', moduleName: 'Registros do Militar' },
  TiposMedalha: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  Configuracoes: { moduleKey: 'configuracoes', moduleName: 'Configurações' },
  ConciliacaoBoletim: { moduleKey: 'publicacoes', moduleName: 'Controle de Publicações' },
};

const moduleGuardByPageNormalized = Object.entries(moduleGuardByPage).reduce((acc, [pageKey, guard]) => {
  acc[pageKey.toLowerCase()] = guard;
  return acc;
}, {});

const getModuleGuardByPage = (pageKey) => moduleGuardByPageNormalized[pageKey.toLowerCase()] || null;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <Navigate to={homeRoute} replace />
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        let pageContent = <Page />;

        if (adminOnlyPages.has(path)) {
          pageContent = (
            <RequireAdmin>
              {pageContent}
            </RequireAdmin>
          );
        }

        const pageModuleGuard = getModuleGuardByPage(path);

        if (pageModuleGuard) {
          const { moduleKey, moduleName } = pageModuleGuard;
          pageContent = (
            <RequireModuleAccess moduleKey={moduleKey} moduleName={moduleName}>
              {pageContent}
            </RequireModuleAccess>
          );
        }

        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                {pageContent}
              </LayoutWrapper>
            }
          />
        );
      })}
      {/* Alias e redirecionamento para evitar 404 em acessos legados/manuais */}
      <Route path="/templates" element={<Navigate to="/TemplatesTexto" replace />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
