## React

This page renders a line of text with [React](http://facebook.github.io/react).
Note that it works when leaving and revisiting the page. Also note that the
scripts don't get redownloaded and re-executed on page transitions.

<div is="demoComponent"></div>

To make this work, we need to put the `React.render` call into a
`DOMContentLoader` listener, like so:

```javascript
class Demo extends React.Component {
  render() {return (
    <div className='theme-primary pad'>
      I'm rendered with React!
    </div>
  )}
}

onEachLoad(() => {
  const elem = document.getElementById('demoComponent');
  if (elem) React.render(<Demo />, elem);
})

function onEachLoad(callback) {
  if (/loaded|complete|interactive/.test(document.readyState)) callback();
  document.addEventListener('DOMContentLoaded', callback);
}
```
