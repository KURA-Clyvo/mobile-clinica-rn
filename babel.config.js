module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@services': './src/services',
            '@hooks': './src/hooks',
            '@theme': './src/theme',
            '@types': './src/types',
            '@mocks': './src/mocks',
            '@constants': './src/constants',
            '@store': './src/store',
            '@utils': './src/utils',
          },
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        },
      ],
      // react-native-reanimated/plugin MUST be last (added in Task 2.3)
    ],
  };
};
