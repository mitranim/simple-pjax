## Console

This page logs a message to the console on each visit. Note how the messages
persist between visits. The JavaScript runtime stays intact until you reload the
tab.

`simple-pjax` automatically executes inline scripts found on the newly
downloaded page. This makes it out-of-the-box compatible with analytics snippets
and other DOM mutators included inline.

<script>
  console.log('Visited the console page at', Date.now());
</script>
