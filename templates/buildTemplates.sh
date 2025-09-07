#!/bin/bash

for dir in */; do
    template_name="${dir%/}"
    template_path="../templates/$template_name"
    echo "$template_path"
    node ../helpers/htmlExtractor.js "$template_path"
    TEMPLATE="$template_name" npm run build
    # mv "$template_path/index.html"  "$template_path/processed.html"
    rm "$template_path/index.html" "$template_path/content-loader.js"
    mv "$template_path/index.bak.html" "$template_path/index.html"
done
