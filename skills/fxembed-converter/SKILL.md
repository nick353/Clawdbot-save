---
name: fxembed-converter
description: Convert Twitter/X (twitter.com, x.com) URLs to fxtwitter.com for improved Discord embeds. Supports multiple links in a single text. Use when the user provides Twitter/X links and wants them displayed clearly in Discord.
---

# FxEmbed Converter

Convert Twitter/X links to FxTwitter format for beautiful Discord embeds.

## Quick Start

When you receive Twitter/X links in any format, use this skill to convert them:

```bash
bash /root/clawd/skills/fxembed-converter/scripts/convert-twitter-links.sh "text with https://x.com/user/status/123 link"
```

Output:
```
text with https://fxtwitter.com/user/status/123 link
```

## What It Does

- Converts `x.com` → `fxtwitter.com`
- Converts `twitter.com` → `fxtwitter.com`
- Handles multiple links in a single text
- Preserves all other text and formatting
- Both HTTP and HTTPS protocols supported

## Why FxEmbed?

Discord doesn't natively embed Twitter/X content well. FxEmbed (fxtwitter.com) fixes this:

- ✅ Shows images, videos, and GIFs
- ✅ Displays thread content properly
- ✅ Works with polls and engagement
- ✅ No additional setup or bot installation needed

## Usage Examples

### Single Link
**Input:** `https://x.com/username/status/1234567890`
**Output:** `https://fxtwitter.com/username/status/1234567890`

### Multiple Links
**Input:** 
```
Check out https://x.com/user1/status/111 and https://twitter.com/user2/status/222
```
**Output:**
```
Check out https://fxtwitter.com/user1/status/111 and https://fxtwitter.com/user2/status/222
```

## Bundled Resources

- `scripts/convert-twitter-links.sh` - Core conversion script

## Implementation

Execute the script with any text containing Twitter/X links:

```bash
bash /root/clawd/skills/fxembed-converter/scripts/convert-twitter-links.sh "your text here"
```

The script will output the converted text with all twitter.com and x.com URLs replaced with fxtwitter.com equivalents.
