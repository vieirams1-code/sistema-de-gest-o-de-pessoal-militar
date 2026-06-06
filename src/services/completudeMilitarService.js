/**
 * Serviço para calcular a completude cadastral de um militar.
 * Analisa campos essenciais e secundários para gerar um score de preenchimento.
 */

function vazio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === 'string') return valor.trim() === '';
  if (Array.isArray(valor)) return valor.length === 0;
  return false;
}

const CONFIG_CAMPOS = [
  { campo: 'nome_completo', critico: true },
  { campo: 'matricula', critico: true },
  { campo: 'cpf', critico: true },
  { campo: 'data_inclusao', critico: true },
  { campo: 'posto_graduacao', critico: true },
  { campo: 'quadro', critico: true },
  { campo: 'lotacao', critico: true },
  { campo: 'nome_guerra', critico: false },
  { campo: 'data_nascimento', critico: false },
  { campo: 'sexo', critico: false },
  { campo: 'estado_civil', critico: false },
  { campo: 'tipo_sanguineo', critico: false },
  { campo: 'religiao', critico: false },
  { campo: 'escolaridade', critico: false },
  { campo: 'naturalidade', critico: false },
  { campo: 'naturalidade_uf', critico: false },
  { campo: 'nome_pai', critico: false },
  { campo: 'nome_mae', critico: false },
  { campo: 'rg', critico: false },
  { campo: 'orgao_expedidor_rg', critico: false },
  { campo: 'uf_rg', critico: false },
  { campo: 'cnh_numero', critico: false },
  { campo: 'etnia', critico: false },
  { campo: 'email_particular', critico: false },
  { campo: 'telefone', critico: false },
  { campo: 'email_funcional', critico: false },
  { campo: 'logradouro', critico: false },
  { campo: 'numero_endereco', critico: false },
  { campo: 'cep', critico: false },
  { campo: 'bairro', critico: false },
  { campo: 'cidade', critico: false },
  { campo: 'uf', critico: false },
];

/**
 * Calcula o percentual de completude, campos preenchidos, faltantes e críticos faltantes.
 * @param {Object} militar Objeto com os dados do militar.
 * @returns {Object} { percentual, preenchidos, faltantes, criticos }
 */
export function calcularCompletudeMilitar(militar = {}) {
  if (!militar || typeof militar !== 'object') {
    return {
      percentual: 0,
      preenchidos: [],
      faltantes: CONFIG_CAMPOS.map((c) => c.campo),
      criticos: CONFIG_CAMPOS.filter((c) => c.critico).map((c) => c.campo),
    };
  }

  const preenchidos = [];
  const faltantes = [];
  const criticos = [];

  CONFIG_CAMPOS.forEach(({ campo, critico }) => {
    if (!vazio(militar[campo])) {
      preenchidos.push(campo);
    } else {
      faltantes.push(campo);
      if (critico) {
        criticos.push(campo);
      }
    }
  });

  const totalCampos = CONFIG_CAMPOS.length;
  const totalPreenchidos = preenchidos.length;

  // Cálculo do percentual simples (0 a 100)
  const percentual = totalCampos > 0
    ? Math.round((totalPreenchidos / totalCampos) * 100)
    : 0;

  return {
    percentual,
    preenchidos,
    faltantes,
    criticos,
  };
}
