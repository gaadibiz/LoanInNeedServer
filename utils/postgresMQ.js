const PgBoss = require('pg-boss');
const logger = require('./logger');

let boss;

async function initMQ() {
    if (boss) return boss;

    // Use existing Postgres connection string
    const url = process.env.DATABASE_URL;
    if (!url) {
        logger.error('[MQ] DATABASE_URL missing. Cannot start Postgres MQ.');
        return null;
    }

    boss = new PgBoss(url);

    boss.on('error', error => logger.error('[MQ] Postgres MQ Error:', error));

    await boss.start();
    logger.info('[MQ] Postgres MQ Started. Zero-cost Load Balancing activated.');
    
    return boss;
}

async function enqueueJob(queueName, data, options = {}) {
    if (!boss) await initMQ();
    const jobId = await boss.send(queueName, data, options);
    logger.info(`[MQ] Enqueued Job in ${queueName}: ${jobId}`);
    return jobId;
}

async function startWorker(queueName, handler, concurrency = 1) {
    if (!boss) await initMQ();
    
    await boss.work(queueName, { teamSize: concurrency }, async (job) => {
        try {
            logger.info(`[MQ] Processing Job ${job.id} from ${queueName}...`);
            await handler(job.data);
            logger.info(`[MQ] Job ${job.id} completed successfully.`);
        } catch (error) {
            logger.error(`[MQ] Job ${job.id} failed: ${error.message}`);
            throw error; // Let pg-boss handle retries
        }
    });
    
    logger.info(`[MQ] Worker started for ${queueName} with concurrency ${concurrency}`);
}

module.exports = {
    initMQ,
    enqueueJob,
    startWorker
};
