try {
    require('./routes/loanRoutes');
    console.log('loanRoutes loaded successfully');
} catch (e) {
    console.error(e);
    process.exit(1);
}
