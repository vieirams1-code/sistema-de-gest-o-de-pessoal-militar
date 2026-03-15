import './App.css'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import RequireRouteAccess from '@/components/auth/RequireRouteAccess';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Exceção temporária: fluxo de SolicitacoesAtualizacao ainda é estritamente legado por admin.
// A página possui decisões críticas sem actionKey dedicado no modelo atual.
const legacyAdminOnlyPages = new Set(['SolicitacoesAtualizacao']);

const routeAccessByPage = {
  PermissoesUsuarios: {
    moduleKey: 'configuracoes',
    moduleName: 'Configurações',
    actionKey: 'gerir_permissoes',
    actionName: 'Gerir Permissões',
  },
  PerfisPermissao: {
    moduleKey: 'configuracoes',
    moduleName: 'Configurações',
    actionKey: 'gerir_permissoes',
    actionName: 'Gerir Permissões',
  },
  EstruturaOrganizacional: {
    moduleKey: 'configuracoes',
    moduleName: 'Configurações',
    actionKey: 'gerir_estrutura',
    actionName: 'Gerir Estrutura Organizacional',
  },
  LotacaoMilitares: {
    moduleKey: 'militares',
    moduleName: 'Militares',
    anyActionKeys: ['gerir_estrutura', 'gerir_permissoes'],
    actionName: 'Gerir Estrutura Organizacional ou Permissões',
  },
  ConciliacaoBoletim: {
    moduleKey: 'publicacoes',
    moduleName: 'Controle de Publicações',
  },
  TemplatesTexto: {
    moduleKey: 'templates',
    moduleName: 'Templates',
    actionKey: 'gerir_templates',
    actionName: 'Gerir Templates',
  },
  AgendarJISO: { moduleKey: 'atestados', moduleName: 'Atestados' },
  AgendaJISO: { moduleKey: 'atestados', moduleName: 'Atestados' }, // alias legado
  EditarJISO: { moduleKey: 'atestados', moduleName: 'Atestados' },
  EditarJiso: { moduleKey: 'atestados', moduleName: 'Atestados' }, // alias legado
  CadastrarPublicacao: { moduleKey: 'publicacoes', moduleName: 'Controle de Publicações' },
  AgendaAcoesOperacionais: { moduleKey: 'quadro_operacional', moduleName: 'Quadro Operacional' },
};

const routeAccessByPageNormalized = Object.entries(routeAccessByPage).reduce((acc, [pageKey, guard]) => {
  acc[pageKey.toLowerCase()] = guard;
  return acc;
}, {});

const getRouteAccessByPage = (pageKey) => routeAccessByPageNormalized[pageKey.toLowerCase()] || null;

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
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        let pageContent = <Page />;

        const pageAccessRule = getRouteAccessByPage(path);

        if (pageAccessRule) {
          pageContent = (
            <RequireRouteAccess {...pageAccessRule}>
              {pageContent}
            </RequireRouteAccess>
          );
        }

        // Exceção temporária de compatibilidade: rota ainda depende de role legado de admin.
        if (legacyAdminOnlyPages.has(path)) {
          pageContent = (
            <RequireRouteAccess requireAdminLegacy>
              {pageContent}
            </RequireRouteAccess>
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
