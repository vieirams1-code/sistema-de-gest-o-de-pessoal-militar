export class AuthzError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class AuthRequiredError extends AuthzError {
  constructor(details = {}) {
    super('AUTH_REQUIRED', 'Autenticacao obrigatoria para executar esta operacao.', details);
  }
}

export class AccessContextNotFoundError extends AuthzError {
  constructor(details = {}) {
    super(
      'ACCESS_CONTEXT_NOT_FOUND',
      'Usuario autenticado sem contexto de acesso valido em UsuarioAcesso.',
      details
    );
  }
}

export class ModuleAccessDeniedError extends AuthzError {
  constructor(moduleKey, details = {}) {
    super('MODULE_ACCESS_DENIED', `Acesso ao modulo '${moduleKey}' negado.`, {
      moduleKey,
      ...details,
    });
  }
}

export class ActionPermissionDeniedError extends AuthzError {
  constructor(actionKey, details = {}) {
    super('ACTION_PERMISSION_DENIED', `Permissao para a acao '${actionKey}' negada.`, {
      actionKey,
      ...details,
    });
  }
}

export class RecordOutOfScopeError extends AuthzError {
  constructor(details = {}) {
    super('RECORD_OUT_OF_SCOPE', 'Registro fora do escopo de acesso do usuario.', details);
  }
}

export class EntityScopeUnresolvedError extends AuthzError {
  constructor(entityName, details = {}) {
    super(
      'ENTITY_SCOPE_UNRESOLVED',
      `Nao foi possivel resolver o escopo da entidade '${entityName}'.`,
      { entityName, ...details }
    );
  }
}

export class PatchFieldNotAllowedError extends AuthzError {
  constructor(entityName, field, details = {}) {
    super(
      'PATCH_FIELD_NOT_ALLOWED',
      `Campo '${field}' nao permitido para mutacao em '${entityName}'.`,
      { entityName, field, ...details }
    );
  }
}

export class MultipleActiveAccessFoundError extends AuthzError {
  constructor(details = {}) {
    super(
      'MULTIPLE_ACTIVE_ACCESS_FOUND',
      'Mais de um UsuarioAcesso ativo encontrado para o usuario autenticado.',
      details
    );
  }
}

export class InvalidAccessConfigurationError extends AuthzError {
  constructor(message = 'Configuracao de acesso invalida.', details = {}) {
    super('INVALID_ACCESS_CONFIGURATION', message, details);
  }
}
