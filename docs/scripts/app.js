/* global localStorage, location, getComputedStyle */

import 'stylific'
import React from 'react'
import {renderTo} from './utils'

if (isPjaxEnabled()) require('simple-pjax')

function isPjaxEnabled () {
  return !localStorage.getItem('disablePjax')
}

function togglePjax () {
  if (isPjaxEnabled()) localStorage.setItem('disablePjax', ' ')
  else localStorage.removeItem('disablePjax')
}

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

        <p>This text is rendered with <a href='http://facebook.github.io/react/' target='_blank'>React</a>. Note that it works when leaving and revisiting the page, and that the scripts are downloaded and executed just <em>once</em>, on the initial page load.</p>

        <p>To make this work, we need to render React components in a <code>simple-pjax-after-transition</code> listener, and unmount them in a <code>simple-pjax-before-transition</code> listener. See this demo's <a href='https://github.com/Mitranim/simple-pjax/blob/master/docs/scripts/utils.js' target='_blank'>source</a> for examples.</p>
      </div>
    )
  }
}
