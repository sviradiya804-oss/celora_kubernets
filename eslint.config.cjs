const eslintPluginPrettier = require('eslint-plugin-prettier');

/** @type {import("eslint").Linter.FlatConfig[]} */
module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly'
      }
    },
    plugins: {
      prettier: eslintPluginPrettier
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
