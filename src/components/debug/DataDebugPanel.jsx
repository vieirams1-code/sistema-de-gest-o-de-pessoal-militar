import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

function sanitizeDebugData(data) {
  try {
    return JSON.parse(JSON.stringify(data, (_key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack ? String(value.stack).split('\n').slice(0, 5).join('\n') : null,
        };
      }
      return value;
    }));
  } catch (_error) {
    return {
      pagina: data?.pagina || 'Desconhecida',
      erroSerializacao: 'Não foi possível serializar o diagnóstico',
      geradoEm: new Date().toISOString(),
    };
  }
}

export default function DataDebugPanel({ debugData, className = '' }) {
  const [copied, setCopied] = React.useState(false);

  if (!debugData) return null;

  const payload = sanitizeDebugData(debugData);
  const jsonText = JSON.stringify(payload, null, 2);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonText;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[DataDebugPanel] Falha ao copiar diagnóstico.', error);
      }
    }
  };

  return (
    <div className={`mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-left ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Diagnóstico técnico para suporte. Não compartilhe com usuários finais.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? 'Copiado!' : 'Copiar diagnóstico de dados'}
        </Button>
      </div>
    </div>
  );
}
