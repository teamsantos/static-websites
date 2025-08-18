echo "Checking for newly added projects..."
echo "Current commit: ${{ github.sha }}"

# Get newly added directories under projects/ in the current commit
CHANGED=$(git diff --name-status "${{ github.event.before }}" "${{ github.sha }}" 2>/dev/null \
    | grep '^A' \
    | awk '{print $2}' \
    | grep '^projects/' \
    | cut -d/ -f2 \
    | sort -u || echo "")

# Fallback if no changes detected
if [ -z "$CHANGED" ]; then
    echo "No new projects detected"
fi

# Convert to space-separated string for output
CHANGED_STR=$(echo "$CHANGED" | tr '\n' ' ' | sed 's/[[:space:]]*$//')
echo "Newly added projects: $CHANGED_STR"
echo "projects=$CHANGED_STR" >> $GITHUB_OUTPUT
