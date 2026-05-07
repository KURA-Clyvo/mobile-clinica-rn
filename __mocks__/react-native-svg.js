const React = require('react');
const { View } = require('react-native');

const mock = (name) => {
  const C = ({ children, ...props }) =>
    React.createElement(View, { testID: name, ...props }, children);
  C.displayName = name;
  return C;
};

const Svg = mock('Svg');
Svg.default = Svg;

module.exports = Svg;
module.exports.default = Svg;
module.exports.Path = mock('Path');
module.exports.Circle = mock('Circle');
module.exports.Rect = mock('Rect');
module.exports.Line = mock('Line');
module.exports.G = mock('G');
module.exports.Polyline = mock('Polyline');
module.exports.Polygon = mock('Polygon');
module.exports.Text = mock('SvgText');
module.exports.Defs = mock('Defs');
module.exports.Stop = mock('Stop');
module.exports.LinearGradientSvg = mock('LinearGradientSvg');
