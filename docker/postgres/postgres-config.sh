#!/bin/bash
set -e

apply_setting() {
  local file_path="$1"
  local search_string="$2"

  # Check if the file contains the given string
  if ! grep -qF "$search_string" "$file_path"; then
    printf "$search_string\n" >> "$file_path"
  fi
}

echo ">>> Span Postgres config initialization"
# Do any sort of initializations or pre-startup tasks here
apply_setting /var/lib/postgresql/data/postgresql.conf "enable_nestloop = off"

# Reload postgres config
pg_ctl reload
