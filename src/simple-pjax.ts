declare const module: any;
interface Window {simplePjaxConfig: any}
// We're using the recently standardised responseURL property to get the last
// URL fetched by the request in case of redirects, and fall back to link hrefs
// in unsupporting browsers.
interface XMLHttpRequest {responseURL?: string}

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
  const pjax = {
    loadIndicatorDelay: 250,
    // Called when loading takes longer than `loadIndicatorDelay`. Should
    // visibly indicate the loading.
    onIndicateLoadStart() {
      document.documentElement.style.transition = 'opacity linear 0.05s';
      document.documentElement.style.opacity = '0.8';
    },
    // Called when transition is finished. Should roll back the effects of
    // `onIndicateLoadStart`.
    onIndicateLoadEnd() {
      document.documentElement.style.transition = null;
      document.documentElement.style.opacity = null;
    },
    // If a selector string is provided, it's checked every time when scrolling
    // to an element (e.g. via data-scroll-to-id). If an element with the
    // {position: 'fixed', top: '0px'} computed style properties is found, the
    // scroll position will be offset by that element's height.
    scrollOffsetSelector: null,
    // If a string is provided, it will be used as the default id for the
    // `[data-scroll-to-id]` attribute.
    defaultMainId: null,

    /*
     * Methods.
     */

    // Reloads the current page in a "pjax" way, without destroying the
    // JavaScript runtime and other assets.
    reload({keepScrollPosition} = {keepScrollPosition: true}): void {
      transitionTo(location, false, keepScrollPosition, true);
    }
  };

  // Current request. Only one can be active at a time.
  let currentXhr: XMLHttpRequest;

  // Current pathname and query, used to detect useless popstate events.
  let lastPathname: string;
  let lastQuery: string;
  rememberPath();

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

    // Ignore links intended to affet other tabs or windows.
    if (anchor.target === '_blank' || anchor.target === '_top') return;

    // Ignore hash links on the same page.
    if ((anchor.pathname === location.pathname) && !!anchor.hash) return;

    // Ignore links with the data-no-pjax attribute.
    if (anchor.hasAttribute('data-no-pjax')) return;

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

  function transitionTo(
    urlUtil: HTMLAnchorElement|Location, isPush: boolean,
    keepScrollPosition: boolean = false, forceReload: boolean = false
  ): void {
    // Must capture href now because it may mysteriously change later if
    // document parsing fails.
    const href = urlUtil.href;
    const path = urlUtil.protocol + '//' + urlUtil.host + urlUtil.pathname;

    // No-op if the URL is identical, unless a reload was intended.
    if (isPush && (href === location.href) && !forceReload) return;

    // No-op if a request is currently in progress.
    if (!!currentXhr) return;

    const xhr = currentXhr = new XMLHttpRequest();

    xhr.onload = function() {
      if (xhr.status < 200 || xhr.status > 299) {
        xhr.onerror(null);
        return;
      }

      currentXhr = null;
      const newDocument = getDocument(xhr);

      if (!newDocument) {
        xhr.onerror(null);
        return;
      }

      if (isPush) {
        const replacementHref = xhr.responseURL && (xhr.responseURL !== path) ?
                                xhr.responseURL : href;
        history.pushState(null, newDocument.title, replacementHref);
        rememberPath();
      }

      /*
       * Workaround for a Safari glitch. In Safari, if the document has been
       * scrolled down by the user before the transition, and if it has any
       * fixed-positioned elements, these elements will jump around for a
       * moment after completing a pjax transition. This happens if we only
       * scroll _after_ replacing the document. To avoid this, we basically
       * have to scroll twice: before and after the transition. This doesn't
       * eliminate the problem, but makes it less frequent.
       *
       * Safari truly is the new IE.
       */

      // let target = location.hash ? newDocument.getElementById(location.hash.slice(1)) : null;
      let targetId = location.hash ? location.hash.slice(1) : null;
      let noScroll = keepScrollPosition || false;

      if (!targetId && isPush && urlUtil instanceof HTMLElement) {
        if (keepScrollPosition || urlUtil.hasAttribute('data-noscroll')) {
          noScroll = true;
        } else if (urlUtil.hasAttribute('data-scroll-to-id')) {
          targetId = urlUtil.getAttribute('data-scroll-to-id') ||
                     typeof pjax.defaultMainId === 'string' && pjax.defaultMainId;
        }
      }

      // First scroll: before the transition.
      let target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView();
        offsetScroll();
      }
      else if (!targetId && !noScroll) window.scrollTo(0, 0);

      // Switch to the new document.
      replaceDocument(newDocument);
      indicateLoadEnd();

      // Second scroll: after the transition.
      target = document.getElementById(targetId);
      if (target) {
        // This has to happen in a separate frame in order to give JavaScript
        // components a change to alter the document and give the browser an
        // opportunity to repaint. This way, the scroll position will be more
        // accurate.
        requestAnimationFrame(() => {
          target.scrollIntoView();
          offsetScroll();
        });
      }
      else if (!noScroll) window.scrollTo(0, 0);

      // Provide a hook for scripts that may want to run when the document
      // is loaded.
      document.dispatchEvent(createEvent('DOMContentLoaded'));
    };

    xhr.onabort = xhr.onerror = xhr.ontimeout = function() {
      currentXhr = null;
      if (isPush) history.pushState(null, '', xhr.responseURL || href);
      location.reload();
    };

    xhr.open('GET', href);
    // IE compat: responseType must be set after opening the request.
    xhr.responseType = 'document';
    xhr.send(null);

    indicateLoadStart(xhr);
  }

  function indicateLoadStart(xhr: XMLHttpRequest): void {
    if (pjax.loadIndicatorDelay > 0) {
      const id = setTimeout(function() {
        if (xhr.readyState === 4) {
          clearTimeout(id);
          return;
        }
        if (typeof pjax.onIndicateLoadStart === 'function') {
          pjax.onIndicateLoadStart();
        }
      }, pjax.loadIndicatorDelay);
    }
  }

  function indicateLoadEnd(): void {
    if (pjax.loadIndicatorDelay > 0 && typeof pjax.onIndicateLoadEnd === 'function') {
      pjax.onIndicateLoadEnd();
    }
  }

  // TODO test in Opera.
  function getDocument(xhr: XMLHttpRequest): HTMLDocument {
    const type = xhr.getResponseHeader('Content-Type') || 'text/html';
    // Ignore non-HTML resources, such as XML or plan text.
    if (!/html/.test(type)) return null;
    if (xhr.responseXML) return xhr.responseXML;
    return new DOMParser().parseFromString(xhr.responseText, 'text/html');
  }

  function replaceDocument(doc: HTMLDocument): void {
    document.title = doc.title;
    removeScriptsWithSrc(doc);
    // Remove scripts from the new document before replacing the body. There's
    // an inconsistency between Blink and Webkit: Blink will ignore these
    // scripts, but Webkit will execute them when the body is replaced. To avoid
    // this, we remove the scripts to re-add them later.
    const pairs = replaceScriptsWithPlaceholders(doc);
    document.body = doc.body;
    replacePlaceholdersWithScripts(pairs);
  }

  function removeScriptsWithSrc(doc: HTMLDocument): void {
    [].slice.call(doc.scripts).forEach(function(script) {
      if (!!script.src && !!script.parentNode) {
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
    module.exports = pjax;
  } else {
    window.simplePjaxConfig = pjax;
  }

  // IE compat: IE doesn't support dispatching events created with constructors,
  // at least not for document.dispatchEvent.
  function createEvent(name: string): Event {
    const event = document.createEvent('Event');
    event.initEvent(name, true, true);
    return event;
  }

  // See pjax.scrollOffsetSelector.
  function offsetScroll(): void {
    if (typeof pjax.scrollOffsetSelector === 'string' && pjax.scrollOffsetSelector) {
      const elem = document.querySelector(pjax.scrollOffsetSelector);
      const style = getComputedStyle(elem);
      if (style.position === 'fixed' && style.top === '0px') {
        window.scrollBy(0, -elem.getBoundingClientRect().height);
      }
    }
  }
}();
