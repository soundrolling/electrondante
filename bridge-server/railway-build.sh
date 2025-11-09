#!/bin/bash
# Railway build script - forces npm install in bridge-server directory
cd "$(dirname "$0")" || exit 1
npm install --legacy-peer-deps

