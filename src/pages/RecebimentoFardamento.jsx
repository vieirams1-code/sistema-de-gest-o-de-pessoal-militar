import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shirt, Save, Search } from 'lucide-react';
import MilitarSelector from '@/components/atestado/MilitarSelector';

const initialForm = {
  militar_id: '',
  militar_nome: '',
  militar_posto: '',
  militar_matricula: '',
  item_fardamento: '',
  quantidade: 1,
  tamanho: '',
  data_recebimento: new Date().toISOString().split('T')[0],
  observacoes: '',
};

export default function RecebimentoFardamento() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(initialForm);

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ['recebimentos-fardamento'],
    queryFn: () => base44.entities.RecebimentoFardamento.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload) => base44.entities.RecebimentoFardamento.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos-fardamento'] });
      setFormData(initialForm);
    },
  });

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formData.militar_id || !formData.item_fardamento) return;

    saveMutation.mutate({
      ...formData,
      quantidade: Number(formData.quantidade || 1),
    });
  };

  const filteredRecebimentos = recebimentos.filter((item) =>
    [item.militar_nome, item.militar_matricula, item.item_fardamento, item.tamanho]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Shirt className="w-8 h-8 text-[#1e3a5f]" />
          <div>
            <h1 className="text-3xl font-bold text-[#1e3a5f]">Recebimento de Fardamento</h1>
            <p className="text-slate-500">Cadastro simples de entregas para os militares</p>
            <p className="text-xs text-slate-400 mt-1">Acesso pelo menu: Patrimônio e Reconhecimento → Recebimento de Fardamento</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#1e3a5f]">Novo recebimento</h2>

          <MilitarSelector
            value={formData.militar_id}
            onChange={handleChange}
            onMilitarSelect={(data) => {
              setFormData((prev) => ({
                ...prev,
                militar_id: data.id || prev.militar_id,
                militar_nome: data.militar_nome || data.nome_completo,
                militar_posto: data.militar_posto || data.posto_graduacao,
                militar_matricula: data.militar_matricula || data.matricula,
              }));
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <Label>Item de fardamento *</Label>
              <Input
                value={formData.item_fardamento}
                onChange={(e) => handleChange('item_fardamento', e.target.value)}
                placeholder="Ex.: Gandola camuflada"
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) => handleChange('quantidade', e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Tamanho</Label>
              <Input
                value={formData.tamanho}
                onChange={(e) => handleChange('tamanho', e.target.value)}
                placeholder="M, 42, G..."
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Data do recebimento</Label>
              <Input
                type="date"
                value={formData.data_recebimento}
                onChange={(e) => handleChange('data_recebimento', e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Label>Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                placeholder="Informações adicionais"
                rows={2}
                className="mt-1.5"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={saveMutation.isPending || !formData.militar_id || !formData.item_fardamento}
                className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar recebimento'}
              </Button>
            </div>
          </div>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Buscar por militar, item ou matrícula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRecebimentos.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Nenhum recebimento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-2">Militar</th>
                    <th className="py-2 pr-2">Item</th>
                    <th className="py-2 pr-2">Qtd</th>
                    <th className="py-2 pr-2">Tamanho</th>
                    <th className="py-2 pr-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecebimentos.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 text-slate-700">
                      <td className="py-2 pr-2">{item.militar_posto} {item.militar_nome}</td>
                      <td className="py-2 pr-2">{item.item_fardamento}</td>
                      <td className="py-2 pr-2">{item.quantidade}</td>
                      <td className="py-2 pr-2">{item.tamanho || '-'}</td>
                      <td className="py-2 pr-2">{item.data_recebimento || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
