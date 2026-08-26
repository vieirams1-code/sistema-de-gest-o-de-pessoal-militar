export type OtpChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface PortalAuthConfigData {
  id?: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_provider: string;
  sms_provider: string;
  whatsapp_provider: string;
  allow_channel_choice: boolean;
  default_channel: OtpChannel;
  otp_ttl_seconds: number;
  otp_resend_seconds: number;
  otp_max_attempts: number;
  otp_max_sends_per_hour: number;
  ativo: boolean;
}

export const DEFAULT_AUTH_CONFIG: PortalAuthConfigData = {
  email_enabled: false,
  sms_enabled: false,
  whatsapp_enabled: true,
  email_provider: 'disabled',
  sms_provider: 'disabled',
  whatsapp_provider: 'evolution_api',
  allow_channel_choice: false,
  default_channel: 'WHATSAPP',
  otp_ttl_seconds: 300,
  otp_resend_seconds: 60,
  otp_max_attempts: 3,
  otp_max_sends_per_hour: 3,
  ativo: true,
};

export interface OtpDeliveryParams {
  to: string;
  code: string;
  militarNome?: string;
  correlationId?: string;
}

export interface OtpDeliveryResult {
  success: boolean;
  provider: string;
  error?: string;
}

export interface OtpDeliveryProvider {
  readonly channel: OtpChannel;
  isOperational(config: PortalAuthConfigData): boolean;
  sendOtp(params: OtpDeliveryParams, base44Client: any): Promise<OtpDeliveryResult>;
}

export interface PublicMethodOption {
  canal: OtpChannel;
  label: string;
}
