const logger = require('./logger');

/**
 * Streams a JSON array to the HTTP response with built-in TCP backpressure handling.
 * This guarantees that massive amounts of data won't crash the Node.js memory heap.
 * 
 * @param {object} res - Express Response object
 * @param {Array} ids - Array of IDs to chunk
 * @param {number} chunkSize - Number of items to fetch per chunk
 * @param {Function} fetchChunkFn - Async function(chunkIds) that returns formatted array of objects
 */
async function streamJsonArray(res, ids, chunkSize, fetchChunkFn) {
    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.write('{"data":[');

    let isFirstItem = true;
    let totalProcessed = 0;

    for (let i = 0; i < ids.length; i += chunkSize) {
        if (res.destroyed) {
            logger.warn(`[STREAM] Client disconnected mid-stream. Halting export.`);
            break;
        }

        const chunkIds = ids.slice(i, i + chunkSize);
        
        // Fetch and format the chunk
        const chunkResults = await fetchChunkFn(chunkIds);
        if (!chunkResults || chunkResults.length === 0) continue;

        // Stream results
        for (const item of chunkResults) {
            if (res.destroyed) break;

            if (!isFirstItem) {
                if (!res.write(',')) {
                    await waitForDrain(res);
                }
            }
            if (res.destroyed) break;

            if (!res.write(JSON.stringify(item))) {
                await waitForDrain(res);
            }
            isFirstItem = false;
        }

        totalProcessed += chunkResults.length;

        // Force Event Loop to yield so V8 Garbage Collector can clean up massive memory blocks
        await new Promise(resolve => setImmediate(resolve));
    }

    if (!res.destroyed) {
        res.write(']}');
        res.end();
        logger.info(`[STREAM] Completed Successfully for ${totalProcessed} records.`);
    }
}

function waitForDrain(res) {
    return new Promise(resolve => {
        if (res.destroyed) return resolve();
        res.once('drain', resolve);
        res.once('close', resolve);
        res.once('error', resolve);
    });
}

module.exports = {
    streamJsonArray
};
