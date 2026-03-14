import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import { nodeColor, BG_COLOR } from '../theme';
import type { GraphData, GraphNode } from '../types';

export interface VisNetworkHandle {
  focusNode: (id: string) => void;
  fitAll: () => void;
  getNetwork: () => Network | null;
}

interface Props {
  data: GraphData;
  onNodeClick: (node: GraphNode) => void;
  selectedId: string | null;
  showEdgeLabels: boolean;
  neighborFocus: boolean;
}

export const VisNetworkGraph = forwardRef<VisNetworkHandle, Props>(
  ({ data, onNodeClick, selectedId, showEdgeLabels, neighborFocus }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const networkRef = useRef<Network | null>(null);
    const nodesRef = useRef<DataSet<any> | null>(null);
    const edgesRef = useRef<DataSet<any> | null>(null);
    const allNodesRef = useRef<any[]>([]);
    const onNodeClickRef = useRef(onNodeClick);
    onNodeClickRef.current = onNodeClick;

    useImperativeHandle(ref, () => ({
      focusNode: (id: string) => {
        const network = networkRef.current;
        if (!network) return;
        network.focus(id, { scale: 1.5, animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
        network.selectNodes([id]);
      },
      fitAll: () => networkRef.current?.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } }),
      getNetwork: () => networkRef.current,
    }));

    // Build graph
    useEffect(() => {
      if (!containerRef.current || data.nodes.length === 0) return;

      networkRef.current?.destroy();

      const nodeItems = data.nodes.map((n) => ({
        id: n.id,
        label: n.name,
        color: {
          background: nodeColor(n.entityType),
          border: nodeColor(n.entityType),
          highlight: { background: '#ffffff', border: '#4fc3f7' },
          hover: { background: nodeColor(n.entityType), border: '#4fc3f7' },
        },
        size: Math.max(8, Math.min(30, n.val * 3)),
        font: { color: '#ccc', size: 11, face: '-apple-system, BlinkMacSystemFont, sans-serif' },
        _data: n,
      }));

      allNodesRef.current = nodeItems;
      const nodes = new DataSet(nodeItems);
      nodesRef.current = nodes;

      const nodeSet = new Set(data.nodes.map((n) => n.id));
      const edgeItems = data.links
        .filter((l) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return nodeSet.has(src) && nodeSet.has(tgt);
        })
        .map((l, i) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return {
            id: i,
            from: src,
            to: tgt,
            _relationType: l.relationType,
            label: showEdgeLabels ? l.relationType : undefined,
            color: { color: 'rgba(255,255,255,0.12)', highlight: 'rgba(79,195,247,0.6)', hover: 'rgba(255,255,255,0.25)' },
            font: { color: '#555', size: 7, strokeWidth: 0, align: 'middle' },
            arrows: { to: { enabled: true, scaleFactor: 0.4 } },
            width: 0.5,
            hoverWidth: 0.3,
          };
        });

      const edges = new DataSet(edgeItems);
      edgesRef.current = edges;

      const network = new Network(
        containerRef.current,
        { nodes, edges },
        {
          physics: {
            solver: 'barnesHut',
            barnesHut: { gravitationalConstant: -4000, springLength: 120, springConstant: 0.02, damping: 0.15 },
            stabilization: { iterations: 250, fit: true },
            maxVelocity: 30,
          },
          interaction: {
            hover: true,
            tooltipDelay: 300,
            zoomView: true,
            dragView: true,
            multiselect: false,
            navigationButtons: false,
            keyboard: { enabled: true, speed: { x: 10, y: 10, zoom: 0.02 } },
          },
          nodes: { shape: 'dot', borderWidth: 1.5, shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 5, x: 2, y: 2 } },
          edges: { smooth: { type: 'continuous', roundness: 0.2 } },
        }
      );

      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const nodeItem = nodes.get(nodeId) as any;
          if (nodeItem?._data) onNodeClickRef.current(nodeItem._data);
        }
      });

      networkRef.current = network;

      return () => {
        network.destroy();
        networkRef.current = null;
        nodesRef.current = null;
        edgesRef.current = null;
      };
    }, [data]);

    // Update edge labels
    useEffect(() => {
      const edges = edgesRef.current;
      if (!edges) return;
      const updates = edges.get().map((e: any) => ({
        id: e.id,
        label: showEdgeLabels ? e._relationType : undefined,
      }));
      edges.update(updates);
    }, [showEdgeLabels]);

    // Neighbor focus: dim non-connected nodes on selection
    useEffect(() => {
      const network = networkRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      if (!network || !nodes || !edges) return;

      if (!neighborFocus || selectedId == null) {
        // Reset all to normal
        const resetUpdates = allNodesRef.current.map((n) => ({
          id: n.id,
          opacity: 1,
          font: { ...n.font, color: '#ccc' },
          color: n.color,
        }));
        nodes.update(resetUpdates);
        const edgeReset = edges.get().map((e: any) => ({
          id: e.id,
          color: { color: 'rgba(255,255,255,0.12)', highlight: 'rgba(79,195,247,0.6)', hover: 'rgba(255,255,255,0.25)' },
        }));
        edges.update(edgeReset);
        return;
      }

      // Find neighbors
      const connectedNodes = new Set<string>();
      connectedNodes.add(selectedId);
      const connectedEdges = new Set<number>();

      edges.get().forEach((e: any) => {
        if (e.from === selectedId || e.to === selectedId) {
          connectedNodes.add(e.from);
          connectedNodes.add(e.to);
          connectedEdges.add(e.id);
        }
      });

      // Dim non-connected
      const nodeUpdates = allNodesRef.current.map((n) => {
        const connected = connectedNodes.has(n.id);
        return {
          id: n.id,
          opacity: connected ? 1 : 0.1,
          font: { ...n.font, color: connected ? '#ccc' : 'rgba(204,204,204,0.1)' },
          color: connected ? n.color : {
            background: 'rgba(50,50,50,0.3)',
            border: 'rgba(50,50,50,0.3)',
            highlight: n.color.highlight,
            hover: n.color.hover,
          },
        };
      });
      nodes.update(nodeUpdates);

      const edgeUpdates = edges.get().map((e: any) => ({
        id: e.id,
        color: connectedEdges.has(e.id)
          ? { color: 'rgba(79,195,247,0.5)', highlight: 'rgba(79,195,247,0.8)' }
          : { color: 'rgba(255,255,255,0.03)', highlight: 'rgba(255,255,255,0.1)' },
      }));
      edges.update(edgeUpdates);

      network.selectNodes([selectedId]);
    }, [selectedId, neighborFocus]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: BG_COLOR }}
      />
    );
  }
);
