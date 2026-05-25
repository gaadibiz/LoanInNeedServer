try {
    require('./middleware/authMiddleware');
    console.log('authMiddleware loaded successfully');
} catch (e) {
    console.error(e);
    process.exit(1);
}
