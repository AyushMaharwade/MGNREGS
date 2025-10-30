import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.set('trust proxy', 1);
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Utility: Map '01' to Jan, '02' to Feb, ...
const MONTH_NUMBER_TO_NAME = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Chhattisgarh monthly performance endpoint
app.get('/api/mgnregs/chhattisgarh/monthly', async (req, res) => {
  try {
    const district = String(req.query.district || '').trim();
    const monthNum = String(req.query.month || '').trim();
    const yearNum = String(req.query.year || '').trim();
    if (!district) return res.status(400).json({ error: 'district is required' });
    if (!/^\d{2}$/.test(monthNum)) return res.status(400).json({ error: 'month must be MM (01-12)' });
    if (!/^\d{4}$/.test(yearNum)) return res.status(400).json({ error: 'year must be YYYY' });

    const API_KEY = process.env.DATA_GOV_API_KEY || '';
    const RESOURCE_ID = 'ee03643a-ee4c-48c2-ac30-9f2ff26ab722';

    // Map month number to short name
    const month = MONTH_NUMBER_TO_NAME[monthNum];
    if (!month) return res.status(400).json({ error: 'invalid month mapping' });
    // Compute financial year (fin_year) for Indian FY (Apr-Mar)
    let year = parseInt(yearNum, 10);
    let fin_year;
    if (monthNum === '01' || monthNum === '02' || monthNum === '03') {
      // Jan/Feb/Mar: part of fin year starting previous year
      fin_year = `${year - 1}-${year}`;
    } else {
      // Apr–Dec: part of fin year of given year–next
      fin_year = `${year}-${year + 1}`;
    }

    // Capitalize district for correct filter match
    const districtParam = district.toUpperCase();
    // Always send state_name=CHHATTISGARH
    const stateParam = 'CHHATTISGARH';

    const baseUrl = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
    const qs = new URLSearchParams();
    qs.set('api-key', API_KEY);
    qs.set('format', 'json');
    qs.set('limit', '100');
    qs.set('filters[state_name]', stateParam);
    qs.set('filters[district_name]', districtParam);
    qs.set('filters[month]', month);
    qs.set('filters[fin_year]', fin_year);

    const fetchUrl = `${baseUrl}?${qs.toString()}`;
    console.log('[MGNREGS] Fetching:', fetchUrl); // Add URL log
    const upstream = await fetch(fetchUrl, { timeout: 15000 });
    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[MGNREGS] Upstream error', upstream.status, text.slice(0, 500));
      return res.status(502).json({ error: 'upstream_failed', status: upstream.status, body: text });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      const text = await upstream.text();
      console.error('[MGNREGS] Upstream non-JSON body:', text.slice(0, 500));
      return res.json({ error: 'upstream_nonjson', body: text });
    }
    const upstreamJson = await upstream.json();
    const records = Array.isArray(upstreamJson.records) ? upstreamJson.records : [];
    return res.json(records);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', message: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[mgnregs] listening on :${PORT}`);
});


