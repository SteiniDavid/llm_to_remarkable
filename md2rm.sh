#!/bin/bash

# NOTE NOT CURRENTLY WORKING FOR NOW

# markdown-to-remarkable.sh - Modern version with multiple PDF engines
# Usage: ./md2rm.sh input.md [output-name]

INPUT_FILE="$1"
OUTPUT_NAME="${2:-$(basename "$INPUT_FILE" .md)}"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Usage: $0 input.md [output-name]"
    echo "Supported PDF engines: Chrome, WeasyPrint, Pandoc"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Convert markdown to HTML with pandoc (always available)
echo "📝 Converting markdown to HTML..."
pandoc "$INPUT_FILE" \
    --from markdown \
    --to html5 \
    --highlight-style github \
    --css remarkable.css \
    --standalone \
    --output "${OUTPUT_NAME}.html" \
    --metadata title="LLM Output"

# Create CSS optimized for reMarkable
cat > remarkable.css << 'EOF'
body {
    font-family: Georgia, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    max-width: none;
    margin: 0;
    padding: 15mm;
}
h1 { font-size: 16pt; border-bottom: 1px solid #333; padding-bottom: 3px; }
h2 { font-size: 14pt; margin: 15px 0 8px 0; }
h3 { font-size: 12pt; margin: 12px 0 6px 0; }
pre {
    background: #f8f9fa;
    border: 1px solid #333;
    padding: 12px;
    border-radius: 4px;
    font-size: 9pt;
    font-family: 'Monaco', 'Courier New', monospace;
    overflow-wrap: break-word;
    white-space: pre-wrap;
}
code {
    background: #f1f3f4;
    padding: 2px 4px;
    border-radius: 2px;
    font-size: 9pt;
    font-family: 'Monaco', 'Courier New', monospace;
}
pre code { background: none; padding: 0; }
blockquote {
    border-left: 4px solid #333;
    margin: 12px 0;
    padding-left: 12px;
    font-style: italic;
}
EOF

# Try different PDF conversion methods in order of preference
echo "🔄 Converting HTML to PDF..."

if command_exists google-chrome || command_exists chromium-browser || command_exists "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; then
    echo "Using Chrome/Chromium (best quality)..."
    
    # Determine Chrome command
    if command_exists google-chrome; then
        CHROME_CMD="google-chrome"
    elif command_exists chromium-browser; then
        CHROME_CMD="chromium-browser"
    elif [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
        CHROME_CMD="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    fi
    
    "$CHROME_CMD" \
        --headless \
        --disable-gpu \
        --no-sandbox \
        --print-to-pdf="${OUTPUT_NAME}.pdf" \
        --print-to-pdf-no-header \
        "file://$(pwd)/${OUTPUT_NAME}.html"
        
elif command_exists weasyprint; then
    echo "Using WeasyPrint..."
    weasyprint "${OUTPUT_NAME}.html" "${OUTPUT_NAME}.pdf"
    
elif command_exists pandoc; then
    echo "Using Pandoc (fallback)..."
    pandoc "${OUTPUT_NAME}.html" -o "${OUTPUT_NAME}.pdf" \
        --pdf-engine=xelatex \
        --variable geometry:margin=15mm
        
else
    echo "❌ No PDF conversion tool found!"
    echo "Please install one of: Chrome/Chromium, WeasyPrint, or LaTeX (for Pandoc)"
    echo "macOS: brew install --cask google-chrome"
    echo "       pip install weasyprint"
    echo "Linux: apt install chromium-browser weasyprint"
    exit 1
fi

# Upload to reMarkable
if command -v rmapi &> /dev/null; then
    echo "📤 Uploading to reMarkable..."
    rmapi mkdir /LLM-Outputs/ 2>/dev/null || true  # Create folder if it doesn't exist
    rmapi put "${OUTPUT_NAME}.pdf" /LLM-Outputs/
    echo "✅ Upload complete! Check your reMarkable."
else
    echo "❌ rmapi not found. PDF saved as ${OUTPUT_NAME}.pdf"
    echo "Install rmapi: https://github.com/juruen/rmapi/releases"
fi

# Cleanup
rm -f "${OUTPUT_NAME}.html" remarkable.css
echo "🎉 Done!"
