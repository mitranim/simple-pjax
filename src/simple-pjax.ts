'format cjs';

declare const module: any;
interface Window {simplePjaxConfig: any}

!function() {
  'use strict';

  // No-op outside browser.
  if (typeof window !== 'object' || !window) return;

  // No-op if pushState is unavailable.
  if (typeof history.pushState !== 'function') return;

  // Shadow frequently used globals (helps with minification).
  const document = window.document;
  const location = window.location;

  // Configuration.
  const config = {
    loadIndicatorDelay: 250,
    onIndicateLoadStart() {
      document.documentElement.style.transition = 'opacity linear 0.05s';
      document.documentElement.style.opacity = '0.8';
    },
    onIndicateLoadEnd() {
      document.documentElement.style.transition = null;
      document.documentElement.style.opacity = null;
    }
  };

  // Current request. Only one can be active at a time.
  let currentXhr: XMLHttpRequest;

  // Current pathname and query, used to detect useless popstate events.
  let lastPathname: string;
  let lastQuery: string;
  rememberPath();

  // Scripts that have already been downloaded by the browser by src.
  const scripts = Object.create(null);

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

    // Ignore links to other sites.
    if ((anchor.protocol + '//' + anchor.host) !== location.origin) return;

    // Ignore links for other tabs or windows.
    if (anchor.target === '_blank' || anchor.target === '_top') return;

    // Ignore hash links on the same page.
    if ((anchor.pathname === location.pathname) && !!anchor.hash) return;

    // Ignore links with the data-force-reload attribute.
    if (anchor.hasAttribute('data-force-reload')) return;

    // Load clicked link.
    event.preventDefault();
    transitionTo(anchor, true);
  });

  window.addEventListener('popstate', () => {
    // Ignore useless popstate events (initial popstate in Webkit and popstate
    // on hash changes).
    if (pathUnchanged()) return;
    rememberPath();
    transitionTo(location, false);
  });

  function transitionTo(urlUtil: HTMLAnchorElement|Location, isPush: boolean): void {
    // Must capture href now because it may mysteriously change later if
    // document parsing fails.
    const href = urlUtil.href;

    // No-op if the URL is identical.
    if (isPush && (urlUtil.href === location.href)) return;

    // No-op if a request is currently in progress.
    if (!!currentXhr) return;

    const xhr = currentXhr = new XMLHttpRequest();

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status > 299) {
        xhr.onerror(null);
        return;
      }

      const newDocument = getDocument(xhr);
      if (!newDocument) {
        xhr.onerror(null);
        return;
      }

      if (isPush) {
        history.pushState(null, newDocument.title, href);
        rememberPath();
      }

      syncDocument(newDocument);
      indicateLoadEnd();

      // Scroll to the appropriate position.
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      if (target instanceof HTMLElement) {
        target.scrollIntoView();
      } else if (isPush && (!(urlUtil instanceof HTMLElement) || !urlUtil.hasAttribute('data-noscroll'))) {
        window.scrollTo(0, 0);
      }

      // Provide a hook for scripts that may want to run when the document
      // is loaded.
      document.dispatchEvent(createEvent('DOMContentLoaded'));
    };

    xhr.onabort = xhr.onerror = xhr.ontimeout = function() {
      if (isPush) history.pushState(null, '', href);
      location.reload();
    };

    xhr.open('GET', href);
    // IE compat: responseType must be set after opening the request.
    xhr.responseType = 'document';
    xhr.send(null);

    indicateLoadStart(xhr);
  }

  function indicateLoadStart(xhr: XMLHttpRequest): void {
    if (config.loadIndicatorDelay > 0) {
      const id = setTimeout(function() {
        if (xhr.readyState === 4) {
          clearTimeout(id);
          return;
        }
        if (typeof config.onIndicateLoadStart === 'function') {
          config.onIndicateLoadStart();
        }
      }, config.loadIndicatorDelay);
    }
  }

  function indicateLoadEnd(): void {
    if (config.loadIndicatorDelay > 0 && typeof config.onIndicateLoadEnd === 'function') {
      config.onIndicateLoadEnd();
    }
    currentXhr = null;
  }

  // TODO test in Opera.
  function getDocument(xhr: XMLHttpRequest): HTMLDocument {
    const type = xhr.getResponseHeader('Content-Type') || 'text/html';
    // Ignore non-HTML resources, such as XML or plan text.
    if (!/html/.test(type)) return null;
    if (xhr.responseXML) return xhr.responseXML;
    return new DOMParser().parseFromString(xhr.responseText, 'text/html');
  }

  function syncDocument(doc: HTMLDocument): void {
    document.title = doc.title;
    registerExistingScripts();
    removeKnownScripts(doc);
    // Remove scripts from the new document before replacing the body. There's
    // an inconsistency between Blink and Webkit: Blink will ignore these
    // scripts, but Webkit will execute them when the body is replaced. To avoid
    // this, we remove the scripts to re-add them later.
    const pairs = replaceScriptsWithPlaceholders(doc);
    document.body = doc.body;
    replacePlaceholdersWithScripts(pairs);
  }

  function registerExistingScripts(): void {
    for (let i = 0; i < document.scripts.length; ++i) {
      const script = <HTMLScriptElement>document.scripts[i];
      if (script.src) scripts[script.src] = null;
    }
  }

  function removeKnownScripts(doc: HTMLDocument): void {
    [].slice.call(doc.scripts).forEach(function(script) {
      if (script.src in scripts && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    });
  }

  function replaceScriptsWithPlaceholders(doc: HTMLDocument) {
    return [].slice.call(doc.scripts).map(function(script) {
      const holder = document.createElement('script');
      script.parentNode.insertBefore(holder, script);
      script.parentNode.removeChild(script);
      return {holder: holder, script: script};
    });
  }

  function replacePlaceholdersWithScripts(pairs): void {
    for (let i = 0; i < pairs.length; ++i) {
      const holder = pairs[i].holder;
      const script = pairs[i].script;
      if (!holder.parentNode) continue;
      // Only insert the script back if it doesn't have a d.write or
      // d.open call (example: script inserted by the browsersync dev
      // server). Executing one of these on a live document destroys its
      // contents.
      if (!destroysDocument(script)) {
        holder.parentNode.insertBefore(copyScript(script), holder);
      }
      holder.parentNode.removeChild(holder);
    }
  }

  function copyScript(script: HTMLScriptElement): HTMLScriptElement {
    const copy = document.createElement('script');
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

  // IE compat: IE doesn't support dispatching events created with constructors,
  // at least not for document.dispatchEvent.
  function createEvent(name: string): Event {
    const event = document.createEvent('Event');
    event.initEvent(name, true, true);
    return event;
  }
}();
