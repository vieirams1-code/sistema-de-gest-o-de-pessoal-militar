import React, { useState } from 'react';
import { PortalAuthProvider, usePortalAuth } from './context/PortalAuthContext';
import PortalLayout from './PortalLayout';
import { ShieldCheck, UserCheck, Lock, AlertCircle, Key, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

function PortalContent() {
  const { militar, isAuthenticated, isLoading, authError, loginWithToken } = usePortalAuth();
  const [manualToken, setManualToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleConnectToken = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      await loginWithToken(manualToken.trim());
    } catch (err) {
      setErrorMsg(err.message || 'Token inválido ou sessão expirada.');
    } finally {
      setConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1e3a5f] rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Validando credencial de acesso...</p>
      </div>
    );
  }

  // Estado A: Sem Sessão
  if (!isAuthenticated || !militar) {
    return (
      <div className="max-w-md mx-auto py-8">
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7 text-[#1e3a5f]" />
            </div>
            <CardTitle className="text-xl font-bold text-[#1e3a5f]">PORTAL DO MILITAR</CardTitle>
            <CardDescription className="text-slate-600 text-sm mt-1">
              Identifique-se para acessar seus serviços e tarefas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-2">
              <p className="font-semibold flex items-center">
                <AlertCircle className="w-4 h-4 mr-1 text-amber-600" />
                Fase de Fundação Segura (1.2A)
              </p>
              <p className="text-amber-800">
                O envio real de OTP via SMS/WhatsApp será ativado na próxima fase.
                Em ambiente de desenvolvimento e testes, você pode conectar inserindo uma credencial temporária.
              </p>
            </div>

            <form onSubmit={handleConnectToken} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium text-slate-700">Token de Teste (Sessão)</label>
                <Input
                  type="password"
                  placeholder="Cole aqui seu PortalToken temporário"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
              )}

              <Button
                type="submit"
                disabled={connecting || !manualToken.trim()}
                className="w-full bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Validando Sessão...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Conectar ao Portal
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado B: Com Sessão Válida
  return (
    <div className="space-y-6">
      {/* Banner de Boas-vindas e Identificação */}
      <Card className="border-emerald-200/80 bg-gradient-to-r from-emerald-50/50 via-slate-50 to-blue-50/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Foto / Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-white border-2 border-slate-200 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
              {militar.foto_url ? (
                <img
                  src={militar.foto_url}
                  alt={militar.nome_completo}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCheck className="w-12 h-12 text-slate-400" />
              )}
            </div>

            {/* Dados Funcionais */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Portal conectado com segurança
              </div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {militar.nome_completo}
              </h2>
              <p className="text-sm font-medium text-slate-700">
                {militar.posto_graduacao} • {militar.quadro} {militar.nome_guerra ? `(${militar.nome_guerra})` : ''}
              </p>
              <p className="text-xs text-slate-500">
                Lotação: <span className="font-medium text-slate-700">{militar.lotacao || militar.estrutura_nome || 'Não informada'}</span> • Situação: <span className="font-medium text-slate-700">{militar.situacao_militar}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Informações da Fundação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
              Garantias de Segurança Ativas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>✔ Identidade derivada estritamente pelo backend (zero IDOR).</p>
            <p>✔ Sessão controlada por token efêmero com hash SHA-256.</p>
            <p>✔ Projeção DTO estrita (dados sensíveis isolados).</p>
            <p>✔ Trilha de auditoria ativa em todas as requisições.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center">
              <RefreshCw className="w-4 h-4 mr-2 text-blue-600" />
              Próximos Módulos (Fases Seguintes)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-600 space-y-2">
            <p>• Tarefa: Atualização Cadastral e Conferência.</p>
            <p>• Tarefa: Opção de Férias e Fracionamento.</p>
            <p>• Central de Pendências e Prazos Administrativos.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PortalApp() {
  return (
    <PortalAuthProvider>
      <PortalLayout>
        <PortalContent />
      </PortalLayout>
    </PortalAuthProvider>
  );
}
