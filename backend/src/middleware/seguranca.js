function cabecalhosSeguranca(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  next();
}

function semCache(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { cabecalhosSeguranca, semCache };
