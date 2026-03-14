import neo4j, { type Driver } from 'neo4j-driver';

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

export async function getGraphData() {
  const s1 = session();
  const s2 = session();
  try {
    const [nodeResult, edgeResult] = await Promise.all([
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
    ]);

    const nodes = nodeResult.records.map(r => {
      const degree = r.get('degree') as number;
      return {
        id: r.get('id') as string,
        name: r.get('name') as string,
        entityType: r.get('entityType') as string,
        eventCount: degree,
        val: Math.min(16, Math.max(2, 4 + degree)),
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
    await Promise.all([s1.close(), s2.close()]);
  }
}

export async function getEntityDetail(id: string) {
  const s = session();
  try {
    // Fetch entity
    const entityResult = await s.executeRead(tx =>
      tx.run('MATCH (e:Entity {id: $id}) RETURN e.id AS id, e.name AS name, e.type AS entity_type', { id }),
    );
    if (entityResult.records.length === 0) return null;

    const entity = entityResult.records[0];

    // Fetch connected entities
    const connectedResult = await s.executeRead(tx =>
      tx.run(
        `MATCH (e:Entity {id: $id})-[r:RELATES {status: 'Active'}]-(other:Entity)
         RETURN other.id AS id, other.name AS name, other.type AS entity_type, r.type AS relation_type,
                CASE WHEN startNode(r) = e THEN 'outgoing' ELSE 'incoming' END AS direction`,
        { id },
      ),
    );

    return {
      id: entity.get('id') as string,
      name: entity.get('name') as string,
      entity_type: entity.get('entity_type') as string,
      connected: connectedResult.records.map(r => ({
        id: r.get('id') as string,
        name: r.get('name') as string,
        entity_type: r.get('entity_type') as string,
        relation_type: r.get('relation_type') as string,
        direction: r.get('direction') as string,
      })),
    };
  } finally {
    await s.close();
  }
}

export async function getStats() {
  const s = session();
  try {
    const result = await s.executeRead(async tx => {
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
    });
    return result;
  } finally {
    await s.close();
  }
}
