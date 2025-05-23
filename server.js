// server.js - Complete backend with continuous‐scroll PDF output and rmapi integration

const express = require('express');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // Serve your frontend files

// Configure marked - simple setup since we'll highlight after
marked.setOptions({
  gfm: true,
  breaks: true,
  langPrefix: 'language-' // This ensures code blocks get language-* classes
});

// Check if rmapi is available and authenticated
function checkRmapi() {
  try {
    execSync('rmapi version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// Initialize rmapi authentication if needed
async function initRmapi() {
  try {
    // Try to list files to check if authenticated
    execSync('rmapi ls', { stdio: 'pipe' });
    console.log('✅ rmapi is authenticated and ready');
    return true;
  } catch (error) {
    console.log('❌ rmapi not authenticated. Please run: rmapi');
    return false;
  }
}

// Generate HTML template for PDF conversion
function generateRemarkableHTML(markdownContent, title = 'LLM Output') {
  // First convert markdown to HTML
  let htmlContent = marked.parse(markdownContent);
  
  // Debug: log the HTML before highlighting
  console.log('📝 HTML before highlighting (first 500 chars):', htmlContent.substring(0, 500));
  
  // Count code blocks found
  const codeBlockMatches = htmlContent.match(/<pre><code class="(?:hljs )?language-(\w+)">/g);
  console.log(`📊 Found ${codeBlockMatches ? codeBlockMatches.length : 0} code blocks to highlight`);
  
  // Then apply syntax highlighting to code blocks
  // This regex finds all code blocks with language classes (with or without hljs prefix)
  htmlContent = htmlContent.replace(
    /<pre><code class="(?:hljs )?language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
    (match, language, code) => {
      console.log(`🎨 Highlighting ${language} code block`);
      
      // Decode HTML entities
      const decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
      
      try {
        const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
        const highlighted = hljs.highlight(decodedCode, { language: validLanguage }).value;
        console.log(`✅ Successfully highlighted ${language}, output preview:`, highlighted.substring(0, 100));
        return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
      } catch (err) {
        console.error('❌ Highlighting error:', err);
        return match; // Return original if highlighting fails
      }
    }
  );
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    /* Base styles */
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      font-family: Georgia, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 20px;
    }

    /* Typography */
    h1 { 
      font-size: 16pt; 
      margin: 20px 0 12px 0; 
      border-bottom: 2px solid #333; 
      padding-bottom: 5px;
    }
    h2 { font-size: 14pt; margin: 16px 0 10px 0; }
    h3 { font-size: 12pt; margin: 14px 0 8px 0; }
    h4 { font-size: 11pt; margin: 12px 0 6px 0; }
    p { margin: 8px 0; }
    
    /* Code blocks */
    pre { 
      background: transparent;
      border: 2px solid #000; 
      padding: 12px; 
      margin: 12px 0; 
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 9pt;
      line-height: 1.4;
      overflow-wrap: break-word;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    
    /* Inline code */
    code { 
      background: transparent;
      padding: 3px 6px; 
      border: 1px solid #333;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 9pt;
    }
    
    /* Code inside pre blocks */
    pre code { 
      background: none; 
      padding: 0; 
      border: none;
      display: block;
      overflow-x: auto;
    }
    
    /* Blockquotes */
    blockquote { 
      border-left: 4px solid #000; 
      margin: 12px 0; 
      padding-left: 12px; 
      font-style: italic; 
      color: #333;
    }
    
    /* Lists */
    ul, ol { margin: 10px 0; padding-left: 25px; }
    li { margin: 4px 0; }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
    }
    th, td {
      border: 1px solid #333;
      padding: 8px;
      text-align: left;
    }
    th { background-color: #f2f2f2; font-weight: bold; }

    /* Syntax highlighting - MUST come after base styles */
    /* Force all hljs elements to use our color scheme */
    .hljs {
      display: block;
      overflow-x: auto;
      padding: 0;
      background: transparent !important;
      color: #000 !important;
    }
    
    /* Keywords, tags, titles */
    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-title,
    .hljs-section,
    .hljs-doctag,
    .hljs-name,
    .hljs-strong {
      color: #0033cc !important;
      font-weight: bold !important;
    }
    
    /* Strings, attributes, quotes */
    .hljs-string,
    .hljs-title.class_,
    .hljs-variable.language_,
    .hljs-template-variable,
    .hljs-attr,
    .hljs-quote,
    .hljs-link,
    .hljs-symbol {
      color: #008800 !important;
    }
    
    /* Comments and meta */
    .hljs-comment,
    .hljs-meta {
      color: #666666 !important;
      font-style: italic !important;
    }
    
    /* Numbers, literals, built-ins */
    .hljs-number,
    .hljs-literal,
    .hljs-built_in,
    .hljs-regexp {
      color: #cc5200 !important;
    }
    
    /* Function names, IDs, classes */
    .hljs-title.function_,
    .hljs-selector-id,
    .hljs-selector-class {
      color: #6600cc !important;
      font-weight: bold !important;
    }
    
    /* Variables, parameters */
    .hljs-variable,
    .hljs-params,
    .hljs-template-tag {
      color: #006666 !important;
    }
    
    /* Types, classes, builtins */
    .hljs-type,
    .hljs-class,
    .hljs-builtin-name {
      color: #990099 !important;
      font-weight: bold !important;
    }
    
    /* Other elements */
    .hljs-bullet,
    .hljs-code,
    .hljs-emphasis {
      color: #cc5200 !important;
    }
    
    .hljs-deletion {
      color: #990000 !important;
      text-decoration: line-through !important;
    }
    
    .hljs-addition {
      color: #006600 !important;
    }
    
    /* Ensure colors are printed */
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

// Convert markdown to PDF and upload to reMarkable
async function convertAndUpload(markdown, filename = 'llm-output', folder = '/LLM-Outputs') {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const safeFilename = `${filename}-${timestamp}`;
  const pdfPath = path.join(__dirname, 'temp', `${safeFilename}.pdf`);
  
  // Ensure temp directory exists
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let browser;
  try {
    console.log('🚀 Starting PDF conversion...');
    
    // Launch browser with specific args for better color rendering
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--force-color-profile=srgb',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 794, // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      deviceScaleFactor: 2 // Higher quality rendering
    });
    
    // Generate HTML content
    const htmlContent = generateRemarkableHTML(markdown, filename);
    
    // Save debug HTML if needed
    const debugPath = path.join(tempDir, 'debug_output.html');
    fs.writeFileSync(debugPath, htmlContent);
    console.log(`📝 Debug HTML saved to: ${debugPath}`);
    
    // Set content and wait for any async operations
    await page.setContent(htmlContent, { 
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'] 
    });
    
    // Force CSS to be applied and ensure colors are preserved
    await page.addStyleTag({
      content: `
        /* Force color preservation for printing */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Re-apply syntax highlighting colors with maximum specificity */
        pre code.hljs .hljs-keyword { color: #0033cc !important; }
        pre code.hljs .hljs-string { color: #008800 !important; }
        pre code.hljs .hljs-comment { color: #666666 !important; }
        pre code.hljs .hljs-number { color: #cc5200 !important; }
        pre code.hljs .hljs-title.function_ { color: #6600cc !important; }
        pre code.hljs .hljs-variable { color: #006666 !important; }
        pre code.hljs .hljs-type { color: #990099 !important; }
      `
    });
    
    // Wait for styles to fully apply
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    
    // Measure the full height of the rendered content
    const bodyHandle = await page.$('body');
    const { height: bodyHeightPx } = await bodyHandle.boundingBox();
    await bodyHandle.dispose();

    // Set media type for print
    await page.emulateMediaType('print');

    // Generate one long PDF at A4 width and full content height
    await page.pdf({
      path: pdfPath,
      width: '210mm',                            // A4 width
      height: `${Math.ceil(bodyHeightPx)}px`,    // full content height
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '15mm',
        right: '15mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    });
    
    console.log('📄 PDF generated successfully');

    // Close browser
    await browser.close();
    browser = null;
    
    // Create folder in reMarkable if it doesn't exist
    console.log('📁 Creating reMarkable folder...');
    try {
      execSync(`rmapi mkdir "${folder}"`, { stdio: 'pipe' });
    } catch (error) {
      // Folder might already exist, which is fine
    }
    
    // Upload to reMarkable
    console.log('📤 Uploading to reMarkable...');
    execSync(`rmapi put "${pdfPath}" "${folder}/"`, { stdio: 'pipe' });
    
    console.log('✅ Successfully uploaded to reMarkable!');
    
    // Clean up local file
    fs.unlinkSync(pdfPath);
    
    return {
      success: true,
      message: `Successfully uploaded "${safeFilename}.pdf" to reMarkable folder "${folder}"`,
      filename: `${safeFilename}.pdf`,
      folder: folder
    };
    
  } catch (error) {
    console.error('❌ Error in convertAndUpload:', error);
    
    // Clean up browser if still running
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    
    // Clean up file if it exists
    if (fs.existsSync(pdfPath)) {
      try { fs.unlinkSync(pdfPath); } catch (e) {}
    }
    
    throw error;
  }
}

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  const rmApiStatus = checkRmapi();
  res.json({
    status: 'ok',
    rmapi: rmApiStatus ? 'available' : 'not available',
    timestamp: new Date().toISOString()
  });
});

// Convert markdown and upload to reMarkable
app.post('/api/convert-and-upload', async (req, res) => {
  try {
    const { markdown, filename, folder } = req.body;
    
    if (!markdown || !markdown.trim()) {
      return res.status(400).json({ success: false, error: 'Markdown content is required' });
    }
    
    if (!checkRmapi()) {
      return res.status(500).json({
        success: false,
        error: 'rmapi is not available. Please install and authenticate rmapi first.',
        instructions: 'Run: rmapi (then follow authentication prompts)'
      });
    }
    
    const result = await convertAndUpload(
      markdown, 
      filename || 'llm-output',
      folder || '/LLM-Outputs'
    );
    
    res.json(result);
    
  } catch (error) {
    console.error('Conversion error:', error);
    let errorMessage = 'Failed to convert and upload';
    if (error.message.includes('rmapi')) {
      errorMessage = 'rmapi error: ' + error.message;
    } else if (error.message.includes('puppeteer')) {
      errorMessage = 'PDF generation error: ' + error.message;
    }
    res.status(500).json({ success: false, error: errorMessage, details: error.message });
  }
});

// Generate PDF only (no upload)
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { markdown, filename } = req.body;
    
    if (!markdown || !markdown.trim()) {
      return res.status(400).json({ success: false, error: 'Markdown content is required' });
    }
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const safeFilename = `${filename || 'llm-output'}-${timestamp}`;
    const pdfPath = path.join(__dirname, 'temp', `${safeFilename}.pdf`);
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--force-color-profile=srgb',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 2
    });
    
    const htmlContent = generateRemarkableHTML(markdown, filename);
    
    // Save debug HTML
    const debugPath = path.join(tempDir, 'debug_output.html');
    fs.writeFileSync(debugPath, htmlContent);
    
    await page.setContent(htmlContent, { 
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'] 
    });
    
    // Force CSS application with explicit color rules
    await page.addStyleTag({
      content: `
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Re-apply colors with high specificity */
        pre code.hljs .hljs-keyword { color: #0033cc !important; }
        pre code.hljs .hljs-string { color: #008800 !important; }
        pre code.hljs .hljs-comment { color: #666666 !important; }
        pre code.hljs .hljs-number { color: #cc5200 !important; }
        pre code.hljs .hljs-title.function_ { color: #6600cc !important; }
        pre code.hljs .hljs-variable { color: #006666 !important; }
        pre code.hljs .hljs-type { color: #990099 !important; }
      `
    });
    
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));
    
    // Measure full document height
    const bodyHandle = await page.$('body');
    const { height: fullHeight } = await bodyHandle.boundingBox();
    await bodyHandle.dispose();
    
    // Set media type
    await page.emulateMediaType('print');
    
    // Generate single-sheet PDF
    await page.pdf({
      path: pdfPath,
      width: '210mm',
      height: `${Math.ceil(fullHeight)}px`,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '15mm',
        right: '15mm'
      },
      printBackground: true,
      preferCSSPageSize: false
    });
    
    await browser.close();
    
    // Send file for download
    res.download(pdfPath, `${safeFilename}.pdf`, (err) => {
      if (err) console.error('Download error:', err);
      try { fs.unlinkSync(pdfPath); } catch (e) {}
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF', details: error.message });
  }
});

// Get reMarkable folders (for folder selection)
app.get('/api/remarkable-folders', (req, res) => {
  try {
    if (!checkRmapi()) {
      return res.status(500).json({ success: false, error: 'rmapi not available' });
    }
    const output = execSync('rmapi ls -r', { encoding: 'utf8' });
    const lines = output.split('\n').filter(line => line.trim());
    const folders = lines
      .filter(line => line.includes('[d]'))
      .map(line => {
        const match = line.match(/\s+(.+?)(?:\s+\[d\])/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);
    
    res.json({ success: true, folders: ['/', '/LLM-Outputs', ...folders] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get folders', details: error.message });
  }
});

// Initialize server
async function startServer() {
  const rmApiReady = await initRmapi();
  if (!rmApiReady) {
    console.log('\n⚠️  WARNING: rmapi is not authenticated!');
    console.log('   Run this command to authenticate: rmapi');
    console.log('   Then restart this server\n');
  }
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔧 rmapi status: ${rmApiReady ? '✅ Ready' : '❌ Not authenticated'}`);
  });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = app;