#!/bin/bash

# Script to push changes to git and open GitHub repository

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Checking git status...${NC}"
git status

# Check if there are changes to commit
if [[ -n $(git status -s) ]]; then
    echo -e "${BLUE}Staging all changes...${NC}"
    git add -A
    
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

