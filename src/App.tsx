import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { VisNetworkGraph, VisNetworkHandle } from './renderers/VisNetworkGraph';
import { GraphData, GraphNode, EntityDetail } from './types';
import { BG_COLOR, nodeColor, TYPE_COLORS } from './theme';

const LIMIT_OPTIONS = [100, 200, 500, 1000, 2000, 0];

function isMobileDevice(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|Android|Mobile/i.test(navigator.userAgent);
}

/** Pick top N most-connected nodes + edges between them */
function filterTopNodes(full: GraphData, limit: number, hiddenTypes: Set<string>): GraphData {
  let nodes = full.nodes;

  // Filter by entity type
  if (hiddenTypes.size > 0) {
    nodes = nodes.filter((n) => !hiddenTypes.has(n.entityType.toLowerCase()));
  }

  // Limit by connection count
  if (limit > 0 && limit < nodes.length) {
    const connectionCount = new Map<string, number>();
    for (const node of nodes) connectionCount.set(node.id, 0);
    for (const link of full.links) {
      const src = typeof link.source === 'object' ? link.source.id : link.source;
      const tgt = typeof link.target === 'object' ? link.target.id : link.target;
      if (connectionCount.has(src)) connectionCount.set(src, (connectionCount.get(src) ?? 0) + 1);
      if (connectionCount.has(tgt)) connectionCount.set(tgt, (connectionCount.get(tgt) ?? 0) + 1);
    }
    nodes = [...nodes].sort((a, b) => (connectionCount.get(b.id) ?? 0) - (connectionCount.get(a.id) ?? 0)).slice(0, limit);
  }

  const nodeSet = new Set(nodes.map((n) => n.id));
  const links = full.links.filter((link) => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    return nodeSet.has(src) && nodeSet.has(tgt);
  });

  return { nodes, links };
}

export function App() {
  const graphRef = useRef<VisNetworkHandle>(null);
  const [fullData, setFullData] = useState<GraphData>({ nodes: [], links: [] });
  const [nodeLimit, setNodeLimit] = useState<number>(isMobileDevice() ? 200 : 0);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [neighborFocus, setNeighborFocus] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    fetch('/api/graph').then((r) => r.json()).then(setFullData);
  }, []);

  // Discover all entity types from data
  const entityTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const node of fullData.nodes) {
      const t = node.entityType.toLowerCase();
      types.set(t, (types.get(t) ?? 0) + 1);
    }
    return [...types.entries()].sort((a, b) => b[1] - a[1]);
  }, [fullData]);

  const data = useMemo(
    () => filterTopNodes(fullData, nodeLimit, hiddenTypes),
    [fullData, nodeLimit, hiddenTypes]
  );

  // Search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = data.nodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 10);
    setSearchResults(results);
  }, [searchQuery, data]);

  const selectEntity = useCallback(async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    const res = await fetch(`/api/entity/${id}`);
    const detail = await res.json();
    setEntity(detail);
    setLoading(false);
  }, []);

  const handleNodeClick = useCallback(
    (node: GraphNode) => selectEntity(node.id),
    [selectEntity]
  );

  const handleSearchSelect = useCallback((node: GraphNode) => {
    setSearchQuery('');
    setSearchResults([]);
    selectEntity(node.id);
    graphRef.current?.focusNode(node.id);
  }, [selectEntity]);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setEntity(null);
  }, []);

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: BG_COLOR }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 220 }}>
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          {searchResults.length > 0 && (
            <div style={searchDropdownStyle}>
              {searchResults.map((n) => (
                <div key={n.id} onClick={() => handleSearchSelect(n)} style={searchItemStyle}>
                  <span style={{ color: nodeColor(n.entityType), marginRight: 6, fontSize: 16 }}>&#9679;</span>
                  <span style={{ color: '#ddd' }}>{n.name}</span>
                  <span style={{ color: '#666', fontSize: 10, marginLeft: 'auto' }}>{n.entityType}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={controlGroupStyle}>
            <label style={labelStyle}>Nodes:</label>
            <select value={nodeLimit} onChange={(e) => setNodeLimit(Number(e.target.value))} style={selectStyle}>
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n === 0 ? `All (${fullData.nodes.length})` : n}</option>
              ))}
            </select>
          </div>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={showEdgeLabels} onChange={(e) => setShowEdgeLabels(e.target.checked)} />
            Edge labels
          </label>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={neighborFocus} onChange={(e) => setNeighborFocus(e.target.checked)} />
            Focus mode
          </label>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} />
            Legend
          </label>

          <button onClick={() => graphRef.current?.fitAll()} style={btnStyle}>Fit view</button>

          {/* Stats */}
          <span style={{ color: '#555', fontSize: 11 }}>
            {data.nodes.length} nodes &middot; {data.links.length} edges
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {data.nodes.length > 0 ? (
            <VisNetworkGraph
              ref={graphRef}
              data={data}
              onNodeClick={handleNodeClick}
              selectedId={selectedId}
              showEdgeLabels={showEdgeLabels}
              neighborFocus={neighborFocus}
            />
          ) : (
            <div style={loadingStyle}>Loading graph data...</div>
          )}

          {/* Legend overlay */}
          {showLegend && (
            <div style={legendStyle}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                Entity types
              </div>
              {entityTypes.map(([type, count]) => (
                <div
                  key={type}
                  onClick={() => toggleType(type)}
                  style={{
                    ...legendItemStyle,
                    opacity: hiddenTypes.has(type) ? 0.3 : 1,
                    textDecoration: hiddenTypes.has(type) ? 'line-through' : 'none',
                  }}
                >
                  <span style={{ color: nodeColor(type), fontSize: 14, marginRight: 6 }}>&#9679;</span>
                  <span style={{ color: '#bbb', flex: 1 }}>{type}</span>
                  <span style={{ color: '#555', fontSize: 10 }}>{count}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: '#555', borderTop: '1px solid #333', paddingTop: 6 }}>
                Click type to hide/show
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: '#555' }}>
                Node size = connection count
              </div>
            </div>
          )}
        </div>

        <Sidebar entity={entity} loading={loading} onClose={handleClose} onNavigate={selectEntity} />
      </div>
    </div>
  );
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  background: '#111122',
  borderBottom: '1px solid #333',
  flexShrink: 0,
  gap: 16,
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 12px',
  background: '#1a1a2e',
  border: '1px solid #333',
  borderRadius: 6,
  color: '#ddd',
  fontSize: 13,
  outline: 'none',
};

const searchDropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#1a1a2e',
  border: '1px solid #444',
  borderRadius: '0 0 6px 6px',
  zIndex: 100,
  maxHeight: 300,
  overflowY: 'auto',
};

const searchItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: 12,
  borderBottom: '1px solid #222',
};

const controlGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const labelStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  background: '#1a1a2e',
  color: '#ccc',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '3px 8px',
  fontSize: 12,
  cursor: 'pointer',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  color: '#888',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  border: '1px solid #444',
  borderRadius: 4,
  color: '#aaa',
  fontSize: 11,
  cursor: 'pointer',
};

const legendStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: 16,
  background: 'rgba(17,17,34,0.9)',
  border: '1px solid #333',
  borderRadius: 8,
  padding: '10px 14px',
  zIndex: 10,
  minWidth: 160,
};

const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '2px 0',
  cursor: 'pointer',
  fontSize: 12,
  transition: 'opacity 0.15s',
};

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#666',
  fontSize: 14,
};
