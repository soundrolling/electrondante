#!/bin/bash
# GitHub Release Creation Script (using API)
# Usage: GITHUB_TOKEN=your_token ./create-release-api.sh v1.1.0

set -e

VERSION=${1:-v1.1.0}
REPO="soundrolling/electrondante"
TOKEN=${GITHUB_TOKEN:-}

if [ -z "$TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not set!"
    echo ""
    echo "📝 Create a token at: https://github.com/settings/tokens"
    echo "   Required scopes: repo (Full control of private repositories)"
    echo ""
    echo "🔐 Usage: GITHUB_TOKEN=your_token ./create-release-api.sh $VERSION"
    exit 1
fi

echo "🚀 Creating GitHub release for $VERSION..."

# Release notes
NOTES="## 🎉 Multi-Room Audio System Release

### Major Features
- ✅ Multi-room support (create/join rooms)
- ✅ Broadcast/Listen mode toggle
- ✅ Opus audio encoding/decoding
- ✅ Adaptive jitter buffering
- ✅ Real-time audio visualizer
- ✅ Connection quality indicators
- ✅ Supabase database persistence
- ✅ Toast notifications & UI polish
- ✅ Precise audio scheduling for smooth playback
- ✅ Clock drift correction

### Improvements
- Enhanced buffering reliability
- Better network quality monitoring
- Improved user experience
- Default to Listen mode for ease of use

### Technical
- Advanced jitter buffer with adaptive sizing
- Opus codec support for bandwidth efficiency
- Database persistence for room management
- Connection quality metrics (latency, jitter, packet loss)

### Documentation
- Complete user guide
- Testing scenarios
- Deployment checklist
- Database setup instructions

See full release notes in \`RELEASE_NOTES_v1.1.0.md\`"

# Escape quotes in JSON
NOTES_JSON=$(echo "$NOTES" | jq -Rs .)

# Create release via API
RESPONSE=$(curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/$REPO/releases \
  -d "{
    \"tag_name\": \"$VERSION\",
    \"name\": \"Dante Audio Client $VERSION\",
    \"body\": $NOTES_JSON,
    \"draft\": false,
    \"prerelease\": false
  }")

# Check if successful
if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    RELEASE_URL=$(echo "$RESPONSE" | jq -r '.html_url')
    echo "✅ Release $VERSION created successfully!"
    echo "🔗 View at: $RELEASE_URL"
    echo ""
    echo "⏳ GitHub Actions will now build the binaries..."
    echo "📦 Check status: https://github.com/$REPO/actions"
else
    echo "❌ Failed to create release!"
    echo "$RESPONSE" | jq .
    exit 1
fi

