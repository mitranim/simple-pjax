'format cjs';

!function() {
  'use strict';

  // No-op outside browser.
  if (typeof window !== 'object' || !window) return;

  /**
   * Configuration.
   */
  var config = {
    indicateLoadAfter: 250,
    onIndicateLoadStart: function() {
      document.documentElement.style.transition = 'opacity linear 0.05s';
      document.documentElement.style.opacity = 0.8;
    },
    onIndicateLoadEnd: function() {
      document.documentElement.style.transition = null;
      document.documentElement.style.opacity = null;
    }
  };

  // Current request. Only one can be active at a time.
  var currentXhr = null;

  // Current pathname and query, used to detect useless popstate events.
  var lastPathname = location.pathname;
  var lastQuery = location.search;

  // Ids used for placeholder scripts.
  var id = 0;

  // Expose configuration object.
  if (typeof module === 'object' && module && module.exports) {
    module.exports = config;
  } else {
    window.simplePjaxConfig = config;
  }

  // Scripts that have already been downloaded by src.
  var scripts = Object.create(null);

  // No-op if pushState is unavailable.
  if (typeof history.pushState !== 'function') return;

  document.addEventListener('click', function(event) {
    // Find a clicked <a>. No-op if no anchor is available.
    var anchor = event.target;
    do {
      if (anchor instanceof HTMLAnchorElement) break;
    } while (anchor = anchor.parentElement);
    if (!anchor) return;

    // Ignore modified clicks.
    if (event.button !== 0) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    // Ignore links to other pages.
    if ((anchor.protocol + '//' + anchor.host) !== location.origin) return;

    // Ignore hash links on the same page.
    if ((anchor.pathname === location.pathname) && !!anchor.hash) return;

    // Load clicked link.
    event.preventDefault();
    transitionTo(anchor, true);
  });

  window.addEventListener('popstate', function(event) {
    // Ignore useless popstate events (initial popstate in Webkit and popstate
    // on hash changes).
    if (lastPathname === location.pathname && lastQuery === location.search) return;
    lastPathname = location.pathname;
    lastQuery = location.search;
    transitionTo(location, false);
  });

  function transitionTo(urlUtil /* implements URLUtils */, isPush) {
    // Must capture href now because it may mysteriously change later if
    // document parsing fails.
    var href = urlUtil.href;

    // No-op if the URL is identical.
    if (isPush && (urlUtil.href === location.href)) return;

    // No-op if a request is currently in progress.
    if (!!currentXhr) return;

    var xhr = currentXhr = new XMLHttpRequest();
    xhr.responseType = 'document';

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status > 299) {
        if (isPush) history.pushState(null, '', href);
        xhr.onerror();
        return;
      }

      var newDocument = getDocument(xhr);
      if (!newDocument) {
        xhr.onerror();
        return;
      }

      syncDocument(newDocument);
      indicateLoadEnd();

      if (isPush) history.pushState(null, newDocument.title, href);

      // Scroll to the appropriate position.
      var target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      if (target instanceof HTMLElement) {
        target.scrollIntoView();
      } else if (isPush && (!(urlUtil instanceof HTMLElement) || !urlUtil.hasAttribute('data-noscroll'))) {
        window.scrollTo(0, 0);
      }

      // Provide a hook for scripts that may want to run when the document
      // is loaded.
      document.dispatchEvent(new Event('DOMContentLoaded'));
    };

    xhr.onabort = xhr.onerror = xhr.ontimeout = function() {
      indicateLoadEnd();
      location.reload();
    };

    xhr.open('GET', href);
    xhr.send(null);

    indicateLoadStart(xhr);
  }

  function indicateLoadStart(xhr) {
    if ((config.indicateLoadAfter | 0) > 0) {
      var id = setTimeout(function() {
        if (xhr.readyState === 4) {
          clearTimeout(4);
          return;
        }
        if (typeof config.onIndicateLoadStart === 'function') {
          config.onIndicateLoadStart();
        }
      }, config.indicateLoadAfter);
    }
  }

  function indicateLoadEnd() {
    if (typeof config.onIndicateLoadEnd === 'function') {
      config.onIndicateLoadEnd();
    }
    currentXhr = null;
  }

  // TODO test in Opera.
  function getDocument(xhr) {
    if (xhr.responseXML) return xhr.responseXML;
    var parser = new DOMParser();
    return parser.parseFromString(xhr.responseText, 'text/html');
  }

  function syncDocument(doc) {
    document.title = doc.title;
    registerExistingScripts();
    removeKnownScripts(doc);
    // Remove scripts from the new document before replacing the body. There's
    // an inconsistency between Blink and Webkit: Blink will ignore these
    // scripts, but Webkit will execute them when the body is replaced. To avoid
    // this, we remove the scripts to re-add them later.
    var pairs = replaceScriptsWithPlaceholders(doc);
    document.body = doc.body;
    replacePlaceholdersWithScripts(pairs);
  }

  function registerExistingScripts() {
    for (var i = 0; i < document.scripts.length; ++i) {
      var script = document.scripts[i];
      if (script.src) scripts[script.src] = null;
    }
  }

  function removeKnownScripts(doc) {
    [].slice.call(doc.scripts).forEach(function(script) {
      if (script.src in scripts) script.remove();
    });
  }

  function replaceScriptsWithPlaceholders(doc) {
    return [].slice.call(doc.scripts).map(function(script) {
      var holder = document.createElement('script');
      script.parentNode.insertBefore(holder, script);
      script.remove();
      return {holder: holder, script: script};
    });
  }

  function replacePlaceholdersWithScripts(pairs) {
    for (var i = 0; i < pairs.length; ++i) {
      var holder = pairs[i].holder;
      var script = pairs[i].script;
      if (!holder.parentNode) continue;
      // Only insert the script back if it doesn't have a document.write or
      // document.open call (example: script inserted by the browsersync dev
      // server). Executing one of these on a live document destroys its
      // contents.
      if (!destroysDocument(script)) {
        holder.parentNode.insertBefore(copyScript(script), holder);
      }
      holder.remove();
    }
  }

  function copyScript(script) {
    var copy = document.createElement('script');
    ['id', 'src', 'async', 'defer', 'type', 'charset', 'textContent'].forEach(function(propName) {
      if (script[propName]) copy[propName] = script[propName];
    });
    return copy;
  }

  // Very primitive check if the given inline script contains calls that
  // potentially erase the document's contents.
  function destroysDocument(script) {
    return /document\s*\.\s*(?:write|open)\s*\(/.test(script.textContent);
  }
}();
