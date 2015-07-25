import 'stylific';
import 'simple-pjax';
import React from 'react';

@renderTo('[is="demoComponent"]')
class Demo extends React.Component {
  render() {return (
    <div className='theme-primary pad'>This paragraph is rendered with React!</div>
  )}
}

function renderTo(selector: string) {
  return (Component: typeof React.Component) => {
    onEachLoad(() => {
      const elements = document.querySelectorAll(selector);
      for (let i = 0; i < elements.length; ++i) {
        React.render(<Component/>, elements[i]);
      }
    });
  };
}

function onEachLoad(callback: () => void): void {
  if (/loaded|complete|interactive/.test(document.readyState)) callback();
  document.addEventListener('DOMContentLoaded', callback);
}
