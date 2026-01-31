#!/bin/bash

# Use the script file location as the canonical base and build the
# lambda path relative to it.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Resolve LAMBDA_BASE_DIR from the script directory (scripts/) -> ../infra/lambda
LAMBDA_BASE_DIR="$(cd "$SCRIPT_DIR/.." &> /dev/null && pwd)/infra/lambda"

echo "Lambda base directory: $LAMBDA_BASE_DIR"

# Check if base dir exists
if [ ! -d "$LAMBDA_BASE_DIR" ]; then
    echo "Error: Directory $LAMBDA_BASE_DIR does not exist."
  exit 1
fi

get_logs() {
  local lambda_name=$1
  local lambda_path="$LAMBDA_BASE_DIR/$lambda_name"

  # Validate local existence first (mirrors deploy-lambda.sh behavior)
  if [ ! -d "$lambda_path" ]; then
    echo "Error: Lambda directory '$lambda_name' not found in $LAMBDA_BASE_DIR."
    exit 1
  fi

  local aws_profile="${AWS_PROFILE:-static-websites}"
  # Assuming standard AWS Lambda log group naming convention
  local log_group_name="/aws/lambda/$lambda_name"

  echo "Fetching log streams for log group: $log_group_name"
  echo "Using AWS Profile: $aws_profile"

  # List the top 5 most recent log streams
  # Note: The prompt mentioned "log groups" but typically one lists "log streams" for a specific lambda/log group.
  local streams_json
  streams_json=$(aws logs describe-log-streams \
    --log-group-name "$log_group_name" \
    --order-by LastEventTime \
    --descending \
    --limit 5 \
    --profile "$aws_profile" \
    --output json 2>&1)

  local status=$?
  if [ $status -ne 0 ]; then
    echo "Error fetching log streams. Verify the lambda exists and has generated logs."
    echo "Details: $streams_json"
    exit $status
  fi

  # Check if streams exist
  local stream_count
  stream_count=$(echo "$streams_json" | jq '.logStreams | length')

  if [ -z "$stream_count" ] || [ "$stream_count" -eq 0 ]; then
    echo "No log streams found for $log_group_name."
    exit 0
  fi

  echo "Select a log stream to view:"
  
  local options=()
  while IFS= read -r name; do
    options+=("$name")
  done < <(echo "$streams_json" | jq -r '.logStreams[].logStreamName')

  local selected_stream=""

  if [ "$AUTO_LATEST" = "true" ] && [ ${#options[@]} -gt 0 ]; then
    selected_stream="${options[0]}"
  elif [ ${#options[@]} -eq 1 ]; then
    selected_stream="${options[0]}"
  fi

  if [ -z "$selected_stream" ]; then
    PS3="Enter number (or 'q' to quit): "
    select opt in "${options[@]}"; do
      if [[ -n "$opt" ]]; then
        selected_stream="$opt"
        break
      elif [[ "$REPLY" == "q" ]]; then
        echo "Exiting."
        exit 0
      else
        echo "Invalid selection."
      fi
    done
  fi

  if [ -n "$selected_stream" ]; then
    echo "Fetching logs for stream: $selected_stream..."
    echo "----------------------------------------"
    aws logs get-log-events \
      --log-group-name "$log_group_name" \
      --log-stream-name "$selected_stream" \
      --profile "$aws_profile" \
      --output text
  fi
}

LAMBDA_NAME=""
AUTO_LATEST=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --latest)
      AUTO_LATEST=true
      shift
      ;;
    *)
      if [ -z "$LAMBDA_NAME" ]; then
        LAMBDA_NAME="$1"
      fi
      shift
      ;;
  esac
done

# If argument provided, use it
if [ -n "$LAMBDA_NAME" ]; then
  get_logs "$LAMBDA_NAME"
else
  echo "Select a lambda function to get logs for:"
  
  # List directories in infra/lambda
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
      get_logs "$opt"
      break
    elif [[ "$REPLY" == "q" ]]; then
      echo "Exiting."
      exit 0
    else
      echo "Invalid selection."
    fi
  done
fi
