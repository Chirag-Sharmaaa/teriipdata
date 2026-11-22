import base64
import hashlib
import hmac
import json
import threading
import time
import unittest
from http.server import HTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

import service
from service import (
    MAX_FILE_BYTES,
    UploadTooLarge,
    _parse_allowed_origins,
    _parse_multipart_upload,
    _verify_token,
)


SECRET = "test-secret-value-that-is-at-least-32-bytes-long"


def _token(claims):
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).rstrip(b"=")
    encoded_claims = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=")
    unsigned = encoded_header + b"." + encoded_claims
    signature = hmac.new(SECRET.encode(), unsigned, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return (unsigned + b"." + encoded_signature).decode()


def _claims(**overrides):
    values = {
        "iss": "teriip",
        "aud": "teriip-extraction",
        "sub": "user-123",
        "centre_key": "aiims_bathinda",
        "iat": 1000,
        "exp": 1300,
        "jti": "request-123",
    }
    values.update(overrides)
    return values


class ExtractionServiceTests(unittest.TestCase):
    def test_accepts_signed_centre_and_user_claims(self):
        claims = _verify_token(_token(_claims()), SECRET, now=1100)
        self.assertEqual(claims["centre_key"], "aiims_bathinda")
        self.assertEqual(claims["sub"], "user-123")

    def test_rejects_expired_tampered_and_unrecognized_centre_tokens(self):
        for token in (
            _token(_claims(exp=1099)),
            _token(_claims(centre_key="not-a-centre")),
            _token(_claims(centre_key=["aiims_bathinda"])),
            _token(_claims())[:-1] + "A",
            "non-ascii-☃.payload.signature",
        ):
            with self.subTest(token=token[:12]):
                with self.assertRaises(ValueError):
                    _verify_token(token, SECRET, now=1100)

    def test_allows_only_configured_web_origins(self):
        origins = _parse_allowed_origins(
            "http://localhost:8080, https://teriip.netlify.app/, https://bad.example/path"
        )
        self.assertEqual(origins, {"http://localhost:8080", "https://teriip.netlify.app"})

    def test_reads_file_bytes_in_memory_and_rejects_extra_form_fields(self):
        boundary = b"teriip-boundary"
        file_content = b"%PDF-1.7 test"
        body = (
            b"--"
            + boundary
            + b'\r\nContent-Disposition: form-data; name="file"; filename="report.pdf"\r\n'
            + b"Content-Type: application/pdf\r\n\r\n"
            + file_content
            + b"\r\n--"
            + boundary
            + b"--\r\n"
        )
        content_type = "multipart/form-data; boundary=teriip-boundary"
        self.assertEqual(
            _parse_multipart_upload(content_type, body),
            ("report.pdf", file_content),
        )

        with self.assertRaises(ValueError):
            _parse_multipart_upload(
                content_type,
                body.replace(
                    b"--teriip-boundary--\r\n",
                    b'--teriip-boundary\r\nContent-Disposition: form-data; name="centreKey"\r\n\r\n'
                    b"pd_hinduja\r\n--teriip-boundary--\r\n",
                ),
            )

    def test_rejects_files_over_the_upload_limit(self):
        boundary = b"teriip-boundary"
        file_content = b"x" * (MAX_FILE_BYTES + 1)
        body = (
            b"--"
            + boundary
            + b'\r\nContent-Disposition: form-data; name="file"; filename="report.pdf"\r\n'
            + b"Content-Type: application/pdf\r\n\r\n"
            + file_content
            + b"\r\n--"
            + boundary
            + b"--\r\n"
        )
        with self.assertRaises(UploadTooLarge):
            _parse_multipart_upload("multipart/form-data; boundary=teriip-boundary", body)

    def test_preflight_allows_only_configured_origins(self):
        server = HTTPServer(("127.0.0.1", 0), service.ExtractionHandler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/extract"
            request = Request(
                url,
                method="OPTIONS",
                headers={
                    "Origin": "https://teriip.netlify.app",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization,content-type",
                },
            )
            with patch.object(
                service, "_parse_allowed_origins", return_value={"https://teriip.netlify.app"}
            ):
                with urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 204)
                    self.assertEqual(
                        response.headers.get("Access-Control-Allow-Origin"),
                        "https://teriip.netlify.app",
                    )

                blocked = Request(
                    url,
                    method="OPTIONS",
                    headers={
                        "Origin": "https://unlisted.example",
                        "Access-Control-Request-Method": "POST",
                    },
                )
                with self.assertRaises(HTTPError) as error:
                    urlopen(blocked, timeout=5)
                self.assertEqual(error.exception.code, 403)
                self.assertIsNone(error.exception.headers.get("Access-Control-Allow-Origin"))
                error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)

    def test_extraction_uses_the_centre_from_the_verified_token(self):
        boundary = b"teriip-boundary"
        body = (
            b"--"
            + boundary
            + b'\r\nContent-Disposition: form-data; name="file"; filename="report.pdf"\r\n'
            + b"Content-Type: application/pdf\r\n\r\n%PDF-1.7 test\r\n--"
            + boundary
            + b"--\r\n"
        )
        current_time = int(time.time())
        token = _token(_claims(iat=current_time, exp=current_time + 300))
        server = HTTPServer(("127.0.0.1", 0), service.ExtractionHandler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            request = Request(
                f"http://127.0.0.1:{server.server_port}/extract",
                data=body,
                method="POST",
                headers={
                    "Origin": "http://localhost:8080",
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "multipart/form-data; boundary=teriip-boundary",
                },
            )
            with (
                patch.object(service, "_read_setting", return_value=SECRET),
                patch.object(
                    service,
                    "_parse_allowed_origins",
                    return_value={"http://localhost:8080"},
                ),
                patch.object(
                    service,
                    "_extract",
                    return_value={"status": "ok", "row": {"Record_ID": "R-1"}, "ocrUsed": False},
                ) as extract,
            ):
                with urlopen(request, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                self.assertEqual(extract.call_args.args[0], "aiims_bathinda")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
