// ==========================================
// Global Variables
// ==========================================

let serverOnline = false;
let currentZoom = 1;
let debounceTimer = null;

// Cache for external content
let sampleContent = null;
let htmlTemplate = null;

// ==========================================
// Initialization
// ==========================================

window.addEventListener('load', () => {
    // Hide loading screen
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        loadingScreen.classList.add('hidden');
    }, 800);

    // Initialize marked with syntax highlighting
    if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
        marked.setOptions({
            highlight: function(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-',
            breaks: true,
            gfm: true
        });
        console.log('Markdown parser initialized with syntax highlighting');
    } else {
        console.error('Required libraries not loaded');
        showToast('Error: Required libraries not loaded', 'error');
    }

    // Initialize theme
    initTheme();
    
    // Check server status
    checkServerStatus();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update character count
    updateCharCount();
    
    // Set up auto-save
    setupAutoSave();
    
    // Load external content files
    loadExternalContent();
});

// ==========================================
// External Content Loading
// ==========================================

async function loadExternalContent() {
    try {
        // Load sample content
        const sampleResponse = await fetch('./sample-content.md');
        if (sampleResponse.ok) {
            sampleContent = await sampleResponse.text();
        } else {
            console.error('Could not load sample-content.md');
        }
        
        // Load HTML template
        const templateResponse = await fetch('./html-template.html');
        if (templateResponse.ok) {
            htmlTemplate = await templateResponse.text();
        } else {
            console.error('Could not load html-template.html');
        }
    } catch (error) {
        console.error('Error loading external content files:', error);
    }
}

// ==========================================
// Theme Management
// ==========================================

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    showToast(`Switched to ${newTheme} mode`, 'info');
}

function updateThemeIcon(theme) {
    document.getElementById('themeIcon').textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ==========================================
// Event Listeners Setup
// ==========================================

function setupEventListeners() {
    const markdownInput = document.getElementById('markdownInput');
    
    // Character counter
    markdownInput.addEventListener('input', (e) => {
        updateCharCount();
        // Debounced auto-convert
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (e.target.value.trim()) {
                convertToHTML(true); // Silent convert
            }
        }, 1000);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // System theme change listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const theme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            updateThemeIcon(theme);
        }
    });
    
    // Drag and drop for file upload
    setupDragAndDrop();
}

// ==========================================
// Keyboard Shortcuts
// ==========================================

function handleKeyboardShortcuts(e) {
    // Show shortcuts with ?
    if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            showKeyboardShortcuts();
        }
    }
    
    // Other shortcuts with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'b':
                e.preventDefault();
                formatSelection('bold');
                break;
            case 'i':
                e.preventDefault();
                formatSelection('italic');
                break;
            case '`':
                e.preventDefault();
                formatSelection('code');
                break;
            case 'k':
                e.preventDefault();
                formatSelection('link');
                break;
            case 'Enter':
                e.preventDefault();
                convertToHTML();
                break;
            case 's':
                e.preventDefault();
                downloadHTML();
                break;
            case 'p':
                if (!e.shiftKey) {
                    e.preventDefault();
                    printToPDF();
                }
                break;
        }
    }
}

function showKeyboardShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    modal.classList.add('show');
}

function hideKeyboardShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    modal.classList.remove('show');
}

// ==========================================
// Text Formatting
// ==========================================

function formatSelection(type) {
    const textarea = document.getElementById('markdownInput');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let formattedText = '';
    let cursorOffset = 0;
    
    switch(type) {
        case 'bold':
            formattedText = `**${selectedText || 'bold text'}**`;
            cursorOffset = selectedText ? formattedText.length : 2;
            break;
        case 'italic':
            formattedText = `*${selectedText || 'italic text'}*`;
            cursorOffset = selectedText ? formattedText.length : 1;
            break;
        case 'code':
            if (selectedText.includes('\n')) {
                formattedText = `\`\`\`\n${selectedText}\n\`\`\``;
                cursorOffset = 4;
            } else {
                formattedText = `\`${selectedText || 'code'}\``;
                cursorOffset = selectedText ? formattedText.length : 1;
            }
            break;
        case 'link':
            const url = prompt('Enter URL:', 'https://');
            if (url) {
                formattedText = `[${selectedText || 'link text'}](${url})`;
                cursorOffset = selectedText ? 1 : 1;
            } else {
                return;
            }
            break;
    }
    
    textarea.value = textarea.value.substring(0, start) + formattedText + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    
    updateCharCount();
    convertToHTML(true); // Silent convert
}

