const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials missing from environment variables');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder-domain.supabase.co',
  supabaseKey || 'placeholder-key'
);

module.exports = { supabase };
