// Vercel Node.js Function. Read-only Meta Graph API proxy.
// Meta credentials never enter the browser or Supabase app_data.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const META_PAGE_ID = process.env.META_PAGE_ID;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';

async function graph(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`);
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const response = await fetch(url, {headers: {Authorization: `Bearer ${META_ACCESS_TOKEN}`}});
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message || `Meta API HTTP ${response.status}`);
  return json;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  if(!SUPABASE_URL || !SUPABASE_ANON_KEY || !META_ACCESS_TOKEN) return res.status(503).json({error:'Server integration is not configured.'});
  const jwt = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
  if(!jwt) return res.status(401).json({error:'Sign in required.'});
  try {
    // Validate the user token with Supabase Auth (not just client-supplied identity).
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}`}
    });
    if(!authResponse.ok) return res.status(401).json({error:'Invalid or expired session.'});
    const user = await authResponse.json();
    if(!user.id) return res.status(401).json({error:'Invalid session.'});
    // Optional access control: restrict Meta reporting to approved company emails.
    const allowed = (process.env.META_ALLOWED_EMAILS || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!allowed.length) return res.status(503).json({error:'META_ALLOWED_EMAILS must be configured.'});
    if(!allowed.includes((user.email || '').toLowerCase())) return res.status(403).json({error:'Not authorized for Meta reporting.'});

    const type = req.query.type;
    if(type === 'campaigns' || type === 'insights') {
      if(!META_AD_ACCOUNT_ID || !/^\d+$/.test(META_AD_ACCOUNT_ID.replace(/^act_/,'')))
        return res.status(503).json({error:'META_AD_ACCOUNT_ID is missing or invalid.'});
      const account = META_AD_ACCOUNT_ID.startsWith('act_') ? META_AD_ACCOUNT_ID : `act_${META_AD_ACCOUNT_ID}`;
      const data = type === 'campaigns'
        ? await graph(`${account}/campaigns`, {fields:'id,name,objective,effective_status',limit:100})
        : await graph(`${account}/insights`, {fields:'campaign_id,campaign_name,spend,impressions,clicks',level:'campaign',date_preset:'last_30d',limit:100});
      return res.status(200).json({data:data.data || [],paging: data.paging?.next ? {has_more:true} : {has_more:false}});
    }
    if(type === 'leads') {
      if(!META_PAGE_ID || !/^\d+$/.test(META_PAGE_ID)) return res.status(503).json({error:'META_PAGE_ID is missing or invalid.'});
      const forms = await graph(`${META_PAGE_ID}/leadgen_forms`,{fields:'id,name',limit:50});
      const leads=[];
      // Bound requests; does not follow pagination automatically.
      for(const form of (forms.data || []).slice(0,20)) {
        const result = await graph(`${form.id}/leads`,{fields:'id,created_time,field_data,form_id',limit:100});
        leads.push(...(result.data || []));
      }
      return res.status(200).json({data:leads,paging:{has_more:!!forms.paging?.next},note:'First page per form only; read-only.'});
    }
    return res.status(400).json({error:'Invalid request type.'});
  }catch(e){console.error('Meta integration error:',e.message);return res.status(502).json({error:e.message});}
}
