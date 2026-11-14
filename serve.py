#!/usr/bin/env python3
"""A Temporary Island: local server.

Serves this folder like `python3 -m http.server`, and also lets the
controller's "Save view" write the saved camera views straight into
views.json in this folder, so they travel with the project when you zip it.

    python3 serve.py          # http://localhost:8080
    python3 serve.py 8081     # another port

Only reachable from this computer (127.0.0.1). Uses Python's standard
library only, so nothing to install, no internet needed.
"""

import json
import os
import shutil
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
VIEWS = os.path.join(ROOT, 'views.json')
MAX_BYTES = 1_000_000


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    # Never cache: after unzipping a new version, a normal reload shows it.
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] == '/api/ping':
            return self._json(200, {'ok': True})
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?')[0] != '/api/views':
            return self._json(404, {'error': 'not found'})
        # Only JSON posts: another website can't send those without the browser
        # asking first, and this server never says yes, so it can't overwrite views.json.
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self._json(415, {'error': 'expected application/json'})
        try:
            n = int(self.headers.get('Content-Length', '0'))
            if n <= 0 or n > MAX_BYTES:
                return self._json(413, {'error': 'bad size'})
            data = json.loads(self.rfile.read(n).decode('utf-8'))
            if not isinstance(data, dict):
                return self._json(400, {'error': 'expected an object'})
            # write the new file first; only then back up the old one and swap,
            # so views.json is never missing if a write fails
            tmp = VIEWS + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
                f.write('\n')
            if os.path.exists(VIEWS):
                shutil.copy2(VIEWS, VIEWS + '.bak')
            os.replace(tmp, VIEWS)
            return self._json(200, {'ok': True, 'count': len(data)})
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {'error': 'invalid JSON'})
        except OSError as e:
            return self._json(500, {'error': str(e)})

    def _json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # quiet: only report saves and errors
        msg = fmt % args
        if 'POST' in msg or ' 404 ' in msg or ' 500 ' in msg:
            sys.stderr.write(f'  {msg}\n')


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    try:
        httpd = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    except OSError:
        print(f'Port {port} is already in use. Close the other server, or run: python3 serve.py {port + 1}')
        sys.exit(1)
    print('A Temporary Island is running.')
    print(f'  Controller: http://localhost:{port}/control.html')
    print(f'  Viewer:     http://localhost:{port}/viewer.html')
    print(f'Saved camera views are written to {VIEWS}')
    print('Press Ctrl+C to stop.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()
