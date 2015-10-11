## TOC

* [Description](#description)
* [Installation](#installation)
* [Usage](#usage)
* [Configuration](#configuration)
* [Methods](#methods)
* [Gotchas](#gotchas)

## Description

Lean library that improves page loading times for classic multi-page websites.
Gives them some of the advantages enjoyed by SPA (single-page apps).
Configuration is optional.

See a simple demo at http://mitranim.com/simple-pjax/.

Read an explanatory post at http://mitranim.com/thoughts/cheating-for-performance-pjax/.

`Pjax` is a combo of `pushState` and `Ajax`. There are
[other](https://github.com/defunkt/jquery-pjax) pjax implementations floating
around, but most of them are jQuery-based or overengineered. Hence `simple-pjax`.

To explain what pjax is about, first let's get a rough idea of how page
transitions work on most sites:
* Load and parse the new HTML document. Create a new JavaScript runtime.
* Redownload all stylesheets, scripts, fonts, images, etc. (Connections take time even if the resources are cached.)
* Parse and execute the downloaded scripts.
* Parse styles and apply them to the document.
* Throw away the current document and JavaScript runtime, switch to the new document and runtime.
* Download and execute asynchronous scripts, if any.

Here's how page transitions work with simple-pjax:
* Load and parse the new HTML document.
* Replace the contents of the current document.
* Let it execute the new scripts, if any.

Benefits:
* Don't redownload stylesheets, scripts, fonts, images.
* Don't execute scripts that have already been executed.
* Keep the JavaScript runtime and WebSocket connections intact.

The benefits are especially dramatic on mobile devies and slow connections.

Works on IE10+. Has no effect in browsers that don't support
`history.pushState`.

## Installation

Grab through your favourite package manager:

```sh
npm i --save-dev simple-pjax
jspm install npm:simple-pjax
```

Import in your code:

```javascript
import pjax from 'simple-pjax';
```

Or include as a script tag:

```html
<script src="simple-pjax.js" async></script>
```

## Usage

Works automatically. When navigating between internal pages, the library
prevents a full page reload. Instead, it fetches the new document by ajax and
replaces the contents of the current document.

After replacing the document, it executes any _inline_ scripts found in it.
Ignores scripts with an `src` under the assumption that all pages have the same
set of scripts, and they have already been downloaded.

Affects both `<a>` clicks and `popstate` history events, such as when the back
button is clicked.

Visibly indicates loading when it takes a while (by default after 250 ms). You
can customise the timeout and the functions called to add and remove the
indicator.

## Configuration

`simple-pjax` works with zero configuration, but it also exports an object with
configurable properties and useful methods. In the presense of a
CommonJS-compliant module system, it does a proper export; otherwise the object
is assigned to `window.simplePjax`.

Example config (see defaults in [source](src/simple-pjax.ts)).

```javascript
import pjax from 'simple-pjax';

// Timeout before calling the loading indicator function. Set to 0 to disable.
pjax.indicateLoadAfter = 100;

// Called when loading takes a while. Use it to display a custom loading indicator.
pjax.onIndicateLoadStart = function() {
  document.documentElement.style.opacity = 0.5;
};

// Called when loading ends. Use it to hide a custom loading indicator.
pjax.onIndicateLoadEnd = function() {
  document.documentElement.style.opacity = null;
};

// If a selector string is provided, it's checked every time when scrolling
// to an element (e.g. via data-scroll-to-id). If an element with the
// {position: 'fixed', top: '0px'} computed style properties is found, the
// scroll position will be offset by that element's height.
pjax.scrollOffsetSelector = '.navbar-fixed';

// If a string is provided, it will be used as the default value (default
// element `id`) for the `[data-scroll-to-id]` attribute.
pjax.defaultMainId = 'mainView';
```

You can prevent page scroll by adding the `data-noscroll` attribute to a
link:

```html
<a href="/other-page" data-noscroll>clicking me doesn't scroll the page!</a>
```

If you want an individual link without pjax behaviour, add the `data-no-pjax`
attribute:

```html
<a href="/other-page" data-no-pjax>I have native behaviour!</a>
```

By default, links to the same page are ignored. If you want to force a page
refresh, add the `data-force-reload` attribute. This reload doesn't affect
scroll position:

```html
<a href="/current-page" data-force-reload>I sneakily refresh the page when clicked!</a>
```

## Methods

simple-pjax exports one simple method that sneakily refreshes the current page,
as if you clicked a `<a>` leading to this page. The refresh is done through pjax
and doesn't destroy the JS runtime and other assets. It also doesn't affect
scroll position.

```js
import pjax from 'simple-pjax';

pjax.reload();
```

## Gotchas

You need to watch out for code that modifies the DOM on page load. Most websites
have this in the form of analytics and UI widgets. When transitioning to a new
page, that code must be re-executed to modify the new document body.

`simple-pjax` mitigates this in two ways.

First, it automatically executes any inline scripts found in the new document.
If you embed analytics and DOM bootstrap scripts inline, they
should work out-of-the-box.

Second, it proposes a convention: when transitioning to a new page and replacing
the document body, the `DOMContentLoaded` event is artificially re-emitted.
Non-inline code that wants to run on document load should listen for this event
and rerun after each page transition.

The popular `jQuery#ready` method automatically detaches listeners after running
them once. If you're using it in non-inline scripts, you'll need to add a
`DOMContentLoaded` listener to rerun that logic on each new page.

`simple-pjax` is compatible out of the box with
[React](http://facebook.github.io/react/). Put your `React.render` calls into
a `DOMContentLoaded` listener, and your React widgets will render just fine.

Doesn't work out of the box with Angular and Polymer due to how their bootstrap
process works. Please let me know if you find any workarounds.

## ToDo

Investigate if it's possible to get the final URL of an XHR after a server
redirect without using `responseURL`, which is still not supported in Safari 8.0
and IE 11.
