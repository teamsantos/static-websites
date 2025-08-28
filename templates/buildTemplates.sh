for dir in */; do
  TEMPLATE="${dir%/}" npm run build
done
