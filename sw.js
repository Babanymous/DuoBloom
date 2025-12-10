self.addEventListener('fetch', function(event) {
  // Leerer Fetch-Handler ist nötig, damit Chrome die App als "installierbar" erkennt.
  // In einer echten PWA würde man hier Caching betreiben.
});