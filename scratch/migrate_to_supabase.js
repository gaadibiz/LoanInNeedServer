/**
 * Migration: Upload existing local files to Supabase Storage
 * and update DB fileUrl to Supabase public URL
 * 
 * Run: node scratch/migrate_to_supabase.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../config/supabase');
const prisma = require('../utils/prismaClient');

const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'Documents';

async function uploadDocToSupabase(doc) {
  // filePath: uploads/Documents/AADHAAR/73/timestamp_file.jpg
  // Supabase path should be: AADHAAR/73/timestamp_file.jpg
  const supabasePath = doc.filePath.replace(/^uploads\/[^/]+\//, '');
  const localAbsPath = path.join(__dirname, '..', doc.filePath);

  if (!fs.existsSync(localAbsPath)) {
    console.log(`  ⚠️  File not found locally: ${localAbsPath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(localAbsPath);
  const ext = path.extname(doc.fileName).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.pdf': 'application/pdf', '.gif': 'image/gif', '.webp': 'image/webp'
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(supabasePath, fileBuffer, { contentType, upsert: true });

  if (error) {
    console.log(`  ❌ Supabase upload failed: ${error.message}`);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(supabasePath);

  return urlData?.publicUrl || null;
}

async function main() {
  const docs = await prisma.userDocument.findMany({
    orderBy: { userId: 'asc' }
  });

  console.log(`\n🚀 Migrating ${docs.length} documents to Supabase...\n`);

  let success = 0, failed = 0, skipped = 0;

  for (const doc of docs) {
    console.log(`[Doc ${doc.id}] User:${doc.userId} ${doc.docType} — ${doc.fileName}`);

    const publicUrl = await uploadDocToSupabase(doc);

    if (!publicUrl) {
      failed++;
      continue;
    }

    // Update DB with Supabase public URL
    await prisma.userDocument.update({
      where: { id: doc.id },
      data: { fileUrl: publicUrl }
    });

    console.log(`  ✅ Uploaded → ${publicUrl}`);
    success++;
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭  Skipped: ${skipped}`);
  console.log(`═══════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
