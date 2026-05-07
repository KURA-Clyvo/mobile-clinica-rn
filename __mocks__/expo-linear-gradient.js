const React = require('react');
const { View } = require('react-native');

const LinearGradient = ({ children, colors: _c, start: _s, end: _e, ...props }) =>
  React.createElement(View, { testID: 'LinearGradient', ...props }, children);

LinearGradient.displayName = 'LinearGradient';

module.exports = { LinearGradient };
