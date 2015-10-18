/* global localStorage, location, getComputedStyle */

import 'stylific'
import React from 'react'
import {render} from 'react-dom'

if (isPjaxEnabled()) require('simple-pjax')

@renderTo('[data-render-pjax-toggle]')
export class PjaxToggle extends React.Component {
  render () {
    const enabled = isPjaxEnabled()
    return (
      <span>
        <button className={`checkbox checkbox-switch ${enabled ? 'active' : ''}`}
                ref='toggle' onClick={::this.onClick} />
        <span> Pjax is {enabled ? 'enabled' : 'disabled'} (click to toggle).</span>
      </span>
    )
  }

  onClick () {
    togglePjax()
    this.forceUpdate()

    const duration = parseFloat(getComputedStyle(this.refs.toggle).transitionDuration)
    setTimeout(::location.reload, duration)
  }
}

@renderTo('[data-render-demo]')
export class Demo extends React.Component {
  render () {
    return (
      <div className='space-out'>
        <h2>React</h2>

        <p>This text is rendered with <a href='http://facebook.github.io/react/' target='_blank'>React</a>. Note that it works when leaving and revisiting the page. Also note that the scripts are only downloaded and executed <em>once</em>, on the initial page load.</p>

        <p>To make this work, we need to put the <code>React.render</code> call into a <code>DOMContentLoader</code> listener, like so:</p>
      </div>
    )
  }
}

function renderTo (selector: string) {
  return (Component: typeof React.Component) => {
    onEachLoad(() => {
      const elements = document.querySelectorAll(selector)
      ;[].slice.call(elements).forEach(elem => {
        render(<Component />, elem)
      })
    })
  }
}

function onEachLoad (callback: () => void): void {
  if (/loaded|complete|interactive/.test(document.readyState)) callback()
  document.addEventListener('DOMContentLoaded', callback)
}

function isPjaxEnabled () {
  return !localStorage.getItem('disablePjax')
}

function togglePjax () {
  if (isPjaxEnabled()) localStorage.setItem('disablePjax', ' ')
  else localStorage.removeItem('disablePjax')
}
