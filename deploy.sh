#!/usr/bin/env bash
# Deploy to Vercel production and keep the clean URL pointed at the newest build.
set -euo pipefail

ALIAS="rohan-renovation.vercel.app"

echo "▶ Building & deploying to production…"
DEP_URL=$(vercel deploy --prod --yes | tail -1)

echo "▶ Pointing $ALIAS at $DEP_URL"
vercel alias set "$DEP_URL" "$ALIAS"

echo "✓ Live at https://$ALIAS"
