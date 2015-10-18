<div data-render-demo></div>

```javascript
// Assuming React 0.14+
import React from 'react'
import {render} from 'react-dom'

const Demo = () => (
  <div className='theme-primary pad'>
    I'm rendered with React!
  </div>
)

onEachLoad(() => {
  const elem = document.getElementById('demoComponent')
  if (elem) render(<Demo />, elem)
})

function onEachLoad (callback) {
  if (/loaded|complete|interactive/.test(document.readyState)) {
    callback()
  }
  document.addEventListener('DOMContentLoaded', callback)
}
```
