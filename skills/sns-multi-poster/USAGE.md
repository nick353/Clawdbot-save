# Facebook & Pinterest Posting Scripts - Usage Guide

## Quick Start

### Facebook Posting
```bash
# DRY RUN (test without posting)
DRY_RUN=true node post-to-facebook.cjs /path/to/image.png "Your caption here"

# Real posting
node post-to-facebook.cjs /path/to/image.png "Your caption here"
```

### Pinterest Posting
```bash
# DRY RUN (test without posting)
DRY_RUN=true node post-to-pinterest.cjs /path/to/image.png "Your caption here" "Animal"

# Real posting
node post-to-pinterest.cjs /path/to/image.png "Your caption here" "BoardName"
```

---

## File Structure

```
/root/clawd/skills/sns-multi-poster/
├── post-to-facebook.cjs     # Facebook posting script
├── post-to-pinterest.cjs    # Pinterest posting script
├── post-to-x.cjs            # X (Twitter) posting script (reference)
├── cookies/
│   ├── facebook.json        # Facebook cookies (create this)
│   └── pinterest.json       # Pinterest cookies (create this)
├── TEST_REPORT.md           # Test results and analysis
└── USAGE.md                 # This file
```

---

## Cookie Setup

### 1. Export Cookies from Browser

Use a browser extension like "Cookie-Editor" or "EditThisCookie":
1. Log in to Facebook/Pinterest in your browser
2. Open the cookie export extension
3. Export cookies as JSON
4. Save to the appropriate file

### 2. Cookie File Format

Save cookies in this format:
```json
[
  {
    "name": "cookie_name",
    "value": "cookie_value",
    "domain": ".facebook.com",
    "path": "/",
    "httpOnly": true,
    "secure": true
  }
]
```

### 3. Required Cookie Files

- **Facebook:** `/root/clawd/skills/sns-multi-poster/cookies/facebook.json`
- **Pinterest:** `/root/clawd/skills/sns-multi-poster/cookies/pinterest.json`

---

## Command Line Arguments

### Facebook
```bash
node post-to-facebook.cjs <image_path> <caption>
```

**Parameters:**
- `image_path`: Path to image file (required)
- `caption`: Text caption for the post (required)

**Environment Variables:**
- `DRY_RUN=true`: Test mode (don't actually post)

### Pinterest
```bash
node post-to-pinterest.cjs <image_path> <caption> [board_name]
```

**Parameters:**
- `image_path`: Path to image file (required)
- `caption`: Text caption (first line becomes title) (required)
- `board_name`: Pinterest board name (optional, default: "Animal")

**Environment Variables:**
- `DRY_RUN=true`: Test mode (don't actually publish)

---

## Caption Handling

### Facebook
- Full caption is used as-is
- Supports emojis and hashtags
- Line breaks are preserved

### Pinterest
- **Title:** First line of caption (automatically extracted)
- **Description:** Full caption (all lines)
- Supports emojis and hashtags

**Example:**
```bash
node post-to-pinterest.cjs image.png "Beautiful Sunset 🌅
This amazing photo was taken at the beach.
Perfect moment captured!

#photography #nature #sunset" "Photography"
```

Result:
- **Title:** "Beautiful Sunset 🌅"
- **Description:** Full caption (all 4 lines)
- **Board:** "Photography"

---

## Screenshots

Scripts automatically save screenshots for debugging:

### Success (normal posting)
- `/tmp/facebook-before-post.png` - Before clicking Post
- `/tmp/facebook-after-post.png` - After posting
- `/tmp/pinterest-before-post.png` - Before clicking Publish
- `/tmp/pinterest-after-post.png` - After publishing

### Errors
- `/tmp/facebook-error.png` - Any error state
- `/tmp/facebook-login-error.png` - Login failed
- `/tmp/facebook-no-button.png` - Button not found
- `/tmp/pinterest-error.png` - Any error state
- `/tmp/pinterest-login-error.png` - Login failed
- `/tmp/pinterest-no-file-input.png` - File input not found

---

## Testing Workflow

### 1. First Test (DRY_RUN)
```bash
# Create test image
python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (800, 600), 'lightblue')
draw = ImageDraw.Draw(img)
draw.text((300, 280), 'Test Post', fill='black')
img.save('/tmp/test.png')
"

# Test Facebook (won't actually post)
DRY_RUN=true node post-to-facebook.cjs /tmp/test.png "Test caption 📝"

# Test Pinterest (won't actually publish)
DRY_RUN=true node post-to-pinterest.cjs /tmp/test.png "Test Title
Test description" "Animal"
```

### 2. Check Screenshots
```bash
ls -lh /tmp/*facebook* /tmp/*pinterest*
```

### 3. Real Posting
Once tests pass, remove `DRY_RUN=true` to post for real.

---

## Troubleshooting

### "Cookie設定完了" but "ログインしていません"
- Cookies expired or invalid
- Re-export fresh cookies from browser
- Make sure you're logged in when exporting

### "ファイル入力が見つかりません"
- Page structure changed
- Check screenshots to identify correct selector
- Update selectors in script

### "投稿作成ボタンが見つかりません"
- Facebook UI changed
- Script tries multiple selectors automatically
- Check `/tmp/facebook-no-button.png` to identify new selector

### Selectors Fail After Pinterest Update
- Pinterest frequently updates their UI
- Check `/tmp/pinterest-*.png` screenshots
- Update selectors in `post-to-pinterest.cjs`

---

## Integration with Multi-Poster

These scripts can be integrated into the main multi-poster workflow:

```bash
# Post to all platforms including Facebook & Pinterest
cd /root/clawd/skills/sns-multi-poster
./post-to-all.sh /path/to/image.png "Caption here" "Pinterest Board Name"
```

---

## Security Notes

- **Never commit cookie files to git**
- Cookies are stored in plain JSON (sensitive data)
- Add `cookies/*.json` to `.gitignore`
- Regenerate cookies if they're compromised
- Consider using environment variables for sensitive data

---

## Dependencies

Both scripts require:
- Node.js 18+
- Puppeteer (installed via npm)

```bash
# Install if needed
cd /root/clawd/skills/sns-multi-poster
npm install puppeteer
```

---

## Support

For issues or questions:
1. Check TEST_REPORT.md for test results
2. Review screenshots in `/tmp/`
3. Enable verbose Puppeteer logging if needed
4. Update selectors based on current UI
