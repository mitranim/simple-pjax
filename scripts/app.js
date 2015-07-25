System.register(['stylific', 'simple-pjax', 'react'], function (_export) {
  'use strict';

  var React, Demo;

  function _defaults(obj, defaults) { var keys = Object.getOwnPropertyNames(defaults); for (var i = 0; i < keys.length; i++) { var key = keys[i]; var value = Object.getOwnPropertyDescriptor(defaults, key); if (value && value.configurable && obj[key] === undefined) { Object.defineProperty(obj, key, value); } } return obj; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : _defaults(subClass, superClass); }

  function renderTo(selector) {
    return function (Component) {
      onEachLoad(function () {
        var elements = document.querySelectorAll(selector);
        for (var i = 0; i < elements.length; ++i) {
          React.render(React.createElement(Component, null), elements[i]);
        }
      });
    };
  }

  function onEachLoad(callback) {
    if (/loaded|complete|interactive/.test(document.readyState)) callback();
    document.addEventListener('DOMContentLoaded', callback);
  }
  return {
    setters: [function (_stylific) {}, function (_simplePjax) {}, function (_react) {
      React = _react['default'];
    }],
    execute: function () {
      Demo = (function (_React$Component) {
        _inherits(Demo, _React$Component);

        function Demo() {
          _classCallCheck(this, _Demo);

          _React$Component.apply(this, arguments);
        }

        Demo.prototype.render = function render() {
          return React.createElement(
            'div',
            { className: 'theme-primary pad' },
            'This paragraph is rendered with React!'
          );
        };

        var _Demo = Demo;
        Demo = renderTo('[is="demoComponent"]')(Demo) || Demo;
        return Demo;
      })(React.Component);
    }
  };
});