export function parseDadosAdministrativosJiso(observacoes) {
  if (!observacoes || typeof observacoes !== 'string') {
    return { numero_tars: '', hora_jiso: '', local_jiso: '' };
  }

  const blocoAdmin = observacoes.match(/\[JISO_ADMIN\]\s*([\s\S]*?)\s*\[\/JISO_ADMIN\]/i)?.[1] || '';
  const origem = blocoAdmin || observacoes;
  const numero_tars = (origem.match(/(?:^|\n)TARS:\s*(.+)/i)?.[1] || '').trim();
  const hora_jiso = (origem.match(/(?:^|\n)HORA_JISO:\s*(.+)/i)?.[1] || '').trim();
  const local_jiso = (origem.match(/(?:^|\n)LOCAL_JISO:\s*(.+)/i)?.[1] || '').trim();

  return { numero_tars, hora_jiso, local_jiso };
}

export function buildObservacoesJiso({ observacoesBase = '', numero_tars = '', hora_jiso = '', local_jiso = '' } = {}) {
  const textoBase = String(observacoesBase || '');
  const semBlocoAdmin = textoBase.replace(/\n?---\n?\[JISO_ADMIN\][\s\S]*?\[\/JISO_ADMIN\]\n?---\n?/gi, '\n').trimEnd();

  const linhasAdmin = [];
  if (numero_tars?.trim()) linhasAdmin.push(`TARS: ${numero_tars.trim()}`);
  if (hora_jiso?.trim()) linhasAdmin.push(`HORA_JISO: ${hora_jiso.trim()}`);
  if (local_jiso?.trim()) linhasAdmin.push(`LOCAL_JISO: ${local_jiso.trim()}`);

  if (!linhasAdmin.length) return semBlocoAdmin;

  const blocoAdmin = ['---', '[JISO_ADMIN]', ...linhasAdmin, '[/JISO_ADMIN]', '---'].join('\n');
  return [semBlocoAdmin, blocoAdmin].filter(Boolean).join('\n');
}
