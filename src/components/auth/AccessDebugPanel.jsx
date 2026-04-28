import React from 'react';
import { Button } from '@/components/ui/button';

export default function AccessDebugPanel({ debugAccess }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyDebug = async () => {
    try {
      const payload = JSON.stringify(debugAccess || {}, null, 2);
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="pt-1">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleCopyDebug}
      >
        {copied ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
      </Button>
    </div>
  );
}
