import React, { useState, useEffect, useRef } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { iniciarAuth, enviarOtp, validarOtp } from '../api/PortalApiClient';
import { Shield, Smartphone, Mail, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

// Máscara de CPF: 000.000.000-00
function maskCpf(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export default function PortalLoginForm() {
  const { loginWithToken } = usePortalAuth();

  // Estados do Fluxo
  const [step, setStep] = useState('CPF'); // 'CPF' | 'CHANNEL' | 'OTP'
  const [cpf, setCpf] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [metodos, setMetodos] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('WHATSAPP');

  // Estados do OTP (6 caixas)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef([]);

  // Estados de Carregamento e Erros
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Timers
  const [resendCountdown, setResendCountdown] = useState(0);
  const [expireCountdown, setExpireCountdown] = useState(0);

  // Efeito para contagem regressiva
  useEffect(() => {
    if (resendCountdown <= 0 && expireCountdown <= 0) return;

    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      setExpireCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown, expireCountdown]);

  // ETAPA 1: Enviar CPF (INICIAR)
  const handleCpfSubmit = async (e) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setErrorMsg('Informe um CPF válido com 11 dígitos.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await iniciarAuth(cleanCpf);
      setRequestId(response.request_id);

      const availableMethods = Array.isArray(response.metodos) && response.metodos.length > 0
        ? response.metodos
        : [{ canal: 'WHATSAPP', label: 'WhatsApp cadastrado' }];

      setMetodos(availableMethods);

      // Se houver apenas um método disponível ou padrão, seleciona e dispara automaticamente
      if (availableMethods.length === 1) {
        const singleChannel = availableMethods[0].canal;
        setSelectedChannel(singleChannel);
        setStep('OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
        await triggerSendOtp(response.request_id, singleChannel);
      } else {
        // Mais de um método disponível: usuário escolhe
        setSelectedChannel(availableMethods[0].canal);
        setStep('CHANNEL');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao iniciar autenticação.');
    } finally {
      setLoading(false);
    }
  };

  // Disparo de OTP (ENVIAR)
  const triggerSendOtp = async (reqId, canal) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await enviarOtp(reqId, canal);
      setSuccessMsg(response?.message || 'Código enviado com sucesso.');
      setResendCountdown(response?.reenvio_em || 60);
      setExpireCountdown(response?.expira_em || 300);
      setOtpDigits(['', '', '', '', '', '']);
      setStep('OTP');
      // Foca no primeiro campo do OTP
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      console.warn('Falha no envio do OTP:', err);
      setErrorMsg(err.message || 'Se você possui cadastro ativo, o código foi enviado.');
    } finally {
      setLoading(false);
    }
  };

  // ETAPA 2: Confirmar Canal Escolhido
  const handleChannelSubmit = async (e) => {
    e.preventDefault();
    if (!requestId || !selectedChannel) return;
    await triggerSendOtp(requestId, selectedChannel);
  };

  // Reenviar OTP
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || !requestId || !selectedChannel) return;
    await triggerSendOtp(requestId, selectedChannel);
  };

  // Tratamento do Input de 6 Dígitos do OTP
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Avança para o próximo campo automaticamente
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Se todos os 6 dígitos foram preenchidos, valida automaticamente
    if (digit && index === 5 && newDigits.every((d) => d !== '')) {
      handleOtpSubmit(newDigits.join(''));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setOtpDigits(newDigits);

    if (pastedData.length === 6) {
      otpInputRefs.current[5]?.focus();
      handleOtpSubmit(pastedData);
    } else {
      otpInputRefs.current[pastedData.length]?.focus();
    }
  };

  // ETAPA 3: Validar OTP (VALIDAR)
  const handleOtpSubmit = async (fullCode) => {
    const code = fullCode || otpDigits.join('');
    if (code.length !== 6) {
      setErrorMsg('Digite os 6 dígitos do código de acesso.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await validarOtp(requestId, code);
      if (response?.token) {
        await loginWithToken(response.token);
      } else {
        throw new Error('Código inválido ou sessão expirada.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Código incorreto ou expirado. Tente novamente.');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Formatar minutos e segundos
  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="max-w-md mx-auto py-4 sm:py-8 px-2">
      <Card className="shadow-xl border-slate-200 bg-white">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="w-16 h-16 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Shield className="w-9 h-9 text-[#1e3a5f]" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight text-[#1e3a5f]">
            PORTAL DO MILITAR
          </CardTitle>
          <CardDescription className="text-slate-600 text-xs sm:text-sm mt-1">
            Corpo de Bombeiros Militar de Mato Grosso do Sul
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-4 sm:px-6">
          {/* Mensagens de Alerta */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && step === 'OTP' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* PASSO 1: DIGITAÇÃO DO CPF */}
          {step === 'CPF' && (
            <form onSubmit={handleCpfSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  CPF do Militar
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  autoFocus
                  maxLength={14}
                  className="h-12 text-base text-center tracking-wider font-semibold border-slate-300 rounded-xl focus:border-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <p className="text-[11px] text-slate-500 text-center">
                  Digite apenas os números do seu CPF cadastrado.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || cpf.replace(/\D/g, '').length !== 11}
                className="w-full h-12 bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl font-semibold shadow-md transition-all flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Continuar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* PASSO 2: ESCOLHA DE CANAL (SE MULTICANAL DISPONÍVEL) */}
          {step === 'CHANNEL' && (
            <form onSubmit={handleChannelSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 text-center font-medium">
                Escolha por onde deseja receber seu código de acesso:
              </p>

              <div className="space-y-2">
                {metodos.map((m) => (
                  <button
                    key={m.canal}
                    type="button"
                    onClick={() => setSelectedChannel(m.canal)}
                    className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-all text-left ${
                      selectedChannel === m.canal
                        ? 'border-[#1e3a5f] bg-blue-50/70 ring-2 ring-[#1e3a5f]/20 font-semibold text-[#1e3a5f]'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        m.canal === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {m.canal === 'WHATSAPP' ? (
                          <Smartphone className="w-5 h-5" />
                        ) : (
                          <Mail className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-[11px] text-slate-500">
                          {m.canal === 'WHATSAPP' ? 'Envio instantâneo via WhatsApp' : 'Envio para sua caixa de e-mail'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedChannel === m.canal ? 'border-[#1e3a5f] bg-[#1e3a5f]' : 'border-slate-300'
                    }`}>
                      {selectedChannel === m.canal && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('CPF')}
                  className="h-11 rounded-xl text-slate-600 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !selectedChannel}
                  className="flex-1 h-11 bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl font-semibold shadow-md"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enviar Código
                </Button>
              </div>
            </form>
          )}

          {/* PASSO 3: DIGITAÇÃO DO OTP */}
          {step === 'OTP' && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center p-2 bg-blue-50 text-[#1e3a5f] rounded-full mb-1">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Digite o código de 6 dígitos</h3>
                <p className="text-xs text-slate-500">
                  Enviado via {selectedChannel === 'WHATSAPP' ? 'WhatsApp' : 'E-mail'} para o seu cadastro.
                </p>
              </div>

              {/* Caixas de 6 Dígitos Segmentadas */}
              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl border-2 border-slate-200 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 outline-none transition-all"
                  />
                ))}
              </div>

              {/* Contadores e Reenvio */}
              <div className="text-center space-y-2 pt-1">
                {expireCountdown > 0 ? (
                  <p className="text-[11px] text-slate-500">
                    O código expira em <span className="font-semibold text-slate-700">{formatTimer(expireCountdown)}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-red-600 font-semibold">
                    Código expirado. Solicite um novo envio abaixo.
                  </p>
                )}

                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={loading || resendCountdown > 0}
                    onClick={handleResendOtp}
                    className="text-xs text-[#1e3a5f] hover:bg-blue-50 font-medium h-8"
                  >
                    {resendCountdown > 0 ? (
                      `Reenviar código em ${resendCountdown}s`
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Reenviar código agora
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex space-x-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('CPF')}
                  className="h-11 rounded-xl text-slate-600 border-slate-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Trocar CPF
                </Button>
                <Button
                  type="button"
                  onClick={() => handleOtpSubmit()}
                  disabled={loading || otpDigits.some((d) => d === '')}
                  className="flex-1 h-11 bg-[#1e3a5f] hover:bg-[#2a4d7d] text-white rounded-xl font-semibold shadow-md"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      Validando...
                    </>
                  ) : (
                    'Entrar no Portal'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-slate-50/70 border-t border-slate-100 py-3 px-6 rounded-b-xl flex items-center justify-center">
          <span className="text-[11px] text-slate-500 flex items-center">
            <Lock className="w-3 h-3 mr-1 text-slate-400" />
            Ambiente Seguro CBMMS • Criptografia de Ponta a Ponta
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
