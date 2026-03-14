import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function AccessDenied({ modulo }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <ShieldOff className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Acesso Negado</h1>
        <p className="text-slate-500 text-sm leading-relaxed">
          Você não possui permissão para acessar {modulo ? `o módulo "${modulo}"` : 'este recurso'}.
          <br />
          Fale com um administrador para solicitar acesso.
        </p>
        <Link to={createPageUrl('Home')}>
          <Button className="bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white mt-2">
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
