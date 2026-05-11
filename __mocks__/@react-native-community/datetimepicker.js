const React = require('react');
const { View } = require('react-native');

function MockDateTimePicker({ testID, onChange, value }) {
  return React.createElement(View, { testID: testID ?? 'date-time-picker' });
}

module.exports = MockDateTimePicker;
module.exports.default = MockDateTimePicker;
