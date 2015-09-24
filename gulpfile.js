'use strict';

/**
 * Requires gulp 4.0:
 *   "gulp": "git://github.com/gulpjs/gulp#4.0"
 */

/******************************* Dependencies ********************************/

const $       = require('gulp-load-plugins')();
const bsync   = require('browser-sync').create();
const gulp    = require('gulp');
const hjs     = require('highlight.js');
const marked  = require('gulp-marked/node_modules/marked');
const flags   = require('yargs').argv;
const pt      = require('path');
const webpack = require('webpack');

/********************************** Globals **********************************/

const filename = 'simple-pjax';

const src = {
  libTs: 'src/simple-pjax.ts',
  libJs: `dist/${filename}.js`,
  docHtml: 'src-docs/html/**/*',
  docScripts: 'src-docs/scripts/**/*.js',
  docScriptsCore: 'src-docs/scripts/app.js',
  docStyles: 'src-docs/styles/**/*.scss',
  docStylesCore: 'src-docs/styles/app.scss',
  docImages: 'src-docs/images/**/*',
  docFonts: 'node_modules/font-awesome/fonts/**/*'
};

const destBase = 'gh-pages';

const dest = {
  lib:       'dist',
  docHtml:    destBase,
  docScripts: destBase + '/scripts',
  docStyles:  destBase + '/styles',
  docImages:  destBase + '/images',
  docFonts:   destBase + '/fonts'
};

function prod() {
  return flags.prod === true || flags.prod === 'true';
}

function reload(done) {
  bsync.reload();
  done();
}

/********************************** Config ***********************************/

/**
 * Change how marked compiles links to add target="_blank" to links to other sites.
 */

// Default link renderer func.
const linkDef = marked.Renderer.prototype.link;

// Custom link renderer func that adds target="_blank" to links to other sites.
// Mostly copied from the marked source.
marked.Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      const prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  let out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  if (/^[a-z]+:\/\//.test(href)) {
    out += ' target="_blank"';
  }
  out += '>' + text + '</a>';
  return out;
};

/*********************************** Tasks ***********************************/

/*----------------------------------- Lib -----------------------------------*/

gulp.task('lib:clear', function() {
  return gulp.src(dest.lib, {read: false, allowEmpty: true})
    .pipe($.plumber())
    .pipe($.rimraf());
});

gulp.task('lib:compile', function() {
  return gulp.src(src.libTs)
    .pipe($.plumber())
    .pipe($.typescript({
      target: 'ES3',
      module: 'commonjs'
    }))
    .pipe($.replace(/^/, '"format cjs";\n'))
    .pipe($.rename(`${filename}.js`))
    .pipe(gulp.dest(dest.lib));
});

// gulp.task('lib:global', function() {
//   return gulp.src(src.libJs)
//     .pipe($.replace(/^/, ``))
//     .pipe($.replace(/$/, ``))
//     .pipe($.rename(`${filename}.global.js`))
//     .pipe(gulp.dest(dest.lib));
// });

gulp.task('lib:minify', function() {
  return gulp.src(src.libJs)
    .pipe($.uglify({
      mangle: true,
      lint: true
    }))
    .pipe($.rename(`${filename}.min.js`))
    .pipe(gulp.dest(dest.lib));
});

gulp.task('lib:build', gulp.series('lib:clear', 'lib:compile', /* 'lib:global', */ 'lib:minify'));

gulp.task('lib:watch', function() {
  $.watch(src.libTs, gulp.series('lib:build'));
});

/*---------------------------------- HTML -----------------------------------*/

gulp.task('docs:html:clear', function() {
  return gulp.src(dest.docHtml + '/**/*.html', {read: false, allowEmpty: true})
    .pipe($.plumber())
    .pipe($.rimraf());
});

gulp.task('docs:html:compile', function() {
  var filterMd = $.filter('**/*.md')

  return gulp.src(src.docHtml)
    .pipe($.plumber())
    // Pre-process markdown files.
    .pipe(filterMd)
    .pipe($.marked({
      gfm:         true,
      tables:      true,
      breaks:      false,
      sanitize:    false,
      smartypants: false,
      pedantic:    false,
      // Code highlighter.
      highlight: function(code, lang) {
        var result = lang ? hjs.highlight(lang, code) : hjs.highlightAuto(code);
        return result.value;
      }
    }))
    // Add hljs code class.
    .pipe($.replace(/<pre><code class="(.*)">|<pre><code>/g,
                    '<pre><code class="hljs $1">'))
    // Return other files.
    .pipe(filterMd.restore())
    // Unpack commented HTML parts.
    .pipe($.replace(/<!--\s*:((?:[^:]|:(?!\s*-->))*):\s*-->/g, '$1'))
    // Render all html.
    .pipe($.statil({imports: {prod: prod}}))
    // Change each `<filename>` into `<filename>/index.html`.
    .pipe($.rename(function(path) {
      switch (path.basename + path.extname) {
        case 'index.html': case '404.html': return;
      }
      path.dirname = pt.join(path.dirname, path.basename);
      path.basename = 'index';
    }))
    // Write to disk.
    .pipe(gulp.dest(dest.docHtml));
});

