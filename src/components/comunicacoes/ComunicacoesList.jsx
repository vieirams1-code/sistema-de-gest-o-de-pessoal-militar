import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const priorityClass = {
  Alta: 'bg-red-100 text-red-700',
  Média: 'bg-amber-100 text-amber-700',
  Baixa: 'bg-emerald-100 text-emerald-700',
};

export default function ComunicacoesList({ comunicacoes, selectedId, onSelect }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Lista de comunicações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
        {comunicacoes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left border rounded-lg p-3 space-y-2 hover:bg-slate-50 ${selectedId === item.id ? 'border-[#173764] bg-blue-50' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">{item.assunto}</p>
              <span className={`text-xs px-2 py-1 rounded ${priorityClass[item.prioridade] || 'bg-slate-100 text-slate-700'}`}>{item.prioridade}</span>
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>{item.protocolo}</span>
              <span>{new Date(item.data).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="text-sm text-slate-600">{item.resumo}</div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{item.origem}</Badge>
              <Badge variant="outline">{item.tipo}</Badge>
              <Badge variant="secondary">{item.status}</Badge>
            </div>
          </button>
        ))}

        {comunicacoes.length === 0 && (
          <div className="text-sm text-slate-500 py-8 text-center">Nenhuma comunicação encontrada com os filtros atuais.</div>
        )}
      </CardContent>
    </Card>
  );
}
