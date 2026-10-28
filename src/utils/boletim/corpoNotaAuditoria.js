// Recorte exclusivo da busca inversa. O texto original continua disponível
// para a conciliação por número, sem alterar a leitura do PDF.
export default function corpoNotaAuditoria(nota = {}) {
  const texto = String(nota.contexto || '');
  const linhas = texto.split('\n');
  const fim = linhas.findIndex(linha => {
    const normalizada = linha.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toUpperCase().replace(/\s+/g, ' ');
    return /^(?:APROVADO\s+POR\b|ASSINADO\s+POR\b|ASSINATURA\s+DIGITAL\b|MILITARES\s+RELACIONADOS\s+COM\s+A\s+NOTA\b)/.test(normalizada);
  });
  return { ...nota, contexto: (fim < 0 ? texto : linhas.slice(0, fim).join('\n')).trim() };
}