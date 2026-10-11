#!/bin/bash
cd "$(dirname "$0")"
fuser -k 54329/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
echo "Menjalankan Sistem PoliMedia (Database + Next.js)..."
npx tsx scripts/prod-server.ts
