#!/bin/bash
set -e

# Get the absolute path to the project root (assuming script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDA_ROOT="$PROJECT_ROOT/infra/lambda"

echo "🚀 Starting delete of node_modules for all Lambda functions..."

for lambda_dir in "$LAMBDA_ROOT"/*/; do
    # Check if it's a directory and has package.json
    if [ -d "$lambda_dir" ] && ([ -d "$lambda_dir/node_modules" ] || [ -d "$lambda_dir/shared" ]); then
        lambda_name=$(basename "$lambda_dir")
        echo "--------------------------------------------------"
        echo "📦 Deleting node_modules for: $lambda_name"
        
        (
            cd "$lambda_dir"
            rm -rf node_modules
            rm -rf shared
        )
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully deleted node_modules for $lambda_name"
        else
            echo "❌ Failed to delete node_modules for $lambda_name"
            exit 1
        fi
    fi
done

echo "--------------------------------------------------"
echo "🎉 All Lambda function node_modules have been deleted!"
