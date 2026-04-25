import AccessDenied from '@/components/auth/AccessDenied';
import { useCurrentUser } from '@/components/auth/useCurrentUser';
import { useAuth } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';
import ComunicacoesInternasPage from '@/pages/comunicacoes/ComunicacoesInternasPage';
import { isModuloComunicacoesInternasEnabled } from '@/utils/comunicacoes/featureFlags';

export default function Comunicacoes() {
  const { appPublicSettings } = useAuth();
  const { isLoading, isAccessResolved, canAccessAction } = useCurrentUser();

  if (!isModuloComunicacoesInternasEnabled(appPublicSettings)) {
    return <PageNotFound />;
  }

  if (isLoading || !isAccessResolved) {
    return null;
  }

  if (!canAccessAction('acessar_comunicacoes')) {
    return <AccessDenied modulo="Comunicações Internas" />;
  }

  return <ComunicacoesInternasPage />;
}
