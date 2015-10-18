<div data-render-demo></div>

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
