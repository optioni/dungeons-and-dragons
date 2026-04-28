#!/bin/sh
set -e

MODEL="${OLLAMA_MODEL:-mxbai-embed-large}"

ollama serve &
SERVER_PID=$!

until ollama list >/dev/null 2>&1; do
  sleep 1
done

if ! ollama list | grep -q "$MODEL"; then
  echo "Pulling $MODEL..."
  ollama pull "$MODEL"
fi

wait $SERVER_PID
