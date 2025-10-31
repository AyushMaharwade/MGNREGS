const MONTH_MAP = {
  '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun',
  '07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'
};

function normalizeDistrictName(name) {
  const upper = String(name || '').toUpperCase();
  const base = upper.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (base.includes('KABIRDHAM')) return 'KAWARDHA';
  if (base.includes('GAURELA') || base.includes('PENDRA') || base.includes('MARWAHI')) return 'GAURELA PENDRA MARWAHI';
  if (base.includes('MANENDRAGARH') || base.includes('CHIRMIRI') || base.includes('BHARATPUR')) return 'MANENDRAGARH CHIRMIRI BHARATPUR';
  if (base.includes('KHAIRAGARH') || base.includes('CHHUIKHADAN') || base.includes('GANDAI')) return 'KHAIRAGARH CHHUIKHADAN GANDAI';
  if (base.includes('MOHLA') || base.includes('MANPUR') || base.includes('AMBAGARH')) return 'MOHLA MANPUR AMBAGARH CHOWKI';
  return base;
}

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const district = params.get('district') || '';
    const month = params.get('month') || '';
    const year = params.get('year') || '';

    if (!district) return json(400, { error: 'district is required' });
    if (!/^\d{2}$/.test(month)) return json(400, { error: 'month must be MM' });
    if (!/^\d{4}$/.test(year)) return json(400, { error: 'year must be YYYY' });

    const API_KEY = process.env.DATA_GOV_API_KEY || '';
    const RESOURCE_ID = 'ee03643a-ee4c-48c2-ac30-9f2ff26ab722';
    if (!API_KEY) return json(500, { error: 'missing_api_key' });

    const monthName = MONTH_MAP[month];
    const y = parseInt(year, 10);
    const fin_year = ['01','02','03'].includes(month) ? `${y-1}-${y}` : `${y}-${y+1}`;

    const base = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
    const qs = new URLSearchParams();
    qs.set('api-key', API_KEY);
    qs.set('format', 'json');
    qs.set('limit', '100');
    qs.set('filters[state_name]', 'CHHATTISGARH');
    qs.set('filters[district_name]', normalizeDistrictName(district));
    qs.set('filters[month]', monthName);
    qs.set('filters[fin_year]', fin_year);

    const url = `${base}?${qs.toString()}`;
    const upstream = await fetch(url, { headers: { 'User-Agent': 'netlify-function' } });
    if (!upstream.ok) {
      const body = await upstream.text();
      return json(502, { error: 'upstream_failed', status: upstream.status, body: body.slice(0, 500) });
    }
    const ct = upstream.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      const body = await upstream.text();
      return json(502, { error: 'upstream_nonjson', contentType: ct, body: body.slice(0, 500) });
    }
    const doc = await upstream.json();
    let records = Array.isArray(doc.records) ? doc.records : [];

    if (!records.length) {
      const qs2 = new URLSearchParams();
      qs2.set('api-key', API_KEY);
      qs2.set('format', 'json');
      qs2.set('limit', '5000');
      qs2.set('filters[state_name]', 'CHHATTISGARH');
      qs2.set('filters[month]', monthName);
      qs2.set('filters[fin_year]', fin_year);
      const url2 = `${base}?${qs2.toString()}`;
      const up2 = await fetch(url2, { headers: { 'User-Agent': 'netlify-function' } });
      if (up2.ok && (up2.headers.get('content-type') || '').includes('json')) {
        const j2 = await up2.json();
        const list = Array.isArray(j2.records) ? j2.records : [];
        const want = normalizeDistrictName(district);
        records = list.filter(r => normalizeDistrictName(r?.district_name) === want);
      }
    }

    return json(200, { records });
  } catch (e) {
    return json(500, { error: 'server_error', message: String(e?.message || e) });
  }
};

function json(status, bodyObj) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyObj)
  };
}