// ==========================================
// Character Counter
// ==========================================

function updateCharCount() {
    const text = document.getElementById('markdownInput').value;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('charCount').textContent = `${text.length} chars, ${wordCount} words`;
}

// ==========================================
// Markdown Conversion
// ==========================================

function convertToHTML(silent = false) {
    const markdown = document.getElementById('markdownInput').value;
    if (!markdown.trim()) {
        if (!silent) showToast('Please enter some markdown content first', 'error');
        return;
    }

    try {
        const html = marked.parse(markdown);
        const preview = document.getElementById('preview');
        preview.innerHTML = `<div class="remarkable-content">${html}</div>`;
        
        // Apply syntax highlighting to code blocks
        preview.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
        
        // Update preview status
        document.getElementById('previewStatus').textContent = 'Updated';
        
        if (!silent) {
            showToast('Converted successfully!', 'success');
        }
    } catch (error) {
        showToast('Conversion failed: ' + error.message, 'error');
        console.error('Conversion error:', error);
    }
}

// ==========================================
// Preview Controls
// ==========================================

function zoomIn() {
    if (currentZoom < 2) {
        currentZoom += 0.1;
        applyZoom();
    }
}

function zoomOut() {
    if (currentZoom > 0.5) {
        currentZoom -= 0.1;
        applyZoom();
    }
}

function resetZoom() {
    currentZoom = 1;
    applyZoom();
}

function applyZoom() {
    const preview = document.getElementById('preview');
    preview.style.transform = `scale(${currentZoom})`;
    preview.style.transformOrigin = 'top left';
    showToast(`Zoom: ${Math.round(currentZoom * 100)}%`, 'info');
}

// ==========================================
// Sample Content
// ==========================================

async function loadSample() {
    // Try to use cached content first
    if (sampleContent) {
        document.getElementById('markdownInput').value = sampleContent;
        updateCharCount();
        convertToHTML(true);
        showToast('Sample content loaded', 'success');
        return;
    }
    
    // Load from file
    try {
        const response = await fetch('./sample-content.md');
        if (response.ok) {
            const content = await response.text();
            sampleContent = content; // Cache it
            document.getElementById('markdownInput').value = content;
            updateCharCount();
            convertToHTML(true);
            showToast('Sample content loaded', 'success');
        } else {
            throw new Error('Could not load sample content');
        }
    } catch (error) {
        showToast('Error: Could not load sample-content.md', 'error');
        console.error('Failed to load sample content:', error);
    }
}

