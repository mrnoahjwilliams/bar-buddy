export function deploymentConfig(origin) {
  let backend;
  try {
    backend = new URL(origin);
  } catch {
    throw new Error(
      'BACKEND_ORIGIN must be the deployed backend HTTPS origin.',
    );
  }
  if (
    backend.protocol !== 'https:' ||
    backend.username ||
    backend.password ||
    backend.pathname !== '/' ||
    backend.search ||
    backend.hash
  ) {
    throw new Error(
      'BACKEND_ORIGIN must be HTTPS with no credentials, path, query, or fragment.',
    );
  }
  return {
    version: 3,
    routes: [
      {
        src: '/(.*)',
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'X-Frame-Options': 'DENY',
        },
        continue: true,
      },
      {
        src: '/api(/.*)?',
        dest: `${backend.origin}/api$1`,
        headers: {
          'Cache-Control': 'private, no-store',
          'CDN-Cache-Control': 'no-store',
        },
      },
      {
        src: '/(sw\\.js|index\\.html|manifest\\.webmanifest)',
        headers: { 'Cache-Control': 'no-cache' },
        continue: true,
      },
      { handle: 'filesystem' },
      { src: '/assets/.*', status: 404 },
      {
        src: '/.*',
        dest: '/index.html',
        methods: ['GET', 'HEAD'],
        headers: { 'Cache-Control': 'no-cache' },
      },
    ],
  };
}
