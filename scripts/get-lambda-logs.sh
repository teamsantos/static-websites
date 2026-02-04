#!/bin/bash

# Use the script file location as the canonical base and build the
# lambda path relative to it.
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Resolve LAMBDA_BASE_DIR from the script directory (scripts/) -> ../infra/lambda
LAMBDA_BASE_DIR="$(cd "$SCRIPT_DIR/.." &> /dev/null && pwd)/infra/lambda"

# Print the base directory when running normally (but avoid printing when
# invoked for completion helpers like --complete-names or --enable-completion).
if [ "$1" != "--complete-names" ] && [ "$1" != "--enable-completion" ]; then
  echo "Lambda base directory: $LAMBDA_BASE_DIR"
fi

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

# --- Bash completion support ---
# Print available lambda names (one per line). This is used by the
# completion function and can be invoked directly by the completion
# helper (see --complete-names below).
list_lambda_names() {
  # Use same logic as interactive listing: list directories under base
  if [ ! -d "$LAMBDA_BASE_DIR" ]; then
    return 1
  fi

  for dir in "$LAMBDA_BASE_DIR"/*/; do
    [ -d "$dir" ] && basename "$dir"
  done
}

# If the script is called with --complete-names, just print names and exit.
if [ "$1" = "--complete-names" ]; then
  list_lambda_names
  exit 0
fi

# A function to register bash completion for common invocations of this script.
# To enable completion in the current shell session run:
#   source ./scripts/get-lambda-logs.sh --enable-completion
enable_completion() {
  # Define the completion function
  _get_lambda_logs_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # If previous word is --latest, complete with lambda names
    if [[ "$prev" == "--latest" ]]; then
      # ask the script for available names. Use exported variable if available
      local script_call
      script_call="${GET_LAMBDA_LOGS_SCRIPT:-$BASH_SOURCE}"
      mapfile -t opts < <("$script_call" --complete-names 2>/dev/null)
      COMPREPLY=( $(compgen -W "${opts[*]}" -- "$cur") )
      return 0
    fi

    # Otherwise complete options
    opts="--latest --help --enable-completion --complete-names"
    COMPREPLY=( $(compgen -W "$opts" -- "$cur") )
    return 0
  }

  # Register completion for a few likely ways the script is invoked.
  # Use the path of this file as sourced (BASH_SOURCE[0]).
  local script_basename="$(basename "${BASH_SOURCE[0]}")"
  local script_abspath="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)/$script_basename"
  # Export a variable so the completion function can invoke the absolute path
  GET_LAMBDA_LOGS_SCRIPT="$script_abspath"
  export GET_LAMBDA_LOGS_SCRIPT
  # Register for: basename, ./basename, absolute path
  complete -F _get_lambda_logs_completion "$script_basename"
  complete -F _get_lambda_logs_completion "./$script_basename"
  complete -F _get_lambda_logs_completion "$script_abspath"

  echo "Bash completion registered for: $script_basename  ./$(basename "$script_abspath")  $script_abspath"
  echo "Tab-complete after typing '--latest' to see lambda names. To persist, add this file to your shell startup or copy the completion block to your completion dir."
}

# If asked, enable completion and exit (only works when sourced into current shell).
if [ "$1" = "--enable-completion" ]; then
  enable_completion
  # When sourced, return instead of exiting the user's shell
  return 0 2>/dev/null || exit 0
fi

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
