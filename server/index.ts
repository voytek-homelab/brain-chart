import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getGraphData, getEntityDetail, getStats } from './db.js';

const app = new Hono();

app.get('/api/graph', async (c) => {
  const data = await getGraphData();
  return c.json(data);
});

app.get('/api/entity/:id', async (c) => {
  const id = c.req.param('id');
  const data = await getEntityDetail(id);
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

app.get('/api/stats', async (c) => {
  const data = await getStats();
  return c.json(data);
});

// Static files in production
app.use('/*', serveStatic({ root: './dist-client' }));

const port = 3200;
console.log(`Brain-chart-v2 server on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
