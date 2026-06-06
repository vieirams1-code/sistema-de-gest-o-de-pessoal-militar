const onlyDigits = (value = '') => String(value || '').replace(/\D/g, '');

const isValidCPF = (value = '') => {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (base, factor) => {
    let total = 0;
    for (let i = 0; i < base.length; i += 1) {
      total += parseInt(base[i], 10) * (factor - i);
    }
    const result = (total * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  const d2 = calcDigit(digits.slice(0, 10), 11);

  return d1 === parseInt(digits[9], 10) && d2 === parseInt(digits[10], 10);
};

const isEmpty = (value) => !value || String(value).trim() === '';

const isValidEmail = (email) => {
  if (isEmpty(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function auditarMilitar(militar = {}) {
  const criticos = [];
  const atencao = [];
  const scores = {
    cpf: 0,
    matricula: 0,
    rg: 0,
    data_nascimento: 0,
    tipo_sanguineo: 0,
    endereco: 0,
    telefone: 0,
    email: 0,
  };

  // 1. CPF (15%)
  const cpfDigits = onlyDigits(militar.cpf);
  if (!cpfDigits) {
    criticos.push({ campo: 'cpf', mensagem: 'CPF não informado' });
  } else if (!isValidCPF(cpfDigits)) {
    criticos.push({ campo: 'cpf', mensagem: 'CPF inválido (erro de dígito verificador)' });
  } else {
    scores.cpf = 15;
  }

  // 2. Matrícula (15%)
  const matriculaDigits = onlyDigits(militar.matricula);
  if (!matriculaDigits) {
    criticos.push({ campo: 'matricula', mensagem: 'Matrícula não informada' });
  } else if (matriculaDigits.length !== 9) {
    criticos.push({ campo: 'matricula', mensagem: 'Matrícula deve conter 9 dígitos' });
  } else {
    scores.matricula = 15;
  }

  // 3. Data nascimento (15%)
  if (isEmpty(militar.data_nascimento)) {
    criticos.push({ campo: 'data_nascimento', mensagem: 'Data de nascimento não informada' });
  } else {
    const data = new Date(militar.data_nascimento);
    if (isNaN(data.getTime())) {
      criticos.push({ campo: 'data_nascimento', mensagem: 'Data de nascimento inválida' });
    } else {
      scores.data_nascimento = 15;
    }
  }

  // 4. Endereço (15%)
  const camposEndereco = [
    { key: 'logradouro', label: 'Logradouro' },
    { key: 'numero_endereco', label: 'Número' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'uf', label: 'UF' },
    { key: 'cep', label: 'CEP' },
  ];
  const faltantes = camposEndereco.filter(c => isEmpty(militar[c.key]));
  if (faltantes.length > 0) {
    const labels = faltantes.map(f => f.label).join(', ');
    atencao.push({ campo: 'endereco', mensagem: `Endereço incompleto (faltam: ${labels})` });
  } else if (onlyDigits(militar.cep).length !== 8) {
    atencao.push({ campo: 'endereco', mensagem: 'CEP deve conter 8 dígitos' });
  } else {
    scores.endereco = 15;
  }

  // 5. RG (10%)
  if (isEmpty(militar.rg)) {
    atencao.push({ campo: 'rg', mensagem: 'RG não informado' });
  } else {
    scores.rg = 10;
  }

  // 6. Tipo sanguíneo (10%)
  const tiposValidos = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (isEmpty(militar.tipo_sanguineo)) {
    atencao.push({ campo: 'tipo_sanguineo', mensagem: 'Tipo sanguíneo não informado' });
  } else if (!tiposValidos.includes(militar.tipo_sanguineo)) {
    atencao.push({ campo: 'tipo_sanguineo', mensagem: `Tipo sanguíneo inválido (${militar.tipo_sanguineo})` });
  } else {
    scores.tipo_sanguineo = 10;
  }

  // 7. Telefone (10%)
  const telDigits = onlyDigits(militar.telefone);
  if (!telDigits) {
    atencao.push({ campo: 'telefone', mensagem: 'Telefone não informado' });
  } else if (telDigits.length < 10) {
    atencao.push({ campo: 'telefone', mensagem: 'Telefone deve conter pelo menos 10 dígitos (com DDD)' });
  } else {
    scores.telefone = 10;
  }

  // 8. E-mail (10%)
  const hasValidEmail = isValidEmail(militar.email_particular) || isValidEmail(militar.email_funcional);
  if (!hasValidEmail) {
    atencao.push({ campo: 'email', mensagem: 'Nenhum e-mail válido informado (particular ou funcional)' });
  } else {
    scores.email = 10;
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  return {
    score: totalScore,
    criticos,
    atencao,
    resumo: {
      totalCriticos: criticos.length,
      totalAtencao: atencao.length,
      scores,
    },
  };
}
