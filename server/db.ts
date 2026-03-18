import neo4j, { type Driver } from 'neo4j-driver';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';

// === Neo4j ===

const driver: Driver = neo4j.driver(
  process.env.NEO4J_URI ?? 'neo4j+s://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER ?? 'neo4j',
    process.env.NEO4J_PASSWORD ?? '',
  ),
  { disableLosslessIntegers: true },
);

const database = process.env.NEO4J_DATABASE ?? undefined;

function session() {
  return driver.session({ database });
}

// === Qdrant ===

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL ?? 'http://192.168.1.58:6333' });
const qdrantCollection = process.env.QDRANT_COLLECTION ?? 'memory2';

// === Gemini (embeddings only) ===

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

async function embedText(text: string): Promise<number[]> {
  const result = await genai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: text,
    config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 3072 },
  });
  return result.embeddings![0].values!;
}

// === API functions ===

export async function getGraphData() {
  const s1 = session();
  const s2 = session();
  const s3 = session();
  try {
    const [nodeResult, edgeResult, enrichResult] = await Promise.all([
      s1.executeRead(tx =>
        tx.run(
          `MATCH (e:Entity)
           OPTIONAL MATCH (e)-[r:RELATES {status: 'Active'}]-()
           WITH e, count(r) AS degree
           RETURN e.id AS id, e.name AS name, e.type AS entityType, degree
           ORDER BY degree DESC`,
        ),
      ),
      s2.executeRead(tx =>
        tx.run(
          `MATCH (s:Entity)-[r:RELATES {status: 'Active'}]->(t:Entity)
           RETURN s.id AS source, t.id AS target, r.type AS relationType`,
        ),
      ),
      s3.executeRead(tx =>
        tx.run(`
          CALL pagerank.get() YIELD node, rank
          WITH node, rank WHERE node:Entity
          OPTIONAL MATCH (node)-[:BELONGS_TO]->(c:Community)
          RETURN node.id AS id, rank, c.id AS communityId
        `),
      ).catch(() => ({ records: [] })),
    ]);

    // Build enrichment map from MAGE PageRank + community data
    const enrichMap = new Map<string, { rank: number; communityId?: string }>();
    for (const r of enrichResult.records) {
      enrichMap.set(r.get('id') as string, {
        rank: r.get('rank') as number,
        communityId: r.get('communityId') as string | undefined,
      });
    }

    const nodes = nodeResult.records.map(r => {
      const degree = r.get('degree') as number;
      const id = r.get('id') as string;
      const enrichment = enrichMap.get(id);
      return {
        id,
        name: r.get('name') as string,
        entityType: r.get('entityType') as string,
        eventCount: degree,
        val: enrichment
          ? Math.min(16, Math.max(2, 2 + enrichment.rank * 200))
          : Math.min(16, Math.max(2, 4 + degree)),
        ...(enrichment?.rank != null && { rank: enrichment.rank }),
        ...(enrichment?.communityId != null && { communityId: enrichment.communityId }),
      };
    });

    const links = edgeResult.records.map(r => ({
      source: r.get('source') as string,
      target: r.get('target') as string,
      relationType: r.get('relationType') as string,
      strength: 1,
    }));

    return { nodes, links };
  } finally {
    await Promise.all([s1.close(), s2.close(), s3.close()]);
  }
}

export async function getEntityDetail(id: string) {
  const s = session();
  try {
    const entityResult = await s.executeRead(tx =>
      tx.run('MATCH (e:Entity {id: $id}) RETURN e.id AS id, e.name AS name, e.type AS entity_type', { id }),
    );
    if (entityResult.records.length === 0) return null;

    const entity = entityResult.records[0];
    const entityName = entity.get('name') as string;

    // Fetch connected entities from Neo4j
    const connectedResult = await s.executeRead(tx =>
      tx.run(
        `MATCH (e:Entity {id: $id})-[r:RELATES {status: 'Active'}]-(other:Entity)
         RETURN other.id AS id, other.name AS name, other.type AS entity_type, r.type AS relation_type,
                CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END AS direction`,
        { id },
      ),
    );

    // Search Qdrant for memories mentioning this entity
    let memories: Array<{ id: string; title?: string; content: string; importance: number; event_type: string; source: string; captured_at: string }> = [];
    try {
      const embedding = await embedText(entityName);
      const results = await qdrant.query(qdrantCollection, {
        prefetch: [{ query: embedding, using: 'dense', limit: 10 }],
        query: { fusion: 'rrf' },
        limit: 10,
        with_payload: true,
      });

      memories = (results.points || [])
        .filter(p => (p.score ?? 0) >= 0.3)
        .map(p => ({
          id: typeof p.id === 'string' ? p.id : String(p.id),
          title: p.payload?.['title'] ? String(p.payload['title']) : undefined,
          content: String(p.payload?.['content'] ?? '').slice(0, 200),
          importance: Number(p.payload?.['importance'] ?? 5),
          event_type: String(p.payload?.['event_type'] ?? 'note'),
          source: String(p.payload?.['source'] ?? ''),
          captured_at: new Date(Number(p.payload?.['captured_at'] ?? 0) * 1000).toISOString(),
        }));
    } catch (err) {
      console.warn('Qdrant search failed:', (err as Error).message);
    }

    return {
      id: entity.get('id') as string,
      name: entityName,
      entity_type: entity.get('entity_type') as string,
      connected: connectedResult.records.map(r => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        entity_type: r.get('entity_type') as string,
        relation_type: r.get('relation_type') as string,
        direction: r.get('direction') as string,
      })),
      memories,
    };
  } finally {
    await s.close();
  }
}

export async function getStats() {
  const s = session();
  try {
    const [graphResult, qdrantStats] = await Promise.all([
      s.executeRead(async tx => {
        const r = await tx.run(
          `MATCH (n:Entity)
           WITH count(n) AS entities
           OPTIONAL MATCH ()-[r:RELATES {status: 'Active'}]->()
           RETURN entities, count(r) AS relationships`,
        );
        return {
          entities: r.records[0]?.get('entities') ?? 0,
          relationships: r.records[0]?.get('relationships') ?? 0,
        };
      }),
      qdrant.getCollection(qdrantCollection).catch(() => null),
    ]);

    return {
      ...graphResult,
      memories: qdrantStats?.points_count ?? 0,
    };
  } finally {
    await s.close();
  }
}
