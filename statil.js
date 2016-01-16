'use strict'

const hljs = require('highlight.js')
const marked = require('marked')
const pt = require('path')
const flags = require('yargs').boolean('prod').argv

/*
 * Markdown config
 */

marked.setOptions({
  smartypants: true,
  highlight (code, lang) {
    const result = lang ? hljs.highlight(lang, code) : hljs.highlightAuto(code)
    return result.value
  }
})

// Custom link renderer func that adds target="_blank" to links to other sites.
// Mostly copied from the marked source.
marked.Renderer.prototype.link = function (href, title, text) {
  if (this.options.sanitize) {
    let prot = ''
    try {
      prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase()
    } catch (e) {
      return ''
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return ''
    }
  }
  let out = '<a href="' + href + '"'
  if (title) {
    out += ' title="' + title + '"'
  }
  if (/^[a-z]+:\/\//.test(href)) {
    out += ' target="_blank"'
  }
  out += '>' + text + '</a>'
  return out
}

/*
 * Statil config
 */

module.exports = {
  imports: {prod: flags.prod},
  ignorePaths: path => (
    /^partials/.test(path)
  ),
  rename: '$&/index.html',
  renameExcept: ['index.html', '404.html'],
  pipeline: [
    (content, path) => (
      pt.extname(path) === '.md'
        ? marked(content)
          // Add hljs code class.
          .replace(/<pre><code class="(.*)">|<pre><code>/g, '<pre><code class="hljs $1">')
          // Unpack commented HTML parts.
          .replace(/<!--\s*:((?:[^:]|:(?!\s*-->))*):\s*-->/g, '$1')
        : content
    )
  ]
}
