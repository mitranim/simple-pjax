System.defaultJSExtensions = true;

System.config({
  'paths': {
    '*': '/gh-pages/scripts/*',
    'npm:*': '/node_modules/*'
  }
});

System.config({
  'map': {
    'react': 'npm:react/dist/react',
    'stylific': 'npm:stylific/lib/stylific.min',
    'simple-pjax': '/lib/simple-pjax'
  }
});
