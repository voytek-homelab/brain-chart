export const TYPE_COLORS: Record<string, string> = {
  person: '#4fc3f7',
  project: '#81c784',
  technology: '#ffb74d',
  concept: '#ce93d8',
  location: '#a1887f',
  organization: '#90a4ae',
  event: '#ef5350',
  tool: '#ff8a65',
  service: '#64b5f6',
  file: '#78909c',
};

export const BG_COLOR = '#0a0a1a';

export function nodeColor(entityType: string): string {
  return TYPE_COLORS[entityType.toLowerCase()] ?? '#e0e0e0';
}

export function typeBadgeStyle(entityType: string): React.CSSProperties {
  const color = nodeColor(entityType);
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    color: '#0a0a1a',
    background: color,
  };
}
