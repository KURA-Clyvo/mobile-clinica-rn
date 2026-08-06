module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*', '/node_modules/*'],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
    },
  },
};
