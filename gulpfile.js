'use strict';

/**
 * Requires gulp 4.0:
 *   "gulp": "git://github.com/gulpjs/gulp#4.0"
 */

/******************************* Dependencies ********************************/

var $      = require('gulp-load-plugins')();
var bsync  = require('browser-sync').create();
var gulp   = require('gulp');
var hjs    = require('highlight.js');
var marked = require('gulp-marked/node_modules/marked');
var flags  = require('yargs').argv;
var pt     = require('path');
var shell  = require('shelljs');

/********************************** Globals **********************************/

var src = {
  lib: 'src/simple-pjax.ts',
  docHtml: 'src-docs/html/**/*',
  docScripts: 'src-docs/scripts/**/*.js',
  docStylesCore: 'src-docs/styles/app.scss',
  docStyles: 'src-docs/styles/**/*.scss',
  docImages: 'src-docs/images/**/*',
  docFonts: 'node_modules/font-awesome/fonts/**/*'
};

var destBase = 'gh-pages';

var dest = {
  lib:        'lib',
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
var linkDef = marked.Renderer.prototype.link;

// Custom link renderer func that adds target="_blank" to links to other sites.
// Mostly copied from the marked source.
marked.Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
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
  return gulp.src(src.lib)
    .pipe($.plumber())
    .pipe($.typescript({target: 'ES5'}))
    .pipe(gulp.dest(dest.lib));
});

gulp.task('lib:minify', function(done) {
  shell.exec('npm run minify', done);
});

gulp.task('lib:build', gulp.series('lib:clear', 'lib:compile', 'lib:minify'));

gulp.task('lib:watch', function() {
  $.watch(src.lib, gulp.series('lib:build'));
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

/*--------------------------------- Scripts ---------------------------------*/

gulp.task('docs:scripts:clear', function() {
  return gulp.src(dest.docScripts, {read: false, allowEmpty: true})
    .pipe($.plumber())
    .pipe($.rimraf());
});

gulp.task('docs:scripts:compile', function() {
  return gulp.src(src.docScripts)
    .pipe($.plumber())
    .pipe($.babel({
      modules: 'system',
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
    }))
    .pipe(gulp.dest(dest.docScripts));
});

gulp.task('docs:scripts:build', gulp.series('docs:scripts:clear', 'docs:scripts:compile'));

gulp.task('docs:scripts:watch', function() {
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
      baseDir: './',
      middleware: function(req, res, next) {
        req.url = req.url.replace(/^\/simple-pjax\//, '').replace(/^[/]*/, '/');

        if (/node_modules/.test(req.url) || /bower_components/.test(req.url) ||
            /gh-pages/.test(req.url) || /lib/.test(req.url) || /system\.config\.js/.test(req.url)) {
          next();
          return;
        }

        if (req.url === '/') req.url = 'index.html';
        req.url = '/' + pt.join(dest.docHtml, req.url);

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
  'lib:build', 'docs:html:build', 'docs:scripts:build', 'docs:styles:build',
  'docs:images:build', 'docs:fonts:build'
));

gulp.task('watch', gulp.parallel(
  'lib:watch', 'docs:html:watch', 'docs:scripts:watch', 'docs:styles:watch',
  'docs:images:watch', 'docs:fonts:watch'
));

gulp.task('default', gulp.series('build', gulp.parallel('watch', 'server')));
