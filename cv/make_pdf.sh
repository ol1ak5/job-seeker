#!/bin/bash
# Rebuild the CV PDFs from Markdown. Run: ./cv/make_pdf.sh
# Fonts, spacing and alignment live in cv/style.css
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for f in CV_Energy CV_AI; do
  pandoc -s "$f.md" -o "/tmp/$f.html" --css=style.css --embed-resources \
    --metadata pagetitle="Olga Aksenova — CV"
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$f.pdf" "/tmp/$f.html" 2>/dev/null
  echo "OK: cv/$f.pdf"
done
