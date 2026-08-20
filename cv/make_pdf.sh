#!/bin/bash
# Rebuild CV PDFs from Markdown.
#   ./cv/make_pdf.sh              -> rebuilds the master CVs in cv/master/
#   ./cv/make_pdf.sh cv/tailored/20260817_Acme_Analyst_YourName.md
#                                 -> rebuilds only the files given
# Fonts, spacing and alignment live in web/src/app/cv.css - the same file the
# website uses, so a PDF built here and one printed from the site match.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

if [ "$#" -gt 0 ]; then
  FILES=()
  for arg in "$@"; do
    # accept paths relative to the repo root as well as to cv/
    if [ -f "$arg" ]; then FILES+=("$arg"); else FILES+=("../$arg"); fi
  done
else
  FILES=(master/CV_Energy.md master/CV_AI.md)
fi

for f in "${FILES[@]}"; do
  out="${f%.md}.pdf"
  pandoc -s "$f" -o "/tmp/cv_build.html" --css=../web/src/app/cv.css \
    --embed-resources --metadata pagetitle="CV"
  # every rule is scoped under .cv-document so the site can use the same file
  sed -i '' 's|<body>|<body class="cv-document">|' "/tmp/cv_build.html"
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$out" "/tmp/cv_build.html" 2>/dev/null
  echo "OK: $out"
done
