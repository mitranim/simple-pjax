'use strict'

/**
 * Requires gulp 4.0:
 *   "gulp": "gulpjs/gulp#4.0"
 *
 * Requires Node.js 4.0+
 *
 * Style per http://standardjs.com
 */

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const bsync = require('browser-sync').create()
const del = require('del')
const flags = require('yargs').boolean('prod').argv
const gulp = require('gulp')
const hjs = require('highlight.js')
const marked = require('gulp-marked/node_modules/marked')
const pt = require('path')
const webpack = require('webpack')

/** ******************************* Globals **********************************/

const filename = 'simple-pjax'

const src = {
  libSrc: 'src/simple-pjax.js',
  libJs: `dist/${filename}.js`,
  docHtml: 'src-docs/html/**/*',
  docScripts: 'src-docs/scripts/**/*.js',
  docScriptsCore: 'src-docs/scripts/app.js',
  docStyles: 'src-docs/styles/**/*.scss',
  docStylesCore: 'src-docs/styles/app.scss',
  docImages: 'src-docs/images/**/*',
  docFonts: 'node_modules/font-awesome/fonts/**/*'
}

const destBase = 'gh-pages'

const dest = {
  lib: 'dist',
  docHtml: destBase,
  docScripts: destBase + '/scripts',
  docStyles: destBase + '/styles',
  docImages: destBase + '/images',
  docFonts: destBase + '/fonts'
}

function reload (done) {
  bsync.reload()
  done()
}

/** ******************************* Config ***********************************/

/**
 * Change how marked compiles links to add target="_blank" to links to other sites.
 */

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

/** ******************************** Tasks ***********************************/

/* ---------------------------------- Lib -----------------------------------*/

gulp.task('lib:clear', function (done) {
  del(dest.lib).then((_) => {done()})
})

gulp.task('lib:compile', function () {
  return gulp.src(src.libSrc)
    .pipe($.babel({
      modules: 'ignore',
      optional: [
        'spec.protoToAssign',
        'es7.classProperties'
      ],
      loose: [
        'es6.classes'
      ],
      blacklist: ['strict']
    }))
    .pipe($.wrap(
`/**
 * Source and documentation:
 *   https://github.com/Mitranim/simple-pjax
 */

!function() {
'use strict';

// No-op if not running in a browser.
if (typeof window !== 'object' || !window) return;

// No-op if pushState is unavailable.
if (typeof history.pushState !== 'function') return;

<%= contents %>

}();`))
    .pipe($.rename(`${filename}.js`))
    .pipe(gulp.dest(dest.lib))
})

gulp.task('lib:minify', function () {
  return gulp.src(src.libJs)
    .pipe($.uglify({mangle: true}))
    .pipe($.rename(`${filename}.min.js`))
    .pipe(gulp.dest(dest.lib))
})

gulp.task('lib:build', gulp.series('lib:clear', 'lib:compile', 'lib:minify'))

gulp.task('lib:watch', function () {
  $.watch(src.libSrc, gulp.series('lib:build'))
})

/* --------------------------------- HTML -----------------------------------*/

gulp.task('docs:html:clear', function (done) {
  del(dest.docHtml + '/**/*.html').then((_) => {done()})
})

gulp.task('docs:html:compile', function () {
  const filterMd = $.filter('**/*.md', {restore: true})

  return gulp.src(src.docHtml)
    // Pre-process markdown files.
    .pipe(filterMd)
    .pipe($.marked({
      gfm: true,
      tables: true,
      breaks: false,
      sanitize: false,
      smartypants: false,
      pedantic: false,
      // Code highlighter.
      highlight: function (code, lang) {
        const result = lang ? hjs.highlight(lang, code) : hjs.highlightAuto(code)
        return result.value
      }
    }))
    // Add hljs code class.
    .pipe($.replace(/<pre><code class="(.*)">|<pre><code>/g,
                    '<pre><code class="hljs $1">'))
    // Return other files.
    .pipe(filterMd.restore)
    // Unpack commented HTML parts.
    .pipe($.replace(/<!--\s*:((?:[^:]|:(?!\s*-->))*):\s*-->/g, '$1'))
    // Render all html.
    .pipe($.statil({imports: {prod: flags.prod}}))
    // Change each `<filename>` into `<filename>/index.html`.
    .pipe($.rename(function (path) {
      switch (path.basename + path.extname) {
        case 'index.html': case '404.html': return
      }
      path.dirname = pt.join(path.dirname, path.basename)
      path.basename = 'index'
    }))
    // Write to disk.
    .pipe(gulp.dest(dest.docHtml))
})

gulp.task('docs:html:build', gulp.series('docs:html:clear', 'docs:html:compile'))

gulp.task('docs:html:watch', function () {
  $.watch(src.docHtml, gulp.series('docs:html:build', reload))
})

/* -------------------------------- Scripts ---------------------------------*/

