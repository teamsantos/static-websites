#!/bin/bash

# Get the absolute path to the project root
# (assuming this script is in [project_root]/scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDA_BASE_DIR="${PROJECT_ROOT}/infra/lambda"

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
  if ! zip -rq "$zip_file" .; then
    echo "Error: Failed to zip lambda content."
    popd > /dev/null
    rm -rf "$temp_dir"
    exit 1
  fi
  popd > /dev/null

  local aws_profile="${AWS_PROFILE:-static-websites}"
  echo "Uploading to AWS using profile '$aws_profile'..."
  
  aws lambda update-function-code \
    --function-name "$lambda_name" \
    --zip-file "fileb://$zip_file" \
    --profile "$aws_profile"

  local status=$?
  
  # Clean up
  rm -rf "$temp_dir"

  if [ $status -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful for $lambda_name"
  else
    echo ""
    echo "❌ Deployment failed for $lambda_name"
    exit $status
  fi
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
