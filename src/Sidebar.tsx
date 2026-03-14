import { EntityDetail, ConnectedEntity, MemoryItem } from './types';
import { nodeColor, typeBadgeStyle } from './theme';

interface Props {
  entity: EntityDetail | null;
  loading: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function Sidebar({ entity, loading, onClose, onNavigate }: Props) {
  if (!entity && !loading) return null;

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#fff' }}>
          {loading ? 'Loading...' : entity?.name}
        </h2>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {entity && (
        <>
          <div style={{ marginBottom: 12 }}>
            <span style={typeBadgeStyle(entity.entity_type)}>{entity.entity_type}</span>
          </div>

          {entity.description && (
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 16 }}>{entity.description}</p>
          )}

          {entity.connected.length > 0 && (
            <Section title="Connected Entities">
              {entity.connected.map((c: ConnectedEntity) => (
                <div
                  key={`${c.id}-${c.relation_type}`}
                  onClick={() => onNavigate(c.id)}
                  style={connectedItemStyle}
                >
                  <span style={{ color: nodeColor(c.entity_type), fontWeight: 500 }}>{c.name}</span>
                  <span style={{ color: '#888', fontSize: 11, marginLeft: 8 }}>
                    {c.direction === 'outgoing' ? '→' : '←'} {c.relation_type}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {entity.memories.length > 0 && (
            <Section title={`Memories (${entity.memories.length})`}>
              {entity.memories.map((m: MemoryItem) => (
                <div key={m.id} style={memoryItemStyle}>
                  <div style={{ fontSize: 13, color: '#ddd' }}>
                    {m.title || m.content.slice(0, 80)}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {m.event_type} &middot; importance {m.importance}
                    {m.source && <> &middot; {m.source}</>}
                    {' '}&middot; {new Date(m.captured_at).toLocaleDateString()}
                  </div>
                  {m.title && (
                    <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>
                      {m.content}
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, color: '#999', textTransform: 'uppercase', marginBottom: 8 }}>{title}</h3>
      {children}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 320,
  height: '100vh',
  background: '#111122',
  borderLeft: '1px solid #333',
  padding: 20,
  overflowY: 'auto',
  boxSizing: 'border-box',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: 22,
  cursor: 'pointer',
  padding: '0 4px',
};

const connectedItemStyle: React.CSSProperties = {
  padding: '6px 0',
  borderBottom: '1px solid #222',
  cursor: 'pointer',
  fontSize: 13,
};

const memoryItemStyle: React.CSSProperties = {
  padding: '8px 0',
  borderBottom: '1px solid #222',
};
