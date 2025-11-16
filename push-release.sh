#!/bin/bash
# Script to push releases to GitHub

cd "$(dirname "$0")"

# Token should be provided via environment variable or argument
# For security, do not hardcode tokens in this file
DEFAULT_TOKEN=""

echo "🚀 Pushing release to GitHub..."
echo ""

# Determine which token to use (priority: argument > environment)
if [ -n "$1" ]; then
    TOKEN="$1"
    echo "✅ Using provided token"
elif [ -n "$GITHUB_TOKEN" ]; then
    TOKEN="$GITHUB_TOKEN"
    echo "✅ Using GITHUB_TOKEN from environment"
elif [ -n "$DEFAULT_TOKEN" ]; then
    TOKEN="$DEFAULT_TOKEN"
    echo "✅ Using default token"
else
    echo "❌ Error: No GitHub token provided"
    echo "   Please provide a token via:"
    echo "   - Command line: ./push-release.sh YOUR_TOKEN"
    echo "   - Environment: GITHUB_TOKEN=YOUR_TOKEN ./push-release.sh"
    exit 1
fi

# Get current version from package.json
if command -v node >/dev/null 2>&1; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
else
    # Fallback: extract version from package.json using grep/sed
    VERSION=$(grep -o '"version": *"[^"]*"' package.json | sed 's/"version": *"\(.*\)"/\1/' || echo "unknown")
fi
TAG="v${VERSION}"

echo "📦 Version: $VERSION"
echo "🏷️  Tag: $TAG"
echo ""

# Push main branch
echo "📤 Pushing main branch..."
if git push https://${TOKEN}@github.com/soundrolling/electrondante.git main 2>&1; then
    echo "✅ Main branch pushed successfully"
else
    echo "⚠️  Main branch push failed (may be behind remote - this is okay if tag pushes)"
fi

echo ""

# Push tag
echo "📤 Pushing tag $TAG..."
if git push https://${TOKEN}@github.com/soundrolling/electrondante.git $TAG 2>&1; then
    echo "✅ Tag $TAG pushed successfully"
else
    echo "❌ Tag push failed"
    exit 1
fi

echo ""
echo "✅ Push complete! Check GitHub Actions: https://github.com/soundrolling/electrondante/actions"
echo "📦 Release will be available at: https://github.com/soundrolling/electrondante/releases"

