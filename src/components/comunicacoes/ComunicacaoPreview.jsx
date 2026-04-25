import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ComunicacaoPreview({ comunicacao }) {
  if (!comunicacao) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center text-slate-500">
          Selecione uma comunicação para visualizar os detalhes.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">{comunicacao.assunto}</CardTitle>
          <Badge>{comunicacao.protocolo}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Origem: {comunicacao.origem}</Badge>
          <Badge variant="outline">Prioridade: {comunicacao.prioridade}</Badge>
          <Badge variant="secondary">Status: {comunicacao.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-medium mb-1">Resumo expandido</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{comunicacao.conteudo || comunicacao.resumo}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {comunicacao.tags?.map((tag) => (
            <Badge key={tag} variant="outline">#{tag}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
