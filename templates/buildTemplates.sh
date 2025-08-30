#!/bin/bash

for dir in */; do
    template_name="${dir%/}"
    template_path="../templates/$template_name"
    echo "$template_path"
    node ../htmlExtractor.js "$template_path"
    cp "$template_path/index.html" "$template_path/index.processed.html"
    awk '{gsub(/<body>/,"<body><h1>test</h1>"); print}' "$template"/index.html >  "$template"/index.html
    TEMPLATE="$template_name" npm run build
done