function clearInput() {
    if (confirm('Are you sure you want to clear all content?')) {
        document.getElementById('markdownInput').value = '';
        document.getElementById('preview').innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <p>Your converted content will appear here</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.7;">Start by entering markdown or loading a sample</p>
            </div>
        `;
        updateCharCount();
        document.getElementById('previewStatus').textContent = 'Ready';
        showToast('Content cleared', 'info');
    }
}

// ==========================================
// File Operations
// ==========================================

function downloadHTML() {
    const preview = document.getElementById('preview');
    if (!preview.querySelector('.remarkable-content')) {
        showToast('Please convert markdown first', 'error');
        return;
    }

    const fullHTML = generateFullHTML(preview.innerHTML);
    if (!fullHTML) {
        return; // Error already shown in generateFullHTML
    }
    
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${document.getElementById('filename').value || 'llm-output'}-${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('HTML file downloaded!', 'success');
}

function generateFullHTML(content) {
    if (!htmlTemplate) {
        showToast('Error: HTML template not loaded', 'error');
        return null;
    }
    
    return htmlTemplate.replace('{{CONTENT}}', content);
}

function printToPDF() {
    const preview = document.getElementById('preview');
    if (!preview.querySelector('.remarkable-content')) {
        showToast('Please convert markdown first', 'error');
        return;
    }
    window.print();
    showToast('Opening print dialog...', 'info');
}

// ==========================================
// Drag and Drop
// ==========================================

function setupDragAndDrop() {
    const textarea = document.getElementById('markdownInput');
    const container = textarea.parentElement.parentElement;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            container.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        container.addEventListener(eventName, () => {
            container.classList.remove('drag-over');
        }, false);
    });
    
    container.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFiles(files);
        }
    }
}

function handleFiles(files) {
    const file = files[0];
    if (file.type === 'text/markdown' || file.name.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('markdownInput').value = e.target.result;
            updateCharCount();
            convertToHTML(true);
            showToast(`Loaded ${file.name}`, 'success');
        };
        reader.readAsText(file);
    } else {
        showToast('Please drop a markdown (.md) file', 'error');
    }
}

// ==========================================
// Server Integration
// ==========================================

async function checkServerStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        const statusElement = document.getElementById('serverStatus');
        const uploadBtn = document.getElementById('uploadBtn');
        
        if (response.ok && data.status === 'ok') {
            serverOnline = true;
            statusElement.innerHTML = `
                <div class="status-indicator online"></div>
                <span>Server online • rmapi: ${data.rmapi}</span>
            `;
            uploadBtn.disabled = data.rmapi !== 'available';
            
            if (data.rmapi === 'available') {
                loadFolders();
            } else {
                showToast('rmapi not available. Run: rmapi (to authenticate)', 'warning');
            }
        } else {
            throw new Error('Server not responding');
        }
    } catch (error) {
        serverOnline = false;
        const statusElement = document.getElementById('serverStatus');
        const uploadBtn = document.getElementById('uploadBtn');
        
        statusElement.innerHTML = `
            <div class="status-indicator offline"></div>
            <span>Server offline</span>
        `;
        uploadBtn.disabled = true;
        showToast('Server not available. Make sure server.js is running', 'error');
    }
}

async function loadFolders() {
    try {
        const response = await fetch('/api/remarkable-folders');
        const data = await response.json();
        
        if (response.ok && data.success) {
            const folderSelect = document.getElementById('folder');
            folderSelect.innerHTML = '';
            
            data.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder;
                option.textContent = folder;
                folderSelect.appendChild(option);
            });
            
            // Set default to /LLM-Outputs
            folderSelect.value = '/LLM-Outputs';
        }
    } catch (error) {
        console.error('Failed to load folders:', error);
    }
}

async function uploadToRemarkable() {
    const markdown = document.getElementById('markdownInput').value;
    const filename = document.getElementById('filename').value;
    const folder = document.getElementById('folder').value;
    
    if (!markdown.trim()) {
        showToast('Please enter some markdown content first', 'error');
        return;
    }
    
    if (!serverOnline) {
        showToast('Server is not available', 'error');
        return;
    }
    
    const uploadBtn = document.getElementById('uploadBtn');
    const originalContent = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
        <div class="loading" style="width: 16px; height: 16px; border-width: 2px;"></div>
        Uploading...
    `;
    
    try {
        showToast('Converting and uploading to reMarkable...', 'info');
        
        const response = await fetch('/api/convert-and-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                markdown: markdown,
                filename: filename || 'llm-output',
                folder: folder || '/LLM-Outputs'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showToast(`Successfully uploaded "${data.filename}" to ${data.folder}`, 'success');
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        showToast('Upload failed: ' + error.message, 'error');
        console.error('Upload error:', error);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalContent;
    }
}

// ==========================================
// Auto-save
// ==========================================

function setupAutoSave() {
    // Save content to localStorage periodically
    setInterval(() => {
        const content = document.getElementById('markdownInput').value;
        if (content.trim()) {
            localStorage.setItem('autosave-content', content);
            localStorage.setItem('autosave-time', new Date().toISOString());
        }
    }, 30000); // Every 30 seconds
    
    // Check for autosaved content on load
    const savedContent = localStorage.getItem('autosave-content');
    const savedTime = localStorage.getItem('autosave-time');
    
    if (savedContent && savedTime) {
        const timeDiff = Date.now() - new Date(savedTime).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 24) { // Less than 24 hours old
            if (confirm('Restore autosaved content from ' + new Date(savedTime).toLocaleString() + '?')) {
                document.getElementById('markdownInput').value = savedContent;
                updateCharCount();
                convertToHTML(true);
                showToast('Autosaved content restored', 'success');
            }
        }
    }
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            break;
        case 'error':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            break;
        case 'warning':
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
            break;
        default:
            icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }
    
    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 1100);
}

// ==========================================
// Status Messages (Legacy)
// ==========================================

function showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.innerHTML = `<div class="status ${type}"><div class="status-message">${message}</div></div>`;
    setTimeout(() => status.innerHTML = '', 5000);
}