#!/bin/bash
# Yankee Office - spustenie na Macu (dvojklik)
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  if ! curl -s "http://localhost:$PORT/" >/dev/null 2>&1; then
    python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
    sleep 1
  fi
  open "http://localhost:$PORT/index.html"
  echo "Yankee Office bezi na http://localhost:$PORT/ - zatvorte toto okno pre ukoncenie."
  wait
else
  open index.html
fi
