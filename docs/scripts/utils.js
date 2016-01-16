import React from 'react'
import {render, unmountComponentAtNode} from 'react-dom'

const unmountQueue = []

export function renderTo (selector: string) {
  return (Component: typeof React.Component) => {
    onload(() => {
      const elements = document.querySelectorAll(selector)
      ;[].forEach.call(elements, element => {
        unmountQueue.push(element)
        render(<Component />, element)
      })
    })
  }
}

document.addEventListener('simple-pjax-before-transition', () => {
  unmountQueue.splice(0).forEach(unmountComponentAtNode)
})

export function onload (callback: Function) {
  if (/loaded|complete|interactive/.test(document.readyState)) {
    callback()
  } else {
    document.addEventListener('DOMContentLoaded', function cb () {
      document.removeEventListener('DOMContentLoaded', cb)
      callback()
    })
  }
  document.addEventListener('simple-pjax-after-transition', callback)
}
