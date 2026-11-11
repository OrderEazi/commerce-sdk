#!/bin/bash
set -e

# Generates the Admin API client into this package's src/generated. It is the Store generator run for the
# admin document, from this folder, so the output lands here and the package name is the admin one.
# See ../../typescript/scripts/generate-client.sh for the requirements (Node and a JRE) and API_URL.

cd "$(dirname "$0")/.."
SDK_SURFACE=admin bash ../typescript/scripts/generate-client.sh
