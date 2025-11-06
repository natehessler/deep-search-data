import express from 'express';
import { BigQuery } from '@google-cloud/bigquery';

const app = express();
const bigquery = new BigQuery({ projectId: 'telligentsourcegraph' });

app.use(express.static('public'));

// Get organization usage (last 30 days)
app.get('/api/org-usage', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  
  const query = `
    SELECT 
      externalUrl,
      eventName,
      COUNT(*) as event_count,
      COUNT(DISTINCT userId) as unique_users,
      MIN(timestamp) as first_event,
      MAX(timestamp) as last_event
    FROM \`telligentsourcegraph.telemetry.v2_events\`
    WHERE eventName = 'deepsearch:search.completed'
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)
    GROUP BY externalUrl, eventName
    ORDER BY event_count DESC
    LIMIT 100
  `;

  try {
    const [rows] = await bigquery.query({ query });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user usage for a specific org
app.get('/api/user-usage', async (req, res) => {
  const { org, days = 30 } = req.query;
  
  if (!org) {
    return res.status(400).json({ error: 'org parameter required' });
  }

  const query = `
    SELECT 
      userId,
      externalUrl,
      ANY_VALUE(userMetadata.email) as email,
      ANY_VALUE(userMetadata.username) as username,
      COUNTIF(eventName = 'deepsearch:search.completed') as queries_completed,
      COUNTIF(eventName = 'deepsearch:search.error') as error_count,
      COUNTIF(eventName = 'deepsearch:search.cancelled') as cancelled_count,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.credits') AS INT64)) as total_credits,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.promptTokens') AS INT64)) as prompt_tokens,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.completionTokens') AS INT64)) as completion_tokens,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.cachedTokens') AS INT64)) as cached_tokens,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.totalTokens') AS INT64)) as total_tokens,
      SUM(CAST(JSON_VALUE(parameters.metadata, '$.toolCalls') AS INT64)) as total_tool_calls,
      MIN(timestamp) as first_search,
      MAX(timestamp) as last_search
    FROM \`telligentsourcegraph.telemetry.v2_events\`
    WHERE externalUrl = @org
      AND eventName IN ('deepsearch:search.completed', 'deepsearch:search.error', 'deepsearch:search.cancelled')
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    GROUP BY userId, externalUrl
    ORDER BY total_credits DESC
    LIMIT 500
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: { org, days: parseInt(days) }
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get org-level user list from Vitally
app.get('/api/org-users', async (req, res) => {
  const { org } = req.query;
  
  if (!org) {
    return res.status(400).json({ error: 'org parameter required' });
  }

  const query = `
    SELECT 
      externalUrl,
      email,
      active_users_past30d,
      active_users_past90d
    FROM \`telligentsourcegraph.vitally.vitally_sg_analytics_users\`
    WHERE externalUrl = @org
    LIMIT 1
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: { org }
    });
    res.json(rows[0] || { externalUrl: org, email: [], active_users_past30d: 0, active_users_past90d: 0 });
  } catch (error) {
    console.error('Error fetching org users:', error);
    res.json({ externalUrl: org, email: [], active_users_past30d: 0, active_users_past90d: 0 });
  }
});

// Get overage data
app.get('/api/overages', async (req, res) => {
  const query = `
    SELECT 
      external_url,
      account_name,
      month,
      deep_search_allocation,
      source_type,
      ds_queries,
      ds_users,
      monthly_overage
    FROM \`telligentsourcegraph.sourcegraph_analytics.ELA_deep_search_overages\`
    ORDER BY month DESC, monthly_overage DESC
    LIMIT 200
  `;

  try {
    const [rows] = await bigquery.query({ query });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all Deep Search events breakdown
app.get('/api/events-breakdown', async (req, res) => {
  const { org, days = 7 } = req.query;
  
  const whereClause = org ? `AND externalUrl = @org` : '';
  
  const query = `
    SELECT 
      eventName,
      ${org ? 'externalUrl,' : ''}
      COUNT(*) as count,
      COUNT(DISTINCT userId) as unique_users
    FROM \`telligentsourcegraph.telemetry.v2_events\`
    WHERE REGEXP_CONTAINS(eventName, r'deepsearch')
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
      ${whereClause}
    GROUP BY eventName ${org ? ', externalUrl' : ''}
    ORDER BY count DESC
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: org ? { org, days: parseInt(days) } : { days: parseInt(days) }
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Deep Search Dashboard running on http://localhost:${PORT}`);
});

export default app;
