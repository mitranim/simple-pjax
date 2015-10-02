declare const module: any;
interface Window {simplePjax: any}
// We're using the recently standardised responseURL property to get the last
// URL fetched by the request in case of redirects, and fall back to link hrefs
// in unsupporting browsers.
interface XMLHttpRequest {responseURL?: string}

const isCommonJs = typeof module === 'object' && module !== null &&
                 typeof module.exports === 'object' && module.exports !== null;

/**
 * Export.
 */
const pjax = {

  /**
   * Configuration.
   */

  // Disables pjax globally.
  disabled: false,

  // How long until we run loading indicators.
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

  /**
   * Methods.
   */

  // Triggers a pjax transition to the current page, reloading it without
  // destroying the JavaScript runtime and other assets.
  reload(): void {
    transitionTo(new Config(location, {
      'data-noscroll': true,
      'data-force-reload': true
    }));
  }
};

// Export in a CommonJS environment, otherwise assign to window.
if (isCommonJs) module.exports = pjax;
else window.simplePjax = pjax;

// Current request. Only one can be active at a time.
let currentXhr: XMLHttpRequest;

// Used to detect useless popstate events.
let lastPathname: string = '';
let lastQuery: string = '';
rememberPath();

// Configuration object for interfacing between anchors, `location`, and
// programmatic triggers.
class Config {
  href: string = '';
  host: string = '';
  hash: string = '';
  pathname: string = '';
  path: string = '';
  protocol: string = '';
  search: string = '';
  isPush: boolean = false;
  rafId: number = null;

  static attrNames = ['data-noscroll', 'data-force-reload', 'data-scroll-to-id'];

  constructor(urlUtil: HTMLAnchorElement|Location, properties?: any) {
    // Copy properties.
    Object.keys(this).forEach(key => {
      if (key in urlUtil) this[key] = urlUtil[key];
    });

    // Define path.
    this.path = this.protocol + '//' + this.host + this.pathname;

    // Copy attributes, if applicable.
    if (urlUtil instanceof HTMLElement) {
      Config.attrNames.forEach(name => {
        if (urlUtil.hasAttribute(name)) {
          this[name] = urlUtil.getAttribute(name);
        }
      });
    }

    // Add any additionally passed properties.
    if (properties) {
      Object.keys(properties).forEach(key => {
        this[key] = properties[key];
      });
    }
  }
}

// Main listener.
document.addEventListener('click', event => {
  // No-op if pjax is disabled.
  if (pjax.disabled) return;

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

  // Ignore links with the data-no-pjax attribute.
  if (anchor.hasAttribute('data-no-pjax')) return;

  // Ignore hash links on the same page if `pjax.scrollOffsetSelector` is
  // unspecified.
  if ((anchor.pathname === location.pathname) && anchor.hash && !pjax.scrollOffsetSelector) {
    return;
  }

  // Load clicked link.
  event.preventDefault();
  transitionTo(new Config(anchor, {isPush: true}));
});

window.addEventListener('popstate', event => {
  // Ignore useless popstate events. This includes initial popstate in Webkit
  // (not in Blink), and popstate on hash changes. Note that we ignore hash
  // changes by not remembering or comparing the hash at all.
  if (pathUnchanged()) return;
  rememberPath();

  /*
   * After a popstate event, Blink/Webkit (what about Edge?) restore the
   * last scroll position the browser remembers for that history entry.
   * Because our XHR is asynchronous and there's a delay before replacing the
   * document, this causes the page to jump around. To prevent that, we
   * artificially readjust the scroll position. If the XHR is finished before
   * the next frame runs, we cancel the task.
   *
   * Webkit (Safari) does receive the correct scroll values, but the page still
   * jumps around. TODO look for a workaround.
   *
   * Unfortunately FF restores the scroll position _before_ firing popstate
   * (which is spec-compliant), so the page still jumps around. To work around
   * this, we would have to listen to scroll events on window and continuously
   * memorize the last scroll position; I'm going to leave the FF behaviour
   * as-is until a better workaround comes up.
   *
   * The FF problem might fix itself:
   *   https://bugzilla.mozilla.org/show_bug.cgi?id=1186774
   *   https://github.com/whatwg/html/issues/39
   */

  const currentX = window.scrollX;
  const currentY = window.scrollY;
  const rafId = requestAnimationFrame(() => {
    window.scrollTo(currentX, currentY);
  });

  transitionTo(new Config(location, {rafId: rafId}));
});

function transitionTo(config: Config): void {
  // Special behaviour if this is a push transition within one page. If it leads
  // to a hash target, try to scroll to it. If not, scroll to the top, iOS-style.
  // In both cases, pjax is not performed.
  const path = location.protocol + '//' + location.host + location.pathname;

  if (config.isPush && config.path === path &&
      config.search === location.search && !('data-force-reload' in config)) {
    // Change the URL and history, if applicable. This needs to be done before
    // changing the scroll position in order to let the browser correctly
    // remember the current position.
    if (config.href !== location.href) {
      history.pushState(null, document.title, config.href);
      rememberPath();
    }

    if (config.hash) {
      // Hash found: try to scroll to it.
      const target = document.querySelector(config.hash);
      if (target instanceof HTMLElement) {
        target.scrollIntoView();
        offsetScroll();
      }
    } else {
      // No hash found: scroll up.
      window.scrollTo(0, 0);
    }

    return;
  }

  // No-op if a request is currently in progress.
  if (!!currentXhr) return;

  const xhr = currentXhr = new XMLHttpRequest();

  xhr.onload = function() {
    if (xhr.status < 200 || xhr.status > 299) {
      xhr.onerror(null);
      return;
    }

    // Cancel the scroll readjustment, if any. If it has already run, this
    // should have no effect.
    if (config.rafId) cancelAnimationFrame(config.rafId);

    currentXhr = null;
    const newDocument = getDocument(xhr);

    if (!newDocument) {
      xhr.onerror(null);
      return;
    }

    if (config.isPush) {
      const replacementHref = xhr.responseURL && (xhr.responseURL !== config.path) ?
                              xhr.responseURL : config.href;
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

    let noScroll = 'data-noscroll' in config;
    let targetId = location.hash ? location.hash.slice(1) : null;
    if (!targetId && config.isPush && 'data-scroll-to-id' in config) {
      targetId = config['data-scroll-to-id'] ||
                 typeof pjax.defaultMainId === 'string' && pjax.defaultMainId;
    }

    // First scroll: before the transition.
    let target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView();
      offsetScroll();
    } else if (!targetId && !noScroll) {
      window.scrollTo(0, 0);
    }

    // Switch to the new document.
    replaceDocument(newDocument);
    indicateLoadEnd();

    // Provide a hook for scripts that may want to run when the document
    // is loaded.
    document.dispatchEvent(createEvent('DOMContentLoaded'));

    // Second scroll: after the transition.
    target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView();
      offsetScroll();
    }
    else if (!noScroll) {
      window.scrollTo(0, 0);
    }
  };

  xhr.onabort = xhr.onerror = xhr.ontimeout = function() {
    currentXhr = null;
    if (config.isPush) history.pushState(null, '', xhr.responseURL || config.href);
    location.reload();
  };

  xhr.open('GET', config.href);
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

// Used with each `history.pushState` call to help us discard redundant popstate
// events.
function rememberPath(): void {
  lastPathname = location.pathname;
  lastQuery = location.search;
}

function pathUnchanged(): boolean {
  return location.pathname === lastPathname &&
         location.search === lastQuery;
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