gulp.task('docs:html:build', gulp.series('docs:html:clear', 'docs:html:compile'));

gulp.task('docs:html:watch', function() {
  $.watch(src.docHtml, gulp.series('docs:html:build', reload));
});

/* -------------------------------- Scripts ---------------------------------*/

gulp.task('docs:scripts:build', function (done) {
  var alias = {
    'stylific': 'stylific/lib/stylific.min',
    'simple-pjax': pt.join(process.cwd(), src.libJs)
  };
  if (prod()) alias.react = 'react/dist/react.min';

  webpack({
    entry: './' + src.docScriptsCore,
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
    plugins: prod() ? [new webpack.optimize.UglifyJsPlugin()] : []
  }, function (err, stats) {
    if (err) {
      throw new Error(err);
    } else {
      var report = stats.toString({
        colors: true,
        chunks: false,
        timings: false,
        version: false,
        hash: false,
        assets: false
      });
      if (report) console.log(report);
    }
    done();
  });
});

gulp.task('docs:scripts:watch', function () {
  $.watch(src.docScripts, gulp.series('docs:scripts:build', reload));
});

/*--------------------------------- Styles ----------------------------------*/

gulp.task('docs:styles:clear', function() {
  return gulp.src(dest.docStyles, {read: false, allowEmpty: true})
    .pipe($.plumber())
    .pipe($.rimraf());
});

gulp.task('docs:styles:compile', function() {
  return gulp.src(src.docStylesCore)
    .pipe($.plumber())
    .pipe($.sass())
    .pipe($.autoprefixer())
    .pipe($.if(prod(), $.minifyCss({
      keepSpecialComments: 0,
      aggressiveMerging: false,
      advanced: false
    })))
    .pipe(gulp.dest(dest.docStyles))
    .pipe(bsync.reload({stream: true}));
});

gulp.task('docs:styles:build',
  gulp.series('docs:styles:clear', 'docs:styles:compile'));

gulp.task('docs:styles:watch', function() {
  $.watch(src.docStyles, gulp.series('docs:styles:build'));
  $.watch('node_modules/stylific/scss/**/*.scss', gulp.series('docs:styles:build'));
});

/*--------------------------------- Images ----------------------------------*/

gulp.task('docs:images:clear', function() {
  return gulp.src(dest.docImages, {read: false, allowEmpty: true})
    .pipe($.plumber())
    .pipe($.rimraf());
});

gulp.task('docs:images:copy', function() {
  return gulp.src(src.docImages)
    .pipe(gulp.dest(dest.docImages))
    .pipe(bsync.reload({stream: true}));
});

gulp.task('docs:images:build', gulp.series('docs:images:clear', 'docs:images:copy'));

gulp.task('docs:images:watch', function() {
  $.watch(src.docImages, gulp.series('docs:images:build'));
});

/*---------------------------------- Fonts ----------------------------------*/

gulp.task('docs:fonts:clear', function() {
  return gulp.src(dest.docFonts, {read: false, allowEmpty: true}).pipe($.rimraf());
});

gulp.task('docs:fonts:copy', function() {
  return gulp.src(src.docFonts).pipe(gulp.dest(dest.docFonts));
});

gulp.task('docs:fonts:build', gulp.series('docs:fonts:copy'));

gulp.task('docs:fonts:watch', function() {
  $.watch(src.docFonts, gulp.series('docs:fonts:build', reload));
});

/*--------------------------------- Server ----------------------------------*/

gulp.task('server', function() {
  return bsync.init({
    startPath: '/simple-pjax/',
    server: {
      baseDir: dest.docHtml,
      middleware: function(req, res, next) {
        req.url = req.url.replace(/^\/simple-pjax\//, '').replace(/^[/]*/, '/');
        next();
      }
    },
    port: 4573,
    online: false,
    ui: false,
    files: false,
    ghostMode: false,
    notify: true
  });
});

/*--------------------------------- Default ---------------------------------*/

gulp.task('build', gulp.parallel(
  gulp.series('lib:build', 'docs:scripts:build'), 'docs:html:build',
  'docs:styles:build', 'docs:images:build', 'docs:fonts:build'
));

gulp.task('watch', gulp.parallel(
  'lib:watch', 'docs:scripts:watch', 'docs:html:watch', 'docs:styles:watch',
  'docs:images:watch', 'docs:fonts:watch'
));

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'server')));
