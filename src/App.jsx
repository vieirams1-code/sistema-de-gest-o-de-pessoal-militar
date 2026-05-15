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
import ControleAtestadosTemporarios from '@/pages/ControleAtestadosTemporarios';

const { Pages: ConfiguredPages, Layout } = pagesConfig;
const Pages = { ...ConfiguredPages, ControleAtestadosTemporarios };
const homeRoute = '/VerMilitar';

const adminOnlyPages = new Set([
  // Exceção temporária: Mantido em admin puro (RequireAdmin) até a criação
  // de uma action key específica na arquitetura (ex: gerir_solicitacoes_atualizacao).
  'SolicitacoesAtualizacao',
  'Subgrupamentos',
  // Lote 1D-D: Auditoria de Comportamento — admin only por requisito do lote.
  'AuditoriaComportamento',
  'AntiguidadeDiagnostico',
  'AntiguidadeConfigQuadros',
  'AntiguidadeImportarPromocoes',
  'AntiguidadePrevia',
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
  ControleAtestadosTemporarios: { moduleKey: 'controle_atestados_temporarios', actionKey: 'visualizar_controle_atestados_temporarios', moduleName: 'Controle de Atestados' },
  Ferias: { moduleKey: 'ferias', moduleName: 'Férias' },
  Militares: { moduleKey: 'militares', moduleName: 'Efetivo' },
  ExtracaoEfetivo: { moduleKey: 'extracao_efetivo', actionKey: 'visualizar_extracao_efetivo', moduleName: 'Extração do Efetivo' },
  ContratosDesignacao: { moduleKey: 'militares', actionKeys: ['visualizar_contratos_designacao', 'gerir_contratos_designacao'], moduleName: 'Contratos de Designação' },
  Armamentos: { moduleKey: 'armamentos', moduleName: 'Armamentos' },
  Medalhas: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  ApuracaoMedalhasTempoServico: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  AntiguidadeDiagnostico: { moduleKey: 'antiguidade', moduleName: 'Antiguidade' },
  AntiguidadeConfigQuadros: { moduleKey: 'antiguidade', moduleName: 'Antiguidade' },
  AntiguidadeImportarPromocoes: { moduleKey: 'antiguidade', moduleName: 'Antiguidade' },
  AntiguidadePrevia: { moduleKey: 'antiguidade', moduleName: 'Antiguidade' },
  RastreamentoPromocoes: { moduleKey: 'antiguidade', actionKey: 'visualizar_rastreamento_promocoes', moduleName: 'Antiguidade' },
  IndicacoesDomPedroII: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  QuadroOperacional: { moduleKey: 'quadro_operacional', moduleName: 'Quadro Operacional' },
  AgendaAcoesOperacionais: { moduleKey: 'quadro_operacional', moduleName: 'Quadro Operacional' },
  LotacaoMilitares: { moduleKey: 'lotacao_militares', moduleName: 'Lotação de Militares' },
  EstruturaOrganizacional: { moduleKey: 'estrutura_organizacional', moduleName: 'Estrutura Organizacional' },
  CadastrarArmamento: { moduleKey: 'armamentos', moduleName: 'Armamentos' },
  CadastrarMilitar: { moduleKey: 'militares', moduleName: 'Efetivo' },
  VerMilitar: { moduleKey: 'militares', actionKey: 'visualizar_militares', moduleName: 'Efetivo' },
  FichaMilitar: { moduleKey: 'militares', moduleName: 'Efetivo' },
  CadastrarFerias: { moduleKey: 'ferias', moduleName: 'Férias' },
  PlanoAnualFerias: { moduleKey: 'ferias', actionKey: 'visualizar_ferias', moduleName: 'Férias' },
  PeriodosAquisitivos: { moduleKey: 'ferias', moduleName: 'Férias' },
  CreditosExtraordinariosFerias: { moduleKey: 'ferias', moduleName: 'Férias' },
  CadastrarRegistroLivro: { moduleKey: 'livro', moduleName: 'Livro de Registros' },
  Livro: { moduleKey: 'livro', moduleName: 'Livro de Registros' },
  RP: { moduleKey: 'rp', moduleName: 'Registro de Publicações' },
  CadastrarRegistroRP: { moduleKey: 'rp', moduleName: 'Registro de Publicações' },
  AvaliacaoComportamento: { moduleKey: 'controle_comportamento', moduleName: 'Controle de Comportamento' },
  DetalheComportamento: { moduleKey: 'controle_comportamento', moduleName: 'Controle de Comportamento' },
  FolhaAlteracoes: { moduleKey: 'folha_alteracoes', moduleName: 'Folha de Alterações' },
  CadastrarMedalha: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  Punicoes: { moduleKey: 'punicoes', moduleName: 'Lançamento de Punições' },
  CadastrarPunicao: { moduleKey: 'punicoes', moduleName: 'Lançamento de Punições' },
  RegistrosMilitar: { moduleKey: 'registros_militar', moduleName: 'Registros do Militar' },
  TiposMedalha: { moduleKey: 'medalhas', moduleName: 'Medalhas' },
  Configuracoes: { moduleKeys: ['configuracoes', 'adicoes_personalizacoes'], actionKeys: ['gerir_configuracoes', 'gerir_adicoes_personalizacoes'], moduleName: 'Configurações' },
  PermissoesUsuarios: { moduleKeys: ['permissoes_usuarios'], actionKeys: ['gerir_permissoes_usuarios'], moduleName: 'Permissões de Usuários' },
  PerfisPermissao: { moduleKeys: ['perfis_permissao'], actionKeys: ['gerir_perfis_permissao'], moduleName: 'Perfis de Permissão' },
  Publicacoes: { moduleKey: 'controle_publicacoes', moduleName: 'Controle de Publicações' },
  CadastrarPublicacao: { moduleKey: 'controle_publicacoes', moduleName: 'Controle de Publicações' },
  ConciliacaoBoletim: { moduleKey: 'conciliacao_boletim', moduleName: 'Conciliação com Boletim' },
  TemplatesTexto: { moduleKey: 'templates', actionKey: 'gerir_templates', moduleName: 'Templates de Texto' },
  MigracaoMilitares: { moduleKeys: ['migracao_militares'], actionKeys: ['visualizar_importacao_militares'], moduleName: 'Migração de Militares' },
  HistoricoImportacoesMilitares: { moduleKeys: ['migracao_militares'], actionKeys: ['ver_historico_importacoes'], moduleName: 'Migração de Militares' },
  MigracaoAlteracoesLegado: { moduleKeys: ['migracao_alteracoes_legado'], actionKeys: ['visualizar_migracao_legado'], moduleName: 'Migração de Alterações Legado' },
  ClassificacaoPendentesLegado: { moduleKeys: ['migracao_alteracoes_legado'], actionKeys: ['classificar_legado'], moduleName: 'Migração de Alterações Legado' },
  RevisaoDuplicidadesMilitar: { moduleKeys: ['migracao_alteracoes_legado'], actionKeys: ['revisar_duplicidades'], moduleName: 'Migração de Alterações Legado' },
  CentralPendencias: { moduleKey: 'central_pendencias', actionKey: 'visualizar_central_pendencias', moduleName: 'Central de Pendências' },
  ProcedimentosProcessos: { moduleKey: 'procedimentos_processos', actionKey: 'visualizar_procedimentos_processos', moduleName: 'Procedimentos e Processos' },
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
          const { moduleKey, moduleKeys, actionKey, actionKeys, moduleName } = pageModuleGuard;
          pageContent = (
            <RequireModuleAccess
              moduleKey={moduleKey}
              moduleKeys={moduleKeys}
              actionKey={actionKey}
              actionKeys={actionKeys}
              moduleName={moduleName}
            >
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