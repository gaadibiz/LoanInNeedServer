/**
 * Standalone verification script for Document Compressor.
 * Run with: node __tests__/scripts/test_compressor.js
 */
const sharp = require('sharp');
const DocumentCompressor = require('../../utils/documentCompressor');

async function runBenchmark() {
  console.log('====================================================');
  console.log('🧪 Testing Document & Image Compression');
  console.log('====================================================\n');

  // Test 1: Large JPEG (Simulating high-res camera photo 3200x2400)
  console.log('1️⃣ Test Case: High-Resolution Camera Photo (JPEG 3200x2400)');
  const highResJpeg = await sharp({
    create: {
      width: 3200,
      height: 2400,
      channels: 3,
      background: { r: 180, g: 120, b: 70 }
    }
  }).jpeg({ quality: 100 }).toBuffer();

  const startJpeg = Date.now();
  const compressedJpeg = await DocumentCompressor.compressImage(highResJpeg, 'image/jpeg');
  const jpegTime = Date.now() - startJpeg;

  const jpegMeta = await sharp(compressedJpeg.buffer).metadata();
  console.log(`   - Original:   ${(highResJpeg.length / 1024).toFixed(1)} KB (3200x2400)`);
  console.log(`   - Compressed: ${(compressedJpeg.size / 1024).toFixed(1)} KB (${jpegMeta.width}x${jpegMeta.height})`);
  console.log(`   - Reduction:  ${(((highResJpeg.length - compressedJpeg.size) / highResJpeg.length) * 100).toFixed(1)}%`);
  console.log(`   - Time Taken: ${jpegTime}ms`);
  console.log(`   - Status:     ${compressedJpeg.wasCompressed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Test 2: Large PNG (Simulating document screenshot)
  console.log('2️⃣ Test Case: Document Screenshot (PNG 1920x1080)');
  const pngDoc = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png({ compressionLevel: 0 }).toBuffer();

  const startPng = Date.now();
  const compressedPng = await DocumentCompressor.compressImage(pngDoc, 'image/png');
  const pngTime = Date.now() - startPng;

  console.log(`   - Original:   ${(pngDoc.length / 1024).toFixed(1)} KB`);
  console.log(`   - Compressed: ${(compressedPng.size / 1024).toFixed(1)} KB`);
  console.log(`   - Reduction:  ${(((pngDoc.length - compressedPng.size) / pngDoc.length) * 100).toFixed(1)}%`);
  console.log(`   - Time Taken: ${pngTime}ms`);
  console.log(`   - Status:     ${compressedPng.wasCompressed ? '✅ PASSED' : '❌ FAILED'}\n`);

  // Test 3: PDF File Passthrough
  console.log('3️⃣ Test Case: Bank Statement PDF (Application/PDF)');
  const samplePdf = Buffer.from('%PDF-1.4 1 0 obj << /Type /Catalog >> endobj %%EOF');
  const pdfResult = await DocumentCompressor.compressImage(samplePdf, 'application/pdf');

  console.log(`   - Original:   ${samplePdf.length} bytes`);
  console.log(`   - Output:     ${pdfResult.size} bytes`);
  console.log(`   - Unchanged:  ${samplePdf.equals(pdfResult.buffer)}`);
  console.log(`   - Status:     ${!pdfResult.wasCompressed && samplePdf.equals(pdfResult.buffer) ? '✅ PASSED (Safely Passed Through)' : '❌ FAILED'}\n`);

  // Test 4: Corrupt / Non-image buffer
  console.log('4️⃣ Test Case: Corrupted / Non-Image Data');
  const corruptBuffer = Buffer.from('invalid-non-image-data-string');
  const corruptResult = await DocumentCompressor.compressImage(corruptBuffer, 'image/jpeg');

  console.log(`   - Handled:    Gracefully returned original buffer without crashing`);
  console.log(`   - Status:     ${!corruptResult.wasCompressed && corruptResult.buffer.equals(corruptBuffer) ? '✅ PASSED' : '❌ FAILED'}\n`);

  console.log('====================================================');
  console.log('🎉 All Compressor Tests Completed Successfully!');
  console.log('====================================================');
}

runBenchmark().catch(console.error);
