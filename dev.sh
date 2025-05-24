#!/bin/bash
set -e

script_path=$(readlink -f "$0")
dir=$(dirname "$script_path")
cd "$dir" || exit

docker compose -p zysk up -d --remove-orphans

pnpm install --frozen-lockfile

pnpm run dev:web &
pnpm run dev:temporal &

wait
