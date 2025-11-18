#!/bin/bash
# GitHub Release Creation Script
# Usage: ./create-release.sh v1.1.0

set -e

VERSION=${1:-v1.1.0}
REPO="soundrolling/electrondante"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found!"
    echo "📥 Install it: brew install gh"
    echo "🔐 Then authenticate: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub!"
    echo "🔐 Run: gh auth login"
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

# Create the release
gh release create "$VERSION" \
    --repo "$REPO" \
    --title "Dante Audio Client $VERSION" \
    --notes "$NOTES" \
    --latest

echo "✅ Release $VERSION created successfully!"
echo "🔗 View at: https://github.com/$REPO/releases/tag/$VERSION"
echo ""
echo "⏳ GitHub Actions will now build the binaries..."
echo "📦 Check status: https://github.com/$REPO/actions"

