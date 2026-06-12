import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do SDK e utilitários
const mockBase44 = {
  auth: {
    me: vi.fn().mockResolvedValue({ email: 'test@example.com' })
  },
  asServiceRole: {
    entities: {
      Militar: {
        get: vi.fn()
      },
      RepositorioDocumental: {
        filter: vi.fn(),
        update: vi.fn()
      },
      AcervoFuncionalHistorico: {
        filter: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn()
      }
    }
  }
};

// Lógica simplificada baseada na implementação real para teste unitário rápido
async function gerirAcervoLogic(payload, env = {}) {
  const { militar_id, tipo_documento, data, file } = payload;

  // Hash simulado
  const arquivo_sha256 = "simulated_hash";
  const arquivo_tamanho = 1024;

  // 1. Duplicidade
  const duplicados = await mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
    militar_id, arquivo_sha256, ativo: true
  });
  if (duplicados.length > 0 && !data.confirmar_duplicidade) {
    return { error: 'DUPLICIDADE_DETECTADA' };
  }

  // 2. Repositorios (Failover)
  const repositorios = await mockBase44.asServiceRole.entities.RepositorioDocumental.filter({
    ativo: true, status: 'ATIVO'
  });
  if (repositorios.length === 0) return { error: 'Sem repo' };

  // 3. Folder reuse (Concurrency)
  const registrosRepo = await mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter({
    militar_id, repositorio_id: repositorios[0].id
  });
  const drive_folder_id = registrosRepo.find(r => r.drive_folder_id)?.drive_folder_id || `folder_${militar_id}`;

  // 4. Save
  const registro = await mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.create({
    ...data,
    militar_id,
    tipo_documento,
    drive_folder_id,
    arquivo_sha256,
    arquivo_tamanho,
    status_documento: 'ATIVO',
    versao: data.substitui_documento_id ? 2 : 1
  });

  if (data.substitui_documento_id) {
    await mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.update(data.substitui_documento_id, {
      status_documento: 'SUBSTITUIDO'
    });
  }

  return { ok: true, registro };
}

describe('Acervo Histórico - Robustez e Governança', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve detectar duplicidade por hash', async () => {
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([{ id: 'existente' }]);

    const res = await gerirAcervoLogic({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data: {},
      file: { content: 'base64' }
    });

    expect(res.error).toBe('DUPLICIDADE_DETECTADA');
  });

  it('deve permitir duplicidade se confirmado', async () => {
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([{ id: 'existente' }]);
    mockBase44.asServiceRole.entities.RepositorioDocumental.filter.mockResolvedValueOnce([{ id: 'repo1' }]);
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([]); // search folder
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.create.mockResolvedValueOnce({ id: 'novo' });

    const res = await gerirAcervoLogic({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data: { confirmar_duplicidade: true },
      file: { content: 'base64' }
    });

    expect(res.ok).toBe(true);
    expect(mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.create).toHaveBeenCalled();
  });

  it('deve reutilizar folder_id existente (concorrência)', async () => {
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([]); // no duplicate
    mockBase44.asServiceRole.entities.RepositorioDocumental.filter.mockResolvedValueOnce([{ id: 'repo1' }]);
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([{ drive_folder_id: 'folder_123' }]);

    await gerirAcervoLogic({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data: {},
      file: { content: 'base64' }
    });

    const createCall = mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.create.mock.calls[0][0];
    expect(createCall.drive_folder_id).toBe('folder_123');
  });

  it('deve gerenciar versionamento e substituição', async () => {
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([]); // no duplicate
    mockBase44.asServiceRole.entities.RepositorioDocumental.filter.mockResolvedValueOnce([{ id: 'repo1' }]);
    mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.filter.mockResolvedValueOnce([]); // search folder

    await gerirAcervoLogic({
      militar_id: 'm1',
      tipo_documento: 'ALTERACAO',
      data: { substitui_documento_id: 'doc_v1' },
      file: { content: 'base64' }
    });

    expect(mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.create).toHaveBeenCalledWith(expect.objectContaining({
      versao: 2,
      substitui_documento_id: 'doc_v1'
    }));
    expect(mockBase44.asServiceRole.entities.AcervoFuncionalHistorico.update).toHaveBeenCalledWith('doc_v1', {
      status_documento: 'SUBSTITUIDO'
    });
  });
});
