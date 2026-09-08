import { previewProfilesPermissionMigration } from '../src/services/permissionProfileMigrationService.js';

const profiles = (await base44.entities.PerfilPermissao.filter({ ativo: true })) || [];
const previews = previewProfilesPermissionMigration(profiles);

const summary = previews.map((item) => ({
  profileId: item.profileId,
  profileName: item.profileName,
  beforeVersion: item.beforeVersion,
  afterVersion: item.afterVersion,
  changed: item.changed,
  changedKeys: item.changedKeys,
  aliasesApplied: item.aliasesApplied,
  deprecatedKeys: item.deprecatedKeys,
  unknownKeys: item.unknownKeys,
  moduleRepairs: item.moduleRepairs,
}));

console.log(JSON.stringify({ count: summary.length, profiles: summary }, null, 2));
