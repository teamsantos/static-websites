#!/bin/bash
set -e

# Get the absolute path to the project root (assuming script is in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDA_ROOT="$PROJECT_ROOT/infra/lambda"

echo "🚀 Starting installation of dependencies for all Lambda functions..."

for lambda_dir in "$LAMBDA_ROOT"/*/; do
    # Check if it's a directory and has package.json
    if [ -d "$lambda_dir" ] && [ -f "$lambda_dir/package.json" ]; then
        lambda_name=$(basename "$lambda_dir")
        echo "--------------------------------------------------"
        echo "📦 Installing dependencies for: $lambda_name"
        
        # Use a subshell to change directory without affecting the main script
        (
            cd "$lambda_dir"
            npm install
        )
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully installed dependencies for $lambda_name"
        else
            echo "❌ Failed to install dependencies for $lambda_name"
            exit 1
        fi
    fi
done

echo "--------------------------------------------------"
echo "🎉 All Lambda function dependencies have been prepared!"
