/**
 * Check: What's in DB vs what's actually in Supabase
 */
require('dotenv').config();
const prisma = require('../utils/prismaClient');
const { supabase } = require('../config/supabase');
const BUCKET = process.env.SUPABASE_BUCKET || 'Documents';

async function main() {
  const docs = await prisma.userDocument.findMany({ orderBy: { userId: 'asc' } });
  console.log(`\n📦 ${docs.length} document records in database\n`);

  // Check Supabase bucket contents
  const { data: bucketFiles, error } = await supabase.storage.from(BUCKET).list('', { limit: 100 });
  if (error) {
    console.log('❌ Supabase list error:', error.message);
  } else {
    console.log(`☁️  Supabase bucket '${BUCKET}' top-level folders:`, bucketFiles?.map(f => f.name) || []);
  }

  console.log('\n📋 DB Records:');
  docs.forEach(d => {
    const supabasePath = d.filePath?.replace(/^uploads\/[^/]+\//, '');
    console.log(`  User:${d.userId} ${d.docType} → filePath: ${d.filePath}`);
    console.log(`    fileUrl: ${d.fileUrl}`);
    console.log(`    supabasePath would be: ${supabasePath}`);
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
