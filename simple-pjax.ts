'format cjs';

declare const module: any;
interface Window {simplePjaxConfig: any}

!function() {
  'use strict';

  // No-op outside browser.
  if (typeof window !== 'object' || !window) return;

  // Configuration.
  const config = {
    indicateLoadAfter: 250,
    onIndicateLoadStart: function() {
      document.documentElement.style.transition = 'opacity linear 0.05s';
      document.documentElement.style.opacity = '0.8';
    },
    onIndicateLoadEnd: function() {
      document.documentElement.style.transition = null;
      document.documentElement.style.opacity = null;
    }
  };

  // Current request. Only one can be active at a time.
  let currentXhr = null;

  // Current pathname and query, used to detect useless popstate events.
  let lastPathname, lastQuery;
  rememberPath();

  // Ids used for placeholder scripts.
  let id = 0;

  // Scripts that have already been downloaded by src.
  const scripts = Object.create(null);

  // No-op if pushState is unavailable.
  if (typeof history.pushState !== 'function') return;

  document.addEventListener('click', event => {
    // Find a clicked <a>. No-op if no anchor is available.
    let anchor = <HTMLAnchorElement>event.target;
    do {
      if (anchor instanceof HTMLAnchorElement) break;
    } while (anchor = (<any>anchor).parentElement);
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

  window.addEventListener('popstate', event => {
    // Ignore useless popstate events (initial popstate in Webkit and popstate
    // on hash changes).
    if (pathUnchanged()) return;
    rememberPath();
    transitionTo(location, false);
  });

  function transitionTo(urlUtil: HTMLAnchorElement|Location, isPush: boolean): void {
    // Must capture href now because it may mysteriously change later if
    // document parsing fails.
    let href = urlUtil.href;

    // No-op if the URL is identical.
    if (isPush && (urlUtil.href === location.href)) return;

    // No-op if a request is currently in progress.
    if (!!currentXhr) return;

    let xhr = currentXhr = new XMLHttpRequest();
    xhr.responseType = 'document';

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status > 299) {
        if (isPush) history.pushState(null, '', href);
        xhr.onerror(null);
        return;
      }

      let newDocument = getDocument(xhr);
      if (!newDocument) {
        xhr.onerror(null);
        return;
      }

      syncDocument(newDocument);
      indicateLoadEnd();

      if (isPush) {
        history.pushState(null, newDocument.title, href);
        rememberPath();
      }

      // Scroll to the appropriate position.
      let target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
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

  function indicateLoadStart(xhr: XMLHttpRequest): void {
    if ((config.indicateLoadAfter | 0) > 0) {
      let id = setTimeout(function() {
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

  function indicateLoadEnd(): void {
    if (typeof config.onIndicateLoadEnd === 'function') {
      config.onIndicateLoadEnd();
    }
    currentXhr = null;
  }

  // TODO test in Opera.
  function getDocument(xhr: XMLHttpRequest): HTMLDocument {
    if (xhr.responseXML) return xhr.responseXML;
    let parser = new DOMParser();
    return parser.parseFromString(xhr.responseText, 'text/html');
  }

  function syncDocument(doc: HTMLDocument): void {
    document.title = doc.title;
    registerExistingScripts();
    removeKnownScripts(doc);
    // Remove scripts from the new document before replacing the body. There's
    // an inconsistency between Blink and Webkit: Blink will ignore these
    // scripts, but Webkit will execute them when the body is replaced. To avoid
    // this, we remove the scripts to re-add them later.
    let pairs = replaceScriptsWithPlaceholders(doc);
    document.body = doc.body;
    replacePlaceholdersWithScripts(pairs);
  }

  function registerExistingScripts(): void {
    for (let i = 0; i < document.scripts.length; ++i) {
      let script = <HTMLScriptElement>document.scripts[i];
      if (script.src) scripts[script.src] = null;
    }
  }

  function removeKnownScripts(doc: HTMLDocument): void {
    [].slice.call(doc.scripts).forEach(function(script) {
      if (script.src in scripts) script.remove();
    });
  }

  function replaceScriptsWithPlaceholders(doc: HTMLDocument) {
    return [].slice.call(doc.scripts).map(function(script) {
      let holder = document.createElement('script');
      script.parentNode.insertBefore(holder, script);
      script.remove();
      return {holder: holder, script: script};
    });
  }

  function replacePlaceholdersWithScripts(pairs): void {
    for (let i = 0; i < pairs.length; ++i) {
      let holder = pairs[i].holder;
      let script = pairs[i].script;
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

  function copyScript(script: HTMLScriptElement): HTMLScriptElement {
    let copy = document.createElement('script');
    ['id', 'src', 'async', 'defer', 'type', 'charset', 'textContent'].forEach(function(propName) {
      if (script[propName]) copy[propName] = script[propName];
    });
    return copy;
  }

  // Very primitive check if the given inline script contains calls that
  // potentially erase the document's contents.
  function destroysDocument(script: HTMLScriptElement): boolean {
    return /document\s*\.\s*(?:write|open)\s*\(/.test(script.textContent);
  }

  function rememberPath(): void {
    lastPathname = location.pathname;
    lastQuery = location.search;
  }

  function pathUnchanged(): boolean {
    return location.pathname === lastPathname && location.search === lastQuery;
  }

  // Expose configuration object.
  if (typeof module === 'object' && module && module.exports) {
    module.exports = config;
  } else {
    window.simplePjaxConfig = config;
  }
}();
