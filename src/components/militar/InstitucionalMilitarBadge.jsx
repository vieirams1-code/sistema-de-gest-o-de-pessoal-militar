import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getBadgeInstitucionalProps } from '@/utils/funcoesTags/decoracaoInstitucionalMilitar';

export default function InstitucionalMilitarBadge({ decoracao, funcaoInstitucional, className = '' }) {
  const badge = getBadgeInstitucionalProps(decoracao || funcaoInstitucional);
  if (!badge) return null;

  return (
    <Badge
      variant="secondary"
      className={className}
      style={{
        backgroundColor: `${badge.cor}1A`,
        color: badge.cor,
        border: `1px solid ${badge.cor}33`,
      }}
      title={badge.nome}
    >
      <span aria-hidden="true" className="mr-1">{badge.emoji}</span>
      {badge.nome}
    </Badge>
  );
}
