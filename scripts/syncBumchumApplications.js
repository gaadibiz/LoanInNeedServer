// const fs = require('fs');
// const path = require('path');
// const prisma = require('../utils/prismaClient');
// const { sendLoanApplicationToBumchum, updateLoanApplicationToBumchum } = require('../services/loanService');

// const LOG_DIR = path.join(__dirname, '../logs');
// const LOG_FILE = path.join(LOG_DIR, 'bumchum_sync.log');

// if (!fs.existsSync(LOG_DIR)) {
//   fs.mkdirSync(LOG_DIR, { recursive: true });
// }

// function log(message) {
//   const timestamp = new Date().toISOString();
//   const formatted = `[${timestamp}] ${message}`;
//   console.log(formatted);
//   try {
//     fs.appendFileSync(LOG_FILE, formatted + '\n');
//   } catch (err) {
//     console.error('Failed to write to log file:', err.message);
//   }
// }

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// let isShuttingDown = false;

// process.on('SIGINT', () => {
//   log('Received SIGINT. Gracefully shutting down after current item...');
//   isShuttingDown = true;
// });

// process.on('SIGTERM', () => {
//   log('Received SIGTERM. Gracefully shutting down after current item...');
//   isShuttingDown = true;
// });

// async function runSync() {
//   const args = process.argv.slice(2);
//   let intervalSec = 15;
//   let order = 'asc';
//   let limit = null;

//   for (let i = 0; i < args.length; i++) {
//     if (args[i] === '--interval' && args[i + 1]) {
//       intervalSec = parseFloat(args[i + 1]);
//       i++;
//     } else if (args[i] === '--order' && args[i + 1]) {
//       order = args[i + 1].toLowerCase() === 'desc' ? 'desc' : 'asc';
//       i++;
//     } else if (args[i] === '--limit' && args[i + 1]) {
//       limit = parseInt(args[i + 1], 10);
//       i++;
//     }
//   }

//   const intervalMs = Math.max(100, intervalSec * 1000);

//   log('====================================================');
//   log(`Starting Bumchum batch sync job`);
//   log(`Interval: ${intervalSec}s | Order: ${order.toUpperCase()}${limit ? ` | Limit: ${limit}` : ''}`);
//   log(`Log file: ${LOG_FILE}`);
//   log('====================================================');

//   const whereClause = {
//     bumchumSyncedAt: null
//   };

//   const totalMatching = await prisma.loanApplication.count({ where: whereClause });
//   log(`Total applications with bumchumSyncedAt IS NULL: ${totalMatching}`);

//   const applications = await prisma.loanApplication.findMany({
//     where: whereClause,
//     orderBy: { createdAt: order },
//     take: limit || undefined,
//     select: {
//       id: true,
//       userId: true,
//       status: true,
//       reason: true,
//       loanAmount: true,
//       createdAt: true,
//       user: {
//         select: {
//           id: true,
//           name: true,
//           phone: true,
//           email: true
//         }
//       }
//     }
//   });

//   const totalToProcess = applications.length;
//   log(`Applications to process in this run: ${totalToProcess}`);

//   let successCount = 0;
//   let failedCount = 0;
//   const failedApps = [];

//   for (let index = 0; index < totalToProcess; index++) {
//     if (isShuttingDown) {
//       log('Execution stopped due to shutdown signal.');
//       break;
//     }

//     const app = applications[index];
//     const currentIndex = index + 1;
//     const progressPercent = ((currentIndex / totalToProcess) * 100).toFixed(1);

//     log(`[${currentIndex}/${totalToProcess}] (${progressPercent}%) Processing App ID: ${app.id}, User ID: ${app.userId} (${app.user?.name || 'N/A'}, ${app.user?.phone || 'N/A'}, Status: ${app.status})...`);

//     try {
//       await sendLoanApplicationToBumchum(app.userId, app.id);

//       const syncTime = new Date();
//       await prisma.loanApplication.update({
//         where: { id: app.id },
//         data: { bumchumSyncedAt: syncTime }
//       });

//       successCount++;
//       log(`[${currentIndex}/${totalToProcess}] SUCCESS: App ID: ${app.id} synced to Bumchum.`);

//       // If status is not PENDING, immediately update actual status on Bumchum
//       if (app.status && app.status !== 'PENDING') {
//         try {
//           await updateLoanApplicationToBumchum({
//             user_id: app.userId,
//             updated_by_source: 'FINNAUX',
//             id: app.id,
//             actual_status: app.status,
//             reason: app.reason || ''
//           });
//           log(`[${currentIndex}/${totalToProcess}] STATUS UPDATED: App ID: ${app.id} actual status (${app.status}) updated on Bumchum.`);
//         } catch (statusErr) {
//           const statusErrMsg = statusErr?.response?.data?.message || statusErr?.response?.data || statusErr?.message || String(statusErr);
//           log(`[${currentIndex}/${totalToProcess}] WARN: Failed to update actual status for App ID: ${app.id} on Bumchum: ${JSON.stringify(statusErrMsg)}`);
//         }
//       }
//     } catch (err) {
//       failedCount++;
//       const errMsg = err?.response?.data?.message || err?.response?.data || err?.message || String(err);
//       failedApps.push({ appId: app.id, userId: app.userId, error: errMsg });
//       log(`[${currentIndex}/${totalToProcess}] FAILED: App ID: ${app.id}, User ID: ${app.userId} - ${JSON.stringify(errMsg)}`);
//     }

//     // Delay if not last item
//     if (currentIndex < totalToProcess && !isShuttingDown) {
//       log(`Waiting ${intervalSec}s before next request...`);
//       await sleep(intervalMs);
//     }
//   }

//   log('====================================================');
//   log(`Batch sync run finished.`);
//   log(`Total Processed: ${successCount + failedCount}/${totalToProcess}`);
//   log(`Successfully Synced: ${successCount}`);
//   log(`Failed: ${failedCount}`);
//   if (failedApps.length > 0) {
//     log(`Failed applications summary: ${JSON.stringify(failedApps, null, 2)}`);
//   }
//   log('====================================================');
// }

// runSync()
//   .catch(err => {
//     log(`FATAL ERROR during batch sync: ${err.stack || err.message || err}`);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