function scripts (done) {
  const watch = typeof done !== 'function'

  const alias = {
    'simple-pjax': pt.join(process.cwd(), src.libJs)
  }
  if (flags.prod) alias.react = 'react/dist/react.min'

  const watcher = webpack({
    entry: pt.join(process.cwd(), src.docScriptsCore),
    output: {
      path: pt.join(process.cwd(), dest.docHtml),
      filename: 'app.js'
    },
    resolve: {
      alias: alias
    },
    module: {
      loaders: [
        {
          test: /\.jsx?$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel',
          query: {
            modules: 'common',
            optional: [
              'spec.protoToAssign',
              'es7.classProperties',
              'es7.decorators',
              'es7.functionBind',
              'validation.undeclaredVariableCheck'
            ],
            loose: [
              'es6.classes',
              'es6.properties.computed',
              'es6.forOf'
            ]
          }
        }
      ]
    },
    plugins: flags.prod ? [
      new webpack.optimize.UglifyJsPlugin({compress: {warnings: false}})
    ] : [],
    watch: watch,
    cache: false
  }, onComplete)

  // Workaround for webpack watcher not picking up changes in lib files.
  if (watch) {
    $.watch(src.libJs, () => {
      watcher.compiler.run(onComplete)
    })
  }

  function onComplete (err, stats) {
    if (err) {
      throw new Error(err)
    } else {
      const report = stats.toString({
        colors: true,
        chunks: false,
        timings: true,
        version: false,
        hash: false,
        assets: false
      })
      if (report) console.log(report)
    }
    if (watch) bsync.reload()
    else done()
  }
}

gulp.task('docs:scripts:build', scripts)

gulp.task('docs:scripts:build:watch', (_) => {scripts()})

/* -------------------------------- Styles ----------------------------------*/

gulp.task('docs:styles:clear', function (done) {
  del(dest.docStyles).then((_) => {done()})
})

gulp.task('docs:styles:compile', function () {
  return gulp.src(src.docStylesCore)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.if(flags.prod, $.minifyCss({
      keepSpecialComments: 0,
      aggressiveMerging: false,
      advanced: false
    })))
    .pipe(gulp.dest(dest.docStyles))
    .pipe(bsync.reload({stream: true}))
})

gulp.task('docs:styles:build',
  gulp.series('docs:styles:clear', 'docs:styles:compile'))

gulp.task('docs:styles:watch', function () {
  $.watch(src.docStyles, gulp.series('docs:styles:build'))
  $.watch('node_modules/stylific/scss/**/*.scss', gulp.series('docs:styles:build'))
})

/* -------------------------------- Images ----------------------------------*/

gulp.task('docs:images:clear', function (done) {
  del(dest.docImages).then((_) => {done()})
})

gulp.task('docs:images:copy', function () {
  return gulp.src(src.docImages)
    .pipe(gulp.dest(dest.docImages))
    .pipe(bsync.reload({stream: true}))
})

gulp.task('docs:images:build', gulp.series('docs:images:clear', 'docs:images:copy'))

gulp.task('docs:images:watch', function () {
  $.watch(src.docImages, gulp.series('docs:images:build'))
})

/* --------------------------------- Fonts ----------------------------------*/

gulp.task('docs:fonts:clear', function (done) {
  del(dest.docFonts).then((_) => {done()})
})

gulp.task('docs:fonts:copy', function () {
  return gulp.src(src.docFonts).pipe(gulp.dest(dest.docFonts))
})

gulp.task('docs:fonts:build', gulp.series('docs:fonts:copy'))

gulp.task('docs:fonts:watch', function () {
  $.watch(src.docFonts, gulp.series('docs:fonts:build', reload))
})

/* -------------------------------- Server ----------------------------------*/

gulp.task('server', function () {
  return bsync.init({
    startPath: '/simple-pjax/',
    server: {
      baseDir: dest.docHtml,
      middleware: function (req, res, next) {
        req.url = req.url.replace(/^\/simple-pjax\//, '').replace(/^[/]*/, '/')
        next()
      }
    },
    port: 4573,
    online: false,
    ui: false,
    files: false,
    ghostMode: false,
    notify: true
  })
})

/* -------------------------------- Default ---------------------------------*/

if (flags.prod) {
  gulp.task('build', gulp.parallel(
    gulp.series('lib:build', 'docs:scripts:build'),
    'docs:html:build', 'docs:styles:build', 'docs:images:build', 'docs:fonts:build'
  ))
} else {
  gulp.task('build', gulp.parallel(
    'lib:build', 'docs:html:build', 'docs:styles:build', 'docs:images:build', 'docs:fonts:build'
  ))
}

gulp.task('watch', gulp.parallel(
  'lib:watch', 'docs:scripts:build:watch', 'docs:html:watch', 'docs:styles:watch',
  'docs:images:watch', 'docs:fonts:watch'
))

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'server')))
