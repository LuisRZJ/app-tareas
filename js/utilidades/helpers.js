function now() { return Date.now(); }

function today() {
  const d = new Date();
  return d.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
