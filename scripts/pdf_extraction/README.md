# Local report extraction service

The service calls the existing `pdf_extractor.py` without changing its extraction logic. The browser uploads files directly to this service; the app server only signs a five-minute token containing the authenticated user ID and server-authorized centre key. The service uses the centre key in that token and ignores any client-supplied centre. PDFs and extracted values stay in memory and are not logged or saved.

## Configure

1. Install Python 3.10 or newer and Tesseract OCR. On Windows, the service detects standard Tesseract installation folders.
2. From the project root, install the packages:

   ```powershell
   python -m pip install -r scripts\pdf_extraction\requirements.txt
   ```

3. Keep these values in the ignored root `.env.local` file:

   ```dotenv
   VITE_TERIIP_EXTRACTION_SERVICE_URL=http://localhost:8765
   TERIIP_EXTRACTION_TOKEN_SECRET=<same-random-secret-used-in-Netlify>
   TERIIP_EXTRACTION_ALLOWED_ORIGINS=http://localhost:8080,https://<your-site>.netlify.app
   ```

   Use a random secret of at least 32 bytes. Never put it in a `VITE_` variable. The browser URL is public; use your HTTPS Cloudflare Tunnel URL for `VITE_TERIIP_EXTRACTION_SERVICE_URL` in Netlify.

## Start locally and for production extraction

1. Start the extraction service:

   ```powershell
   python scripts\pdf_extraction\service.py
   ```

   It listens only on this computer at `127.0.0.1:8765`. The service allows browser origins only when they exactly match `TERIIP_EXTRACTION_ALLOWED_ORIGINS`, and accepts files up to 15 MB.

2. For local testing, keep `VITE_TERIIP_EXTRACTION_SERVICE_URL=http://localhost:8765` and open the app at `http://localhost:8080`.
3. To enable production-browser extraction, run a Cloudflare Tunnel to `http://127.0.0.1:8765`, set the resulting stable HTTPS URL as Netlify's `VITE_TERIIP_EXTRACTION_SERVICE_URL`, and add the Netlify site origin to `TERIIP_EXTRACTION_ALLOWED_ORIGINS` before restarting the service.

If extraction is unavailable, the page leaves all fields blank and editable; manual review and Google Sheets append remain available. P D Hinduja accepts CSV; other supported centres accept PDF. AIIMS Guwahati, Amrita Hospital Kochi, and PGIMER Chandigarh remain manual-entry-only.
