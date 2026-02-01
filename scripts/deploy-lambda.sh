#!/bin/bash

# Use the script file location as the canonical base and build the
# lambda path relative to it. This makes the script independent of
# where it's invoked from — it always starts from the location of
# scripts/deploy-lambda.sh and then goes up one level to ../infra/lambda.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Resolve LAMBDA_BASE_DIR from the script directory (scripts/) -> ../infra/lambda
LAMBDA_BASE_DIR="$(cd "$SCRIPT_DIR/.." &> /dev/null && pwd)/infra/lambda"

echo "Lambda base directory: $LAMBDA_BASE_DIR"

# Check if base dir exists
if [ ! -d "$LAMBDA_BASE_DIR" ]; then
    echo "Error: Directory $LAMBDA_BASE_DIR does not exist."
  exit 1
fi

deploy_lambda() {
  local lambda_name=$1
  local lambda_path="$LAMBDA_BASE_DIR/$lambda_name"

  if [ ! -d "$lambda_path" ]; then
    echo "Error: Lambda directory '$lambda_name' not found in $LAMBDA_BASE_DIR."
    exit 1
  fi

  echo "Preparing to deploy lambda: $lambda_name"

  # Create a temporary directory safely
  local temp_dir=$(mktemp -d)
  local zip_file="${temp_dir}/${lambda_name}.zip"

  echo "Zipping contents of $lambda_path..."
  
  # Navigate to the directory to zip contents at root level
  # This is standard for AWS Lambda zips
  pushd "$lambda_path" > /dev/null
  if ! npm ci --omit=dev --no-audit --no-fund; then
    echo "Error: npm ci failed"
    rm -rf node_modules
    popd > /dev/null
    rm -rf "$temp_dir"
    exit 1
  fi

  # Ensure the lambda always bundles the freshest copy of the local shared utilities
  # Some package managers copy/pack file: dependencies; to be certain we include the
  # working tree version (latest changes), overwrite the installed package with
  # a direct copy from the repository `shared/` folder if it exists.
  SHARED_SRC_DIR="$(cd "$SCRIPT_DIR/.." >/dev/null && pwd)/shared"
  if [ -d "$SHARED_SRC_DIR" ]; then
    echo "Including latest shared/ into lambda bundle..."
    mkdir -p node_modules/@app
    rm -rf node_modules/@app/shared
    # Copy atomically (preserve files). Use rsync when available for speed, fall back to cp.
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --delete "$SHARED_SRC_DIR/" node_modules/@app/shared/
    else
      mkdir -p node_modules/@app/shared
      cp -a "$SHARED_SRC_DIR/." node_modules/@app/shared/
    fi
  else
    echo "Warning: shared/ directory not found at $SHARED_SRC_DIR — continuing without local overlay"
  fi

  if ! zip -rq "$zip_file" .; then
    echo "Error: Failed to zip lambda content."
    popd > /dev/null
    rm -rf "$temp_dir"
    exit 1
  fi
  rm -rf node_modules
  popd > /dev/null

  local aws_profile="${AWS_PROFILE:-static-websites}"
  echo "Uploading to AWS using profile '$aws_profile'..."
  
  # Upload new code to $LATEST
  if ! aws lambda update-function-code \
    --function-name "$lambda_name" \
    --zip-file "fileb://$zip_file" \
    --profile "$aws_profile" > /dev/null; then
    echo ""
    echo "❌ Failed to upload code for $lambda_name"
    rm -rf "$temp_dir"
    exit 1
  fi

  # Wait for the function update to finish before publishing a version.
  # Publishing immediately after update-function-code can fail with
  # ResourceConflictException if Lambda is still applying the update.
  echo "Waiting for function update to complete..."
  max_wait=${LAMBDA_UPDATE_TIMEOUT:-60} # seconds, configurable via env
  interval=2
  elapsed=0
  while true; do
    status=$(aws lambda get-function-configuration \
      --function-name "$lambda_name" --profile "$aws_profile" \
      --query 'LastUpdateStatus' --output text 2>/dev/null) || status=""
    if [ "$status" = "Successful" ]; then
      break
    fi
    if [ "$status" = "Failed" ]; then
      reason=$(aws lambda get-function-configuration \
        --function-name "$lambda_name" --profile "$aws_profile" \
        --query 'LastUpdateStatusReason' --output text 2>/dev/null)
      echo "❌ Function update failed: $reason"
      rm -rf "$temp_dir"
      exit 1
    fi
    if [ "$elapsed" -ge "$max_wait" ]; then
      echo "❌ Timeout waiting for function update to complete (waited ${max_wait}s)"
      rm -rf "$temp_dir"
      exit 1
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done

  # Publish a new immutable version from $LATEST so we can point aliases at it
  echo "Publishing new version..."
  version=$(aws lambda publish-version \
    --function-name "$lambda_name" \
    --profile "$aws_profile" \
    --query 'Version' --output text) || {
    echo "❌ Failed to publish version for $lambda_name"
    rm -rf "$temp_dir"
    exit 1
  }

  echo "Published version: $version"

  # Decide alias name (default: live)
  alias_name="${LAMBDA_ALIAS:-live}"

  # If the alias exists, update it to point to the new version, otherwise create it
  if aws lambda get-alias --function-name "$lambda_name" --name "$alias_name" --profile "$aws_profile" > /dev/null 2>&1; then
    echo "Updating alias '$alias_name' -> $version"
    if ! aws lambda update-alias --function-name "$lambda_name" --name "$alias_name" --function-version "$version" --profile "$aws_profile" > /dev/null; then
      echo "❌ Failed to update alias $alias_name for $lambda_name"
      rm -rf "$temp_dir"
      exit 1
    fi
  else
    echo "Creating alias '$alias_name' -> $version"
    if ! aws lambda create-alias --function-name "$lambda_name" --name "$alias_name" --function-version "$version" --description "alias created by deploy-lambda.sh" --profile "$aws_profile" > /dev/null; then
      echo "❌ Failed to create alias $alias_name for $lambda_name"
      rm -rf "$temp_dir"
      exit 1
    fi
  fi

  # Optional: provisioned concurrency (if set, update for the alias/qualifier)
  if [ -n "${PROVISIONED_CONCURRENCY:-}" ]; then
    echo "Configuring provisioned concurrency (${PROVISIONED_CONCURRENCY}) for $alias_name..."
    if ! aws lambda put-provisioned-concurrency-config \
      --function-name "$lambda_name" \
      --qualifier "$alias_name" \
      --provisioned-concurrent-executions "$PROVISIONED_CONCURRENCY" \
      --profile "$aws_profile" > /dev/null; then
      echo "❌ Failed to put provisioned concurrency config for $lambda_name:$alias_name"
      rm -rf "$temp_dir"
      exit 1
    fi

    # Wait until the provisioned concurrency is ready (poll)
    echo -n "Waiting for provisioned concurrency to become READY"
    for i in {1..30}; do
      status_pc=$(aws lambda get-provisioned-concurrency-config \
        --function-name "$lambda_name" --qualifier "$alias_name" --profile "$aws_profile" --query 'RequestedProvisionedConcurrentExecutions' --output text 2>/dev/null) || status_pc=""
      if [ -n "$status_pc" ]; then
        echo " -> ready"
        break
      fi
      echo -n "."
      sleep 2
    done
  fi

  # Clean up
  rm -rf "$temp_dir"

  echo ""
  echo "✅ Deployment complete: $lambda_name (version $version) -> alias '$alias_name'"
}

# If argument provided, use it
if [ -n "$1" ]; then
  deploy_lambda "$1"
else
  echo "Select a lambda function to deploy:"
  
  # List directories in infra/lambda
  # We assume all subdirectories are potential lambdas
  options=()
  for dir in "$LAMBDA_BASE_DIR"/*/; do
    [ -d "$dir" ] && options+=("$(basename "$dir")")
  done
  
  if [ ${#options[@]} -eq 0 ]; then
    echo "No lambda functions found."
    exit 1
  fi

  PS3="Enter number (or 'q' to quit): "
  select opt in "${options[@]}"; do
    if [[ -n "$opt" ]]; then
      deploy_lambda "$opt"
      break
    elif [[ "$REPLY" == "q" ]]; then
      echo "Exiting."
      exit 0
    else
      echo "Invalid selection."
    fi
  done
fi
