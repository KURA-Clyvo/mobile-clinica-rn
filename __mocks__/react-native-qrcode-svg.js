// REC-03 — mesmo padrão de __mocks__/react-native-svg.js: a lib real usa
// `export ... from` (ESM) e não está no allowlist de transformIgnorePatterns
// do jest.config.js; em vez de estender o allowlist (arriscando puxar
// sub-imports de react-native-svg que o mock daquele arquivo não cobre —
// Image/ClipPath/LinearGradient, usados só no caminho de logo, que este app
// não usa), o componente inteiro é substituído por um stub burro. Suficiente
// para os testes desta task, que verificam PRESENÇA/AUSÊNCIA do QR (mordida
// e) e nunca o conteúdo pixel a pixel do código.
const React = require('react');
const { View } = require('react-native');

function QRCode({ value, size, testID }) {
  return React.createElement(View, {
    testID: testID ?? 'mock-qrcode',
    accessibilityValue: { text: value },
    style: { width: size, height: size },
  });
}

module.exports = QRCode;
module.exports.default = QRCode;
