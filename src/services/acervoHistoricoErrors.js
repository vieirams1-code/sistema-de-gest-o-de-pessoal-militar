export class AcervoHistoricoError extends Error {
  constructor(message, { status, code, documento_existente, data } = {}) {
    super(message);
    this.name = 'AcervoHistoricoError';
    this.status = status;
    this.code = code;
    this.documento_existente = documento_existente;
    this.data = data;
  }
}

export function formatarDataAcervo(data) {
  if (!data) return '';
  const texto = String(data).slice(0, 10);
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return texto;
}

export function montarMensagemArquivoDuplicado(documento = {}) {
  if (!documento) return 'Este arquivo já foi cadastrado para este militar.';

  if (documento.tipo_documento === 'CERTIDAO_COMPORTAMENTO') {
    const data = formatarDataAcervo(documento.data_documento);
    return data
      ? `Arquivo já cadastrado como Certidão de Comportamento em ${data}.`
      : 'Arquivo já cadastrado como Certidão de Comportamento.';
  }

  if (documento.tipo_documento === 'ALTERACAO') {
    const inicio = formatarDataAcervo(documento.periodo_inicial);
    const fim = formatarDataAcervo(documento.periodo_final);
    return inicio && fim
      ? `Arquivo já cadastrado como Alteração referente ao período de ${inicio} a ${fim}.`
      : 'Arquivo já cadastrado como Alteração.';
  }

  if (documento.tipo_documento === 'DIVERSOS') {
    return documento.titulo
      ? `Arquivo já cadastrado como Diversos: ${documento.titulo}.`
      : 'Arquivo já cadastrado como Diversos.';
  }

  return 'Este arquivo já foi cadastrado para este militar.';
}

export function criarMensagemErroAcervo(err = {}) {
  if (err.status === 409 && err.code === 'ARQUIVO_DUPLICADO') {
    const base = err.message || 'Este arquivo já foi cadastrado para este militar.';
    const detalhes = err.documento_existente ? montarMensagemArquivoDuplicado(err.documento_existente) : '';
    return detalhes ? `${base} ${detalhes}` : base;
  }

  if (err.status === 409) {
    return err.message && !err.message.includes('Request failed')
      ? err.message
      : 'Não foi possível salvar o documento por conflito de dados. Verifique se o arquivo já está cadastrado.';
  }

  return err.message || 'Erro ao salvar documento histórico.';
}
