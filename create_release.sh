#!/bin/bash
TOKEN="<REMOVED>"
REPO="Vim-01/vimozz"
TAG="v1.0.0"

# Create release
RELEASE_JSON=$(curl -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $TOKEN" \
  https://api.github.com/repos/$REPO/releases \
  -d '{"tag_name":"'"$TAG"'","name":"Vimozz Release '"$TAG"'","body":"Vimozz initial release.\n\nHighlights:\n- Added seamless YouTube integration\n- Custom VLESS/Xray anti-censorship engine\n- Rebuilt with AGPLv3 License","draft":false,"prerelease":false}')

UPLOAD_URL=$(echo "$RELEASE_JSON" | grep -Po '"upload_url": "\K.*?(?=\{)')

# Upload asset
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @release/Vimozz-1.0.0.AppImage \
  "$UPLOAD_URL?name=Vimozz-1.0.0-x86_64.AppImage"
