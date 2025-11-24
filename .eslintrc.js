module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier
  ],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    // Prettier integration
    'prettier/prettier': 'error', // Show prettier errors as ESLint errors
    
    // Error prevention
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    
    // Code quality
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-sequences': 'error',
    
    // Best practices
    'array-callback-return': 'error',
    'consistent-return': 'warn',
    'default-case': 'warn',
    'dot-notation': 'error',
    'no-else-return': 'warn',
    'no-empty-function': 'warn',
    'no-implicit-coercion': 'error',
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'require-await': 'warn',
    'yoda': 'error',
    
    // Note: Style rules (formatting) are handled by Prettier
    // eslint-config-prettier automatically disables conflicting rules
    
    // ES6+ (non-formatting rules)
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
  },
};

