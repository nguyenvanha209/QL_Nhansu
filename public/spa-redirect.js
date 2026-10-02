// Giải mã đường dẫn do public/404.html chuyển hướng (SPA trên GitHub Pages)
// /?/admin/danh-muc  ->  /admin/danh-muc
(function (l) {
  if (l.search[1] === '/') {
    var decoded = l.search
      .slice(1)
      .split('&')
      .map(function (s) { return s.replace(/~and~/g, '&') })
      .join('?')
    window.history.replaceState(null, null, l.pathname.slice(0, -1) + decoded + l.hash)
  }
})(window.location)
