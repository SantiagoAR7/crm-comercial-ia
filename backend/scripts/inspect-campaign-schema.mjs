import 'dotenv/config';
import { supabase } from '../src/services/supabase.js';

for (const table of ['campaigns', 'campaign_contacts', 'campaign_runs', 'campaign_call_queue']) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${Object.keys(data?.[0] || {}).sort().join(',')}`);
}
