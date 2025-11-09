#!/bin/bash

# Script to push changes to git and open GitHub repository

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to increment version in Login.vue
increment_version() {
    local login_file="src/components/Login.vue"
    
    if [ ! -f "$login_file" ]; then
        echo -e "${YELLOW}Warning: $login_file not found. Skipping version increment.${NC}"
        return
    fi
    
    echo -e "${BLUE}Incrementing version in Login.vue...${NC}"
    
    # Extract current version (e.g., 21.62) - look for version-text span
    local current_version=$(grep 'version-text' "$login_file" | sed -n 's/.*v\([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' | head -1)
    
    if [ -z "$current_version" ]; then
        echo -e "${YELLOW}Warning: Could not find version in $login_file. Skipping version increment.${NC}"
        return
    fi
    
    # Split version into major and minor parts
    local major=$(echo "$current_version" | cut -d. -f1)
    local minor=$(echo "$current_version" | cut -d. -f2)
    
    # Increment minor version by 1 (0.01)
    minor=$((minor + 1))
    local new_version="${major}.${minor}"
    
    echo -e "${BLUE}Updating version from v${current_version} to v${new_version}...${NC}"
    
    # Get current date in format "Month Day Year" (e.g., "November 6th 2025")
    # Use format that works on both BSD (macOS) and GNU date
    local day=$(date +"%d" | sed 's/^0//')  # Remove leading zero
    local month=$(date +"%B")
    local year=$(date +"%Y")
    local suffix="th"
    
    # Handle 1st, 2nd, 3rd, 21st, 22nd, 23rd, 31st
    case "$day" in
        1|21|31) suffix="st" ;;
        2|22) suffix="nd" ;;
        3|23) suffix="rd" ;;
    esac
    
    local current_date="${month} ${day}${suffix} ${year}"
    
    # Update version in aria-label
    sed -i.bak "s/View changelog for version ${current_version}/View changelog for version ${new_version}/g" "$login_file"
    
    # Update version text
    sed -i.bak "s/v${current_version}/v${new_version}/g" "$login_file"
    
    # Update changelog title
    sed -i.bak "s/What's New in ${current_version}/What's New in ${new_version}/g" "$login_file"
    
    # Update date
    sed -i.bak "s/<span class=\"version-date\">.*<\/span>/<span class=\"version-date\">${current_date}<\/span>/g" "$login_file"
    
    # Add new changelog entry at the top of changelog-content if it doesn't exist
    # Check if there's already a "Version Update" entry right after changelog-content
    local has_entry=$(grep -A 5 "changelog-content" "$login_file" | grep -q "Version Update" && echo "1" || echo "0")
    
    if [ "$has_entry" -eq 0 ]; then
        # Insert new changelog entry after changelog-content div using awk (more portable)
        local temp_file=$(mktemp)
        awk '
            /<div class="changelog-content">/ {
                print
                print "          <div class=\"changelog-section\">"
                print "            <h3>🔄 Version Update</h3>"
                print "            <p>General improvements and bug fixes.</p>"
                print "          </div>"
                print ""
                next
            }
            { print }
        ' "$login_file" > "$temp_file"
        mv "$temp_file" "$login_file"
    fi
    
    # Clean up backup file
    rm -f "${login_file}.bak"
    
    echo -e "${GREEN}✓ Version updated to v${new_version}${NC}"
}

# Increment version before checking git status
increment_version

echo -e "${BLUE}Checking git status...${NC}"
git status

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo -e "${BLUE}Staging all changes...${NC}"
    git add -A
    
    # Verify bridge-server files are included (if they exist)
    if [ -d "bridge-server" ]; then
        if git ls-files --error-unmatch bridge-server/server.js > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Bridge server files included${NC}"
        else
            echo -e "${YELLOW}Note: Bridge server files may need to be committed separately${NC}"
        fi
    fi
    
    echo -e "${BLUE}Committing changes...${NC}"
    # Use provided commit message or default
    COMMIT_MSG="${1:-Update changes}"
    git commit -m "$COMMIT_MSG"
    
    echo -e "${BLUE}Pushing to remote...${NC}"
    CURRENT_BRANCH=$(git branch --show-current)
    
    # Push current branch first
    if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} > /dev/null 2>&1; then
        echo -e "${BLUE}Setting upstream branch for $CURRENT_BRANCH...${NC}"
        git push --set-upstream origin "$CURRENT_BRANCH"
    else
        echo -e "${BLUE}Pushing $CURRENT_BRANCH...${NC}"
        git push
    fi
    
    # Also push to main
    if [ "$CURRENT_BRANCH" != "main" ]; then
        echo -e "${BLUE}Switching to main branch...${NC}"
        git checkout main
        
        echo -e "${BLUE}Merging $CURRENT_BRANCH into main...${NC}"
        git merge "$CURRENT_BRANCH" --no-edit
        
        echo -e "${BLUE}Pushing main to remote...${NC}"
        git push origin main
        
        echo -e "${BLUE}Switching back to $CURRENT_BRANCH...${NC}"
        git checkout "$CURRENT_BRANCH"
    else
        echo -e "${BLUE}Already on main branch, pushing...${NC}"
        git push origin main
    fi
    
    echo -e "${GREEN}✓ Changes pushed successfully to both $CURRENT_BRANCH and main!${NC}"
else
    echo -e "${GREEN}No changes to commit.${NC}"
fi

# Open GitHub repository
GITHUB_URL="https://github.com/soundrolling/proapp2149"
echo -e "${BLUE}Opening GitHub repository...${NC}"

# Try to open with different commands depending on OS
if command -v open > /dev/null; then
    # macOS
    open "$GITHUB_URL"
elif command -v xdg-open > /dev/null; then
    # Linux
    xdg-open "$GITHUB_URL"
elif command -v start > /dev/null; then
    # Windows
    start "$GITHUB_URL"
else
    echo -e "${BLUE}Could not open browser automatically. Please visit: ${GITHUB_URL}${NC}"
fi

echo -e "${GREEN}Done!${NC}"

