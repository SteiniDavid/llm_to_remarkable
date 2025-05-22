DISCLAIMER: VIBE CODED

````markdown
# LLM to reMarkable

Convert Markdown through an interactive web UI into reMarkable-optimized HTML/PDF and upload directly to your reMarkable device via `rmapi`.

## Features

- Live Markdown preview with syntax highlighting
- Download as HTML or print to PDF
- One-click upload to reMarkable via `rmapi`
- reMarkable-optimized styles for e-ink display
- Server health check and automatic folder listing

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** or **yarn**
- **rmapi** installed and authenticated ([GitHub repo](https://github.com/juruen/rmapi))
- **Google Chrome** or **Chromium** (for PDF conversion via Puppeteer)

## Setup

1. **Clone the repository**  
   ```bash
   git clone https://github.com/yourusername/llm-to-remarkable.git
   cd llm-to-remarkable
````

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install & authenticate rmapi**

   ```bash
   brew install rmapi
   # When you run rmapi it will ask you to pass in an authentication token that you get from remarkable.
   rmapi
   ```

   Follow the prompts to log in to your reMarkable account.

4. **Verify `rmapi` is available**

   ```bash
   which rmapi
   rmapi version
   ```

   You should see the version number; otherwise re-run `rmapi` to authenticate.

5. **Configure ports (optional)**
   By default, the server listens on `3000`. To change, set the environment variable `PORT`:

   ```bash
   export PORT=4000
   ```

6. **Start the server**

   ```bash
   npm run start
   # or
   yarn start
   ```

   You’ll see logs for server health and `rmapi` status.

7. **Open the frontend**
   Navigate to `http://localhost:3000` (or your custom `PORT`).

   * Paste or write Markdown in the left panel
   * Preview, download, or upload your document

## Project Structure

```
.
├── public/
│   ├── index.html        # Frontend UI
│   └── styles/           # CSS and assets
├── server.js             # Express backend with rmapi & Puppeteer
├── package.json
└── README.md
```

## Usage

1. Paste Markdown in the **Markdown Input** panel.
2. Click **Convert** (or auto-convert kicks in after typing).
3. Click **Download HTML** or **Print to PDF**.
4. (Optional) Click **Check Status** then **Upload to reMarkable**.

## Troubleshooting

* **Server offline / “make sure server.js is running”**
  Ensure you ran `npm start` and that no other process is using your chosen port.

* **`rmapi not available`**
  Re-run `rmapi` and ensure you’ve completed authentication.

* **PDF conversion errors**
  Confirm Chrome/Chromium is installed and accessible by Puppeteer.

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature-name`)
3. Commit your changes (`git commit -m 'Add feature'`)
4. Push to the branch (`git push origin feature-name`)
5. Open a Pull Request

## License

[MIT](LICENSE)

