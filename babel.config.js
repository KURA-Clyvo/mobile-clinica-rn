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
      ...(process.env.NODE_ENV !== 'test' ? ['react-native-reanimated/plugin'] : []),
    ],
  };
};
