#!/bin/sh
# Yankee Office - spustenie na Linuxe
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  if ! curl -s "http://localhost:$PORT/" >/dev/null 2>&1; then
    python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
    SERVER=$!
    trap 'kill $SERVER' INT TERM EXIT
    sleep 1
  fi
  xdg-open "http://localhost:$PORT/index.html" >/dev/null 2>&1 &
  echo "Yankee Office bezi na http://localhost:$PORT/ - Ctrl+C ukonci."
  wait
else
  xdg-open index.html
fi
