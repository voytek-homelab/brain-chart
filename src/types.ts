export interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  description?: string;
  eventCount: number;
  val: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relationType: string;
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface EntityDetail {
  id: string;
  name: string;
  entity_type: string;
  description?: string;
  connected: ConnectedEntity[];
}

export interface ConnectedEntity {
  id: string;
  name: string;
  entity_type: string;
  relation_type: string;
  direction: 'incoming' | 'outgoing';
}

export interface Stats {
  entities: number;
  relationships: number;
}
