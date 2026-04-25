import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const mailboxBoxes = [
  { key: 'pessoal', label: 'Caixa pessoal' },
  { key: 'setorial', label: 'Caixa setorial' },
];

const specialBoxes = [
  { key: 'important', label: 'Importantes' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'archived', label: 'Arquivadas' },
  { key: 'awaitingDispatch', label: 'Aguardando despacho' },
];

const filterConfig = [
  { key: 'unread', label: 'Não lidas' },
  { key: 'important', label: 'Importantes' },
  { key: 'archived', label: 'Arquivadas' },
  { key: 'awaitingDispatch', label: 'Aguardando despacho' },
];

export default function ComunicacoesSidebar({ mailbox, onMailboxChange, filters, onToggleFilter, onSelectSpecialBox }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caixas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mailboxBoxes.map((box) => (
            <Button
              key={box.key}
              type="button"
              variant={mailbox === box.key ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => onMailboxChange(box.key)}
            >
              {box.label}
            </Button>
          ))}

          <div className="pt-2 border-t space-y-2">
            {specialBoxes.map((box) => (
              <button
                type="button"
                key={box.key}
                className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => onSelectSpecialBox(box.key)}
              >
                <span>{box.label}</span>
                {filters[box.key] && <Badge variant="secondary">Ativa</Badge>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filterConfig.map((filter) => (
            <label key={filter.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters[filter.key]}
                onChange={() => onToggleFilter(filter.key)}
              />
              {filter.label}
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
