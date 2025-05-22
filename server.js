// server.js - Complete backend with rmapi integration
const express = require('express');
const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
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

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function(code, language) {
    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language }).value;
      } catch (err) {}
    }
    return hljs.highlightAuto(code).value;
  },
  langPrefix: 'hljs language-'
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
  const htmlContent = marked(markdownContent);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { 
            font-family: Georgia, serif; 
            font-size: 11pt; 
            line-height: 1.6; 
            color: #000; 
            background: white;
            margin: 0;
            padding: 20px;
            max-width: none;
        }
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
        pre { 
            background: #f8f9fa; 
            border: 2px solid #333; 
            padding: 12px; 
            margin: 12px 0; 
            border-radius: 4px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 9pt;
            line-height: 1.4;
            overflow-wrap: break-word;
            white-space: pre-wrap;
        }
        code { 
            background: #f1f3f4; 
            padding: 3px 6px; 
            border-radius: 3px;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 9pt;
        }
        pre code { background: none; padding: 0; }
        blockquote { 
            border-left: 4px solid #333; 
            margin: 12px 0; 
            padding-left: 12px; 
            font-style: italic; 
        }
        ul, ol { margin: 10px 0; padding-left: 25px; }
        li { margin: 4px 0; }
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
        
        /* Syntax highlighting optimized for e-ink */
        .hljs { background: #f8f9fa !important; }
        .hljs-keyword { color: #000080; font-weight: bold; }
        .hljs-string { color: #006400; }
        .hljs-comment { color: #707070; font-style: italic; }
        .hljs-number { color: #B8860B; }
        .hljs-function { color: #4B0082; }
        .hljs-variable { color: #2F4F4F; }
        .hljs-type { color: #800080; }
        .hljs-title { color: #8B0000; font-weight: bold; }
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
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Generate HTML content
    const htmlContent = generateRemarkableHTML(markdown, filename);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      },
      printBackground: true
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
    const uploadCommand = `rmapi put "${pdfPath}" "${folder}/"`;
    execSync(uploadCommand, { stdio: 'pipe' });
    
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
      try {
        fs.unlinkSync(pdfPath);
      } catch (e) {}
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
      return res.status(400).json({
        success: false,
        error: 'Markdown content is required'
      });
    }
    
    // Check if rmapi is available
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
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

// Generate PDF only (no upload)
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { markdown, filename } = req.body;
    
    if (!markdown || !markdown.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Markdown content is required'
      });
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
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    const htmlContent = generateRemarkableHTML(markdown, filename);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm'
      },
      printBackground: true
    });
    
    await browser.close();
    
    // Send file for download
    res.download(pdfPath, `${safeFilename}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      // Clean up file after download
      try {
        fs.unlinkSync(pdfPath);
      } catch (e) {}
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
      details: error.message
    });
  }
});

// Get reMarkable folders (for folder selection)
app.get('/api/remarkable-folders', (req, res) => {
  try {
    if (!checkRmapi()) {
      return res.status(500).json({
        success: false,
        error: 'rmapi not available'
      });
    }
    
    // Get folder structure from rmapi
    const output = execSync('rmapi ls -r', { encoding: 'utf8' });
    const lines = output.split('\n').filter(line => line.trim());
    const folders = lines
      .filter(line => line.includes('[d]'))
      .map(line => {
        const match = line.match(/\s+(.+?)(?:\s+\[d\])/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);
    
    res.json({
      success: true,
      folders: ['/', '/LLM-Outputs', ...folders]
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get folders',
      details: error.message
    });
  }
});

// Initialize server
async function startServer() {
  // Check rmapi on startup
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
