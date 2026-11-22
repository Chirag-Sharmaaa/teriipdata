import base64
import hmac
import io
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
from contextlib import redirect_stderr, redirect_stdout
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
EXTRACTION_DIR = Path(__file__).resolve().parent
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_FILE_BYTES + 65_536
TOKEN_LIFETIME_SECONDS = 5 * 60
TOKEN_ISSUER = "teriip"
TOKEN_AUDIENCE = "teriip-extraction"
CENTRE_KEYS = {"pd_hinduja"}
sys.path.insert(0, str(EXTRACTION_DIR))
import pdf_extractor as extractor

CENTRE_KEYS.update(extractor.CENTRE_REGISTRY)


class UploadTooLarge(ValueError):
    pass


def _read_setting(name):
    value = os.environ.get(name, "")
    if value:
        return value
    env_file = ROOT / ".env.local"
    if not env_file.is_file():
        return ""
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        variable, separator, value = line.partition("=")
        if separator and variable.strip() == name:
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            return value
    return ""


def _decode_base64url(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError("Invalid token.")
    padded = value + ("=" * (-len(value) % 4))
    try:
        return base64.b64decode(padded, altchars=b"-_", validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError("Invalid token.") from None


def _verify_token(token, secret=None, now=None):
    secret = secret if secret is not None else _read_setting("TERIIP_EXTRACTION_TOKEN_SECRET")
    if (
        not secret
        or len(secret.encode("utf-8")) < 32
        or not isinstance(token, str)
        or len(token) > 4096
    ):
        raise ValueError("Invalid token.")
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid token.")

    encoded_header, encoded_payload, encoded_signature = parts
    try:
        unsigned_token = f"{encoded_header}.{encoded_payload}".encode("ascii")
    except UnicodeEncodeError:
        raise ValueError("Invalid token.") from None
    supplied_signature = _decode_base64url(encoded_signature)
    expected_signature = hmac.new(
        secret.encode("utf-8"), unsigned_token, digestmod="sha256"
    ).digest()
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise ValueError("Invalid token.")

    try:
        header = json.loads(_decode_base64url(encoded_header))
        claims = json.loads(_decode_base64url(encoded_payload))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ValueError("Invalid token.") from None
    if not isinstance(header, dict) or header.get("alg") != "HS256" or header.get("typ") != "JWT":
        raise ValueError("Invalid token.")
    if not isinstance(claims, dict):
        raise ValueError("Invalid token.")
    issued_at = claims.get("iat")
    expires_at = claims.get("exp")
    current_time = int(time.time()) if now is None else int(now)
    if (
        claims.get("iss") != TOKEN_ISSUER
        or claims.get("aud") != TOKEN_AUDIENCE
        or not isinstance(claims.get("sub"), str)
        or not claims["sub"]
        or len(claims["sub"]) > 256
        or not isinstance(claims.get("centre_key"), str)
        or claims.get("centre_key") not in CENTRE_KEYS
        or type(issued_at) is not int
        or type(expires_at) is not int
        or expires_at <= current_time
        or issued_at > current_time + 30
        or expires_at <= issued_at
        or expires_at - issued_at > TOKEN_LIFETIME_SECONDS
    ):
        raise ValueError("Invalid token.")
    return claims


def _parse_allowed_origins(value=None):
    configured = _read_setting("TERIIP_EXTRACTION_ALLOWED_ORIGINS") if value is None else value
    origins = set()
    for item in configured.split(","):
        candidate = item.strip()
        if not candidate:
            continue
        try:
            parsed = urlsplit(candidate)
        except ValueError:
            continue
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            continue
        origins.add(f"{parsed.scheme.lower()}://{parsed.netloc.lower()}")
    return origins


def _parse_multipart_upload(content_type, body):
    try:
        content_type_bytes = content_type.encode("ascii")
    except UnicodeEncodeError:
        raise ValueError("Invalid upload.") from None
    message = BytesParser(policy=default).parsebytes(
        b"Content-Type: "
        + content_type_bytes
        + b"\r\nMIME-Version: 1.0\r\n\r\n"
        + body
    )
    if message.get_content_type() != "multipart/form-data" or not message.is_multipart():
        raise ValueError("Invalid upload.")

    uploaded_file = None
    for part in message.iter_parts():
        if (
            part.get_content_disposition() != "form-data"
            or part.get_param("name", header="content-disposition") != "file"
            or uploaded_file is not None
        ):
            raise ValueError("Invalid upload.")
        file_name = part.get_filename()
        file_bytes = part.get_payload(decode=True)
        if not file_name or not isinstance(file_bytes, bytes):
            raise ValueError("Invalid upload.")
        uploaded_file = (file_name.replace("\\", "/").rsplit("/", 1)[-1], file_bytes)

    if uploaded_file is None:
        raise ValueError("Invalid upload.")
    file_name, file_bytes = uploaded_file
    if len(file_bytes) > MAX_FILE_BYTES:
        raise UploadTooLarge("Upload exceeds the allowed size.")
    if not file_name or not file_bytes:
        raise ValueError("Invalid upload.")
    return file_name, file_bytes


def _configure_memory_only_ocr():
    if not extractor.OCR_AVAILABLE:
        raise RuntimeError("Install PyMuPDF, pytesseract, and Pillow before starting the service.")
    tesseract = extractor.pytesseract.pytesseract.tesseract_cmd
    if not shutil.which(tesseract) and not Path(tesseract).is_file():
        raise RuntimeError("Tesseract OCR was not found. Install it before starting the service.")

    pytesseract = extractor.pytesseract.pytesseract

    def image_to_string(image, lang=None, config="", nice=0, output_type=None, timeout=0):
        if output_type not in (None, pytesseract.Output.STRING):
            raise ValueError("The in-memory OCR service only returns text.")
        image_bytes = io.BytesIO()
        image.save(image_bytes, format="PNG")
        command = [pytesseract.tesseract_cmd, "stdin", "stdout"]
        if os.name != "nt" and nice:
            command = ["nice", "-n", str(nice), *command]
        if lang:
            command.extend(["-l", lang])
        if config:
            command.extend(shlex.split(config, posix=os.name != "nt"))
        result = subprocess.run(
            command,
            input=image_bytes.getvalue(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout or 120,
            check=False,
        )
        if result.returncode:
            raise RuntimeError("Tesseract OCR failed.")
        return result.stdout.decode("utf-8", errors="replace")

    extractor.pytesseract.image_to_string = image_to_string


def _extract(centre_key, file_name, file_bytes):
    if centre_key == "pd_hinduja":
        if not file_name.lower().endswith(".csv"):
            raise ValueError("Invalid upload.")
        extraction_function = lambda: extractor.process_single_csv_pd_hinduja(
            file_name, file_bytes
        )
    elif centre_key in extractor.CENTRE_REGISTRY:
        if not file_name.lower().endswith(".pdf") or not file_bytes.startswith(b"%PDF-"):
            raise ValueError("Invalid upload.")
        extraction_function = lambda: extractor.process_single_pdf(
            file_name, file_bytes, centre_key
        )
    else:
        raise ValueError("Invalid upload.")

    captured_text = {"ocr_used": False}
    original_text_function = extractor.extract_text_from_pdf

    def capture_pdf_text(pdf_buffer):
        text = original_text_function(pdf_buffer)
        captured_text["ocr_used"] = "===OCR_PAGE===" in text
        return text

    extractor.extract_text_from_pdf = capture_pdf_text
    try:
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            result = extraction_function()
    finally:
        extractor.extract_text_from_pdf = original_text_function
    if not isinstance(result, dict) or result.get("status") != "ok":
        raise RuntimeError("Extraction failed.")
    row = result.get("row")
    if not isinstance(row, dict):
        raise RuntimeError("Extraction failed.")
    json.dumps(row, allow_nan=False)
    return {"status": "ok", "row": row, "ocrUsed": captured_text["ocr_used"]}


class ExtractionHandler(BaseHTTPRequestHandler):
    server_version = "TERIIP-Extraction"
    sys_version = ""

    def log_message(self, _format_string, *_args):
        return

    def _origin_allowed(self):
        origin = self.headers.get("Origin")
        return not origin or origin in _parse_allowed_origins()

    def _send_cors_headers(self):
        origin = self.headers.get("Origin")
        self.send_header("Vary", "Origin")
        if origin and origin in _parse_allowed_origins():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Max-Age", "300")

    def _send_json(self, status, value):
        body = json.dumps(value, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if self.path != "/extract" or not self.headers.get("Origin"):
            self._send_json(404, {"error": "Not found."})
            return
        if not self._origin_allowed():
            self._send_json(403, {"error": "Origin not allowed."})
            return
        if self.headers.get("Access-Control-Request-Method") != "POST":
            self._send_json(405, {"error": "Method not allowed."})
            return
        requested_headers = {
            header.strip().lower()
            for header in self.headers.get("Access-Control-Request-Headers", "").split(",")
            if header.strip()
        }
        if not requested_headers.issubset({"authorization", "content-type"}):
            self._send_json(403, {"error": "Request headers not allowed."})
            return
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if not self._origin_allowed():
            self._send_json(403, {"error": "Origin not allowed."})
        elif self.path == "/health":
            self._send_json(200, {"status": "ready"})
        else:
            self._send_json(404, {"error": "Not found."})

    def do_POST(self):
        if not self._origin_allowed():
            self._send_json(403, {"error": "Origin not allowed."})
            return
        if self.path != "/extract":
            self._send_json(404, {"error": "Not found."})
            return

        authorization = self.headers.get("Authorization", "")
        scheme, separator, token = authorization.partition(" ")
        if not separator or scheme.lower() != "bearer":
            self._send_json(401, {"error": "Unauthorized."})
            return
        try:
            claims = _verify_token(token)
        except ValueError:
            self._send_json(401, {"error": "Unauthorized."})
            return

        if self.headers.get_content_type() != "multipart/form-data":
            self._send_json(415, {"error": "Multipart upload required."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._send_json(413, {"error": "Upload is too large."})
            return
        try:
            body = self.rfile.read(content_length)
            if len(body) != content_length:
                raise ValueError("Invalid upload.")
            file_name, file_bytes = _parse_multipart_upload(
                self.headers.get("Content-Type", ""), body
            )
            result = _extract(claims["centre_key"], file_name, file_bytes)
        except UploadTooLarge:
            self._send_json(413, {"error": "Upload is too large."})
        except ValueError:
            self._send_json(400, {"error": "Invalid upload."})
        except Exception:
            self._send_json(422, {"error": "The report could not be processed."})
        else:
            self._send_json(200, result)


class QuietHTTPServer(HTTPServer):
    def handle_error(self, _request, _client_address):
        return


def main():
    _configure_memory_only_ocr()
    secret = _read_setting("TERIIP_EXTRACTION_TOKEN_SECRET")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("Set TERIIP_EXTRACTION_TOKEN_SECRET in the root .env.local file.")
    port = int(os.environ.get("TERIIP_EXTRACTION_SERVICE_PORT", "8765"))
    server = QuietHTTPServer(("127.0.0.1", port), ExtractionHandler)
    print(f"TERIIP extraction service ready at http://127.0.0.1:{port}/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
