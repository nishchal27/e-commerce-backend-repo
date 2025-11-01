// scripts/report_k6_result.js
const fs = require('fs');
const fetch = require('node-fetch');

if (process.argv.length < 6) {
  console.error('Usage: node scripts/report_k6_result.js <k6_summary.json> <backend_base_url> <api_token> <experiment_name> [notes]');
  process.exit(2);
}
const [,, filePath, backendBase, apiToken, experimentName, notes = ''] = process.argv;

async function main() {
  if (!fs.existsSync(filePath)) { console.error('File not found:', filePath); process.exit(1); }

  const raw = fs.readFileSync(filePath, 'utf8');
  let json;
  try { json = JSON.parse(raw); } catch (e) { console.error('Failed to parse JSON:', e.message); process.exit(1); }

  const metrics = json.metrics || json.data?.metrics || json;
  function getMetricVal(name, key) {
    if (!metrics || !metrics[name]) return null;
    const m = metrics[name];
    if (m.values && key in m.values) return m.values[key];
    if (m.data && m.data.hasOwnProperty(key)) return m.data[key];
    if (m.hasOwnProperty(key)) return m[key];
    return null;
  }

  const p50 = getMetricVal('http_req_duration', 'med') ?? getMetricVal('http_req_duration', 'p(50)');
  const p95 = getMetricVal('http_req_duration', 'p(95)');
  const avg = getMetricVal('http_req_duration', 'avg');
  const count = getMetricVal('http_reqs', 'count') ?? getMetricVal('http_reqs', 'total');
  const rps = getMetricVal('http_reqs', 'rate');

  const report = {
    name: experimentName,
    date: new Date().toISOString(),
    notes,
    metricsSummary: {
      p50_ms: p50 ?? null,
      p95_ms: p95 ?? null,
      avg_ms: avg ?? null,
      requests_count: count ?? null,
      rps: rps ?? null
    },
    rawFile: filePath
  };

  console.log('Parsed report:', report);

  const url = `${backendBase.replace(/\/$/, '')}/experiments/report`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify(report)
    });
    const text = await res.text();
    console.log('Backend response:', res.status, text);
    if (!res.ok) process.exit(1);
  } catch (e) {
    console.error('Failed to POST report:', e.message);
    process.exit(1);
  }
}
main();
