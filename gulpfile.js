'use strict'

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const bsync = require('browser-sync').create()
const del = require('del')
const flags = require('yargs').boolean('prod').argv
const gulp = require('gulp')
const pt = require('path')
const statilOptions = require('./statil')
const webpack = require('webpack')

/** ******************************* Globals **********************************/

const src = {
  libSrc: 'src/simple-pjax.js',
  libJs: 'dist/simple-pjax.js',
  docHtml: 'docs/html/**/*',
  docScripts: 'docs/scripts/**/*.js',
  docScriptsCore: 'docs/scripts/app.js',
  docStyles: 'docs/styles/**/*.scss',
  docStylesCore: 'docs/styles/app.scss',
  docImages: 'docs/images/**/*',
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

function noop () {}

/** ******************************** Tasks ***********************************/

/* ---------------------------------- Lib -----------------------------------*/

gulp.task('lib:clear', () => (
  del(dest.lib).catch(noop)
))

gulp.task('lib:compile', () => (
  gulp.src(src.libSrc)
    .pipe($.babel({
      modules: 'ignore',
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
    .pipe($.rename('simple-pjax.js'))
    .pipe(gulp.dest(dest.lib))
))

gulp.task('lib:minify', () => (
  gulp.src(src.libJs)
    .pipe($.uglify({mangle: true}))
    .pipe($.rename('simple-pjax.min.js'))
    .pipe(gulp.dest(dest.lib))
))

gulp.task('lib:build', gulp.series('lib:clear', 'lib:compile', 'lib:minify'))

gulp.task('lib:watch', () => {
  $.watch(src.libSrc, gulp.series('lib:build'))
})

/* --------------------------------- HTML -----------------------------------*/

gulp.task('docs:html:clear', () => (
  del(dest.docHtml + '/**/*.html').catch(noop)
))

gulp.task('docs:html:compile', () => (
  gulp.src(src.docHtml)
    .pipe($.statil(statilOptions))
    .pipe(gulp.dest(dest.docHtml))
))

gulp.task('docs:html:build', gulp.series('docs:html:clear', 'docs:html:compile'))

gulp.task('docs:html:watch', () => {
  $.watch(src.docHtml, gulp.series('docs:html:build', reload))
})

/* -------------------------------- Scripts ---------------------------------*/

function scripts (done) {
  const watch = typeof done !== 'function'

  const alias = {
    'simple-pjax': pt.join(process.cwd(), src.libJs)
  }
  if (flags.prod) {
    alias['react'] = 'react/dist/react.min'
    alias['react-dom'] = 'react-dom/dist/react-dom.min'
  }

  const watcher = webpack({
    entry: pt.join(process.cwd(), src.docScriptsCore),
    output: {
      path: pt.join(process.cwd(), dest.docScripts),
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
    watch: watch
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

gulp.task('docs:scripts:build:watch', () => void scripts())

/* -------------------------------- Styles ----------------------------------*/

gulp.task('docs:styles:clear', () => (
  del(dest.docStyles).catch(noop)
))

gulp.task('docs:styles:compile', () => (
  gulp.src(src.docStylesCore)
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.if(flags.prod, $.minifyCss({
      keepSpecialComments: 0,
      aggressiveMerging: false,
      advanced: false
    })))
    .pipe(gulp.dest(dest.docStyles))
    .pipe(bsync.stream())
))

gulp.task('docs:styles:build',
  gulp.series('docs:styles:clear', 'docs:styles:compile'))

gulp.task('docs:styles:watch', () => {
  $.watch(src.docStyles, gulp.series('docs:styles:build'))
  $.watch('node_modules/stylific/scss/**/*.scss', gulp.series('docs:styles:build'))
})

/* -------------------------------- Images ----------------------------------*/

gulp.task('docs:images:clear', () => (
  del(dest.docImages).catch(noop)
))

gulp.task('docs:images:copy', () => (
  gulp.src(src.docImages)
    .pipe(gulp.dest(dest.docImages))
    .pipe(bsync.stream())
))

gulp.task('docs:images:build', gulp.series('docs:images:clear', 'docs:images:copy'))

gulp.task('docs:images:watch', () => {
  $.watch(src.docImages, gulp.series('docs:images:build'))
})

/* --------------------------------- Fonts ----------------------------------*/

gulp.task('docs:fonts:clear', () => (
  del(dest.docFonts).catch(noop)
))

gulp.task('docs:fonts:copy', () => (
  gulp.src(src.docFonts).pipe(gulp.dest(dest.docFonts))
))

gulp.task('docs:fonts:build', gulp.series('docs:fonts:copy'))

gulp.task('docs:fonts:watch', () => {
  $.watch(src.docFonts, gulp.series('docs:fonts:build', reload))
})

/* -------------------------------- Server ----------------------------------*/

gulp.task('server', () => (
  bsync.init({
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
    notify: false
  })
))

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
