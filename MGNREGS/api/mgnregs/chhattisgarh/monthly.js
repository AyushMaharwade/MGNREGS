const MONTH_MAP = {
  '01': 'Jan','02': 'Feb','03': 'Mar','04': 'Apr','05': 'May','06': 'Jun',
  '07': 'Jul','08': 'Aug','09': 'Sep','10': 'Oct','11': 'Nov','12': 'Dec'
};

function normalizeDistrictName(name) {
  const upper = String(name || '').toUpperCase();
  const base = upper.replace(/[-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (base.includes('KABIRDHAM')) return 'KAWARDHA';
  if (base.includes('GAURELA') || base.includes('PENDRA') || base.includes('MARWAHI')) return 'GAURELA PENDRA MARWAHI';
  if (base.includes('MANENDRAGARH') || base.includes('CHIRMIRI') || base.includes('BHARATPUR')) return 'MANENDRAGARH-CHIRMIRI-BHARATPUR'.replace(/-/g, ' ');
  if (base.includes('KHAIRAGARH') || base.includes('CHHUIKHADAN') || base.includes('GANDAI')) return 'KHAIRAGARH-CHHUIKHADAN-GANDAI'.replace(/-/g, ' ');
  if (base.includes('MOHLA') || base.includes('MANPUR') || base.includes('AMBAGARH')) return 'MOHLA-MANPUR-AMBAGARH CHOWKI'.replace(/-/g, ' ');
  return base;
}

module.exports = async function handler(req, res) {
  try {
    const { district = '', month = '', year = '' } = req.query || {};
    if (!district) return res.status(400).json({ error: 'district is required' });
    if (!/^\d{2}$/.test(String(month))) return res.status(400).json({ error: 'month must be MM' });
    if (!/^\d{4}$/.test(String(year))) return res.status(400).json({ error: 'year must be YYYY' });

    const API_KEY = process.env.DATA_GOV_API_KEY || '';
    const RESOURCE_ID = 'ee03643a-ee4c-48c2-ac30-9f2ff26ab722';
    if (!API_KEY) return res.status(500).json({ error: 'missing_api_key', hint: 'Set DATA_GOV_API_KEY in Vercel Project > Settings > Environment Variables' });

    const monthName = MONTH_MAP[String(month)];
    const y = parseInt(String(year), 10);
    const fin_year = ['01','02','03'].includes(String(month)) ? `${y-1}-${y}` : `${y}-${y+1}`;

    const base = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
    const qs = new URLSearchParams();
    qs.set('api-key', API_KEY);
    qs.set('format', 'json');
    qs.set('limit', '100');
    qs.set('filters[state_name]', 'CHHATTISGARH');
    const districtFilter = normalizeDistrictName(district);
    qs.set('filters[district_name]', districtFilter);
    qs.set('filters[month]', monthName);
    qs.set('filters[fin_year]', fin_year);

    const url = `${base}?${qs.toString()}`;
    console.log('[api] fetching:', url);
    const upstream = await fetch(url, { headers: { 'User-Agent': 'vercel-serverless' } });
    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(502).json({ error: 'upstream_failed', status: upstream.status, body });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      const body = await upstream.text();
      return res.status(502).json({ error: 'upstream_nonjson', contentType, body: body?.slice(0, 500) });
    }
    const data = await upstream.json();
    let records = Array.isArray(data?.records) ? data.records : [];
    if (!records.length) {
      const wide = new URL(base);
      wide.searchParams.set('api-key', API_KEY);
      wide.searchParams.set('format', 'json');
      wide.searchParams.set('limit', '5000');
      wide.searchParams.set('filters[state_name]', 'CHHATTISGARH');
      wide.searchParams.set('filters[month]', monthName);
      wide.searchParams.set('filters[fin_year]', fin_year);
      const u2 = wide.toString();
      console.log('[api] fallback fetching:', u2);
      const up2 = await fetch(u2, { headers: { 'User-Agent': 'vercel-serverless' } });
      const ct2 = up2.headers.get('content-type') || '';
      if (up2.ok && ct2.includes('json')) {
        const j2 = await up2.json();
        const list = Array.isArray(j2?.records) ? j2.records : [];
        const want = normalizeDistrictName(district);
        records = list.filter(r => normalizeDistrictName(r?.district_name) === want);
      }
    }
    return res.status(200).json({ records });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: String(e?.message || e) });
  }
}


