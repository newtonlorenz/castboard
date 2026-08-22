#!/bin/sh
set -eu

config_path="${CASTBOARD_CONFIG:-/data/castboard.config.json}"
if [ ! -e "$config_path" ]; then
  cp /app/castboard.config.example.json "$config_path"
  chmod 600 "$config_path"
fi

exec "$@"
