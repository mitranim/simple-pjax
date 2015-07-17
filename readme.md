## Description

Enables faster page transitions with zero configuration. Gives classic
multi-page websites some of the advantages enjoyed by SPA (single-page apps)
for free.

`Pjax` is a combonim of `pushState` and `Ajax`. There are other pjax
implementations floating around, but most of them are jQuery-based or
overengineered. Hence `simple-pjax`.

Rough idea of how page transitions work on most sites:
* Load and parse the new HTML document. Create a new JavaScript runtime.
* Redownload all stylesheets, scripts, fonts, images, etc. (Connections take time even if the resources are cached.)
* Parse and execute the downloaded scripts.
* Parse styles and apply them to the document.
* Throw away the current document and JavaScript runtime, switch to the new document and runtime.
* Download and execute asynchronous scripts, if any.

Page transition with pjax:
* Load and parse the new HTML document.
* Replace the contents of the current document.
* Let it execute the new scripts, if any.

Benefits:
* Skip redownloading stylesheets, scripts, fonts, images.
* Don't execute scripts that have already been executed.
* Keep the JavaScript runtime and WebSocket connections intact.

The benefits are especially dramatic on mobile devies and slow connections.

## Installation

Grab through your favourite package manager:

```sh
npm i --save-dev simple-pjax
jspm install github:Mitranim/simple-pjax
bower i --save Mitranim/simple-pjax
```

Import in your code:

```javascript
import 'simple-pjax';
```

Or include as a script tag:

```html
<script src="simple-pjax.js" async></script>
```

## Usage

Works automatically. When navigating between internal pages, it prevents the
full page reload. Instead, it fetches the new document by ajax and replaces
the contents of the current document.

After downloading the document, executes any _new_ and _inline_ scripts found in
it. Ignores scripts that have been previously downloaded.

Affects both `<a>` clicks and `popstate` history events, such as when the back
button is clicked.

Visibly indicates loading when it takes a while (by default after 250 ms). You
can customise the timeout and the functions called to add and remove the
indicator.

## Configuration

`simple-pjax` works without configuration, but also exposes a configuration
object with some options. In the presense of a CommonJS system, the config
object is exported. Otherwise it's assigned as `window.simplePjaxConfig`.

Example config.

```javascript
import config from 'simple-pjax';

// Timeout before calling the loading indicator function. Set to 0 to disable.
config.indicateLoadAfter = 100;

// Called when loading takes a while. Use it to display a custom loading indicator.
config.onIndicateLoadStart = function() {
  document.documentElement.style.opacity = 0.5;
};

// Called when loading ends. Use it to hide a custom loading indicator.
config.onIndicateLoadEnd = function() {
  document.documentElement.style.opacity = null;
};
```

## Compatibility

Should work on IE10+. Has no effect in browsers that don't support
`history.pushState`.

## TODO

Make a demo.
