"""
TERIIP — PDF Extraction Engine
==============================
Rebuilt for the new (2026) Drive convention: every centre folder now
contains PDFs directly (no subfolders), named "RecordID_ParticipantName.pdf".

Structure of this file (sections, in order):
  1. OCR / text-layer extraction        — reused from the old pipeline
  2. Filename parser                    — Record_ID / Name from the filename
  3. Generic value-extraction engine    — one engine, many centres
  4. Per-centre modules                 — mapping dict + patient info + any
                                           centre-specific overrides
  5. CLI debug harness

As each new centre is confirmed against a real sample PDF, its section gets
appended under (4). Nothing above that needs to change per-centre.
"""

import fitz  # PyMuPDF
import re
import io
import os
import platform
import csv

os.environ.setdefault("OMP_THREAD_LIMIT", "1")


def _autodetect_tesseract():
    """Find the Tesseract binary without needing TESSERACT_CMD set every
    session. Order: explicit env var always wins -> common Windows install
    locations -> fall back to whatever pytesseract finds on PATH."""
    if os.environ.get("TESSERACT_CMD"):
        return os.environ["TESSERACT_CMD"]
    if platform.system() == "Windows":
        for candidate in (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ):
            if os.path.exists(candidate):
                return candidate
    return None


# ─── OCR (optional — only needed for scanned pages) ───────────────────────────
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
    _tess_path = _autodetect_tesseract()
    if _tess_path:
        pytesseract.pytesseract.tesseract_cmd = _tess_path
except ImportError:
    OCR_AVAILABLE = False
    print("WARNING: pytesseract/Pillow not installed — OCR fallback disabled.")


# ══════════════════════════════════════════════════════════════════════════════
# 1. TEXT EXTRACTION  (text-layer + per-page OCR fallback)
# ══════════════════════════════════════════════════════════════════════════════

_TEXT_MIN_CHARS = 80  # below this, a page is treated as scanned/image-only


def _extract_page_text_layer(page):
    """Coordinate-sorted text extraction for one PyMuPDF page (handles
    multi-column lab report layouts in correct reading order)."""
    blocks = page.get_text("dict")["blocks"]
    lines = []
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            y = round(spans[0]["origin"][1], 1)
            span_texts = sorted(spans, key=lambda s: s["origin"][0])
            line_text = "  ".join(s["text"].strip() for s in span_texts if s["text"].strip())
            if line_text:
                lines.append((y, line_text))
    lines.sort(key=lambda x: x[0])
    merged = []
    for y, text in lines:
        if merged and abs(y - merged[-1][0]) < 3:
            merged[-1] = (merged[-1][0], merged[-1][1] + "  " + text)
        else:
            merged.append((y, text))
    return "\n".join(t for _, t in merged)


def _ocr_page(page, dpi=400):
    if not OCR_AVAILABLE:
        return ""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
    # Threshold to kill faint background watermarks (seen on P.D. Hinduja
    # scans) that otherwise confuse OCR on table borders/numbers. Safe no-op
    # on already-clean scans since binarization there just matches what
    # Tesseract does internally anyway.
    img = img.point(lambda p: 255 if p > 165 else 0)
    return pytesseract.image_to_string(img, config=r'--psm 4 -l eng')

def extract_text_from_pdf(pdf_buffer):
    """Extract text from every page: text-layer where possible, OCR fallback
    otherwise. Pages joined with ===PAGE_BREAK===; OCR'd pages tagged."""
    doc = fitz.open(stream=pdf_buffer, filetype="pdf")
    pages_text = []
    for page_num, page in enumerate(doc):
        text_layer = _extract_page_text_layer(page)
        if len(text_layer.strip()) >= _TEXT_MIN_CHARS:
            pages_text.append(text_layer)
        else:
            ocr_text = _ocr_page(page)
            if ocr_text.strip():
                pages_text.append(f"===OCR_PAGE===\n{ocr_text}")
            else:
                pages_text.append("===OCR_PAGE=== [empty]")
    return "\n\n===PAGE_BREAK===\n\n".join(pages_text)


# ══════════════════════════════════════════════════════════════════════════════
# 2. FILENAME PARSER
# ══════════════════════════════════════════════════════════════════════════════

def parse_filename(filename):
    """
    'RecordID_ParticipantName.pdf' -> (Record_ID, Name)
    Tolerant of extra underscores (e.g. 'RecordID__First_Last.pdf') and of
    duplicate-download junk some browsers append, like
    'RecordID_First_Last_pdf__1_.pdf' (from a file saved as "...pdf (1)")
    -> still ('RecordID', 'First Last'), not 'First Last Pdf 1'.
    """
    stem = os.path.splitext(os.path.basename(filename))[0]

    # Drive-style duplicate/copy-number PREFIX: a bare number followed by 2+
    # underscores sitting in front of what's actually the real hyphenated
    # Record_ID, e.g. "2___270-36_Raj_Deep_Saha" -> real ID is "270-36", not
    # "2". Only strips it when the token right after the junk looks like a
    # genuine ID (digits-hyphen-digits), so a normal single-token ID like
    # "273-28_Name" (which starts with a hyphen itself) is left untouched.
    m = re.match(r'^\d+_{2,}(\d+-\d+_.*)$', stem)
    if m:
        stem = m.group(1)

    parts = re.split(r'_+', stem, maxsplit=1)
    record_id = parts[0].strip()
    raw_name = parts[1] if len(parts) > 1 else ''
    words = [w for w in raw_name.split('_') if w and w.lower() != 'pdf' and not w.isdigit()]
    name = ' '.join(words).strip().title()
    return record_id, name


# ══════════════════════════════════════════════════════════════════════════════
# 3. GENERIC VALUE-EXTRACTION ENGINE
# ══════════════════════════════════════════════════════════════════════════════
#
# Each centre contributes a mapping dict: Standard_Param_Name -> regex for
# that centre's label text (or None if the centre doesn't test it).
# A "strategy" function turns (text, label_pattern) into a value.
# extract_by_mapping() runs the whole mapping through a chosen strategy.

def _clean_value(raw):
    """Strip a leading </> and a trailing H/L flag from a captured value.
    Also fixes two common OCR misreads:
      - decimal point misread as a comma (e.g. "74,4" for "74.4")
      - the digit 0 misread as "@" (e.g. "17@" for "170") — seen on
        thermal-printer/small-font scans like the Sysmex CBC printouts
    Without these, correctly-printed values silently fail the numeric
    regex and show up as blank cells."""
    if raw is None:
        return None
    v = raw.strip()
    v = re.sub(r'^[<>]\s*', '', v)
    v = re.sub(r'\s*[HLhl]\s*$', '', v)
    v = re.sub(r'(?<=\d),(?=\d)', '.', v)
    v = v.replace('@', '0')
    return v.strip()


# Shared numeric-capture fragment: digits, then an optional decimal point
# OR comma (OCR sometimes misreads "." as ","), then more digits. "@" is
# included as a digit alias since OCR frequently misreads "0" as "@" on
# some scanned printouts.
_NUM = r'[<>]?\s*[\d@]+[.,]?[\d@]*\s*[HLhl]?'


def _mask_ocr_digit_garbage(s):
    """Blank out digits that only appear as OCR noise inside an otherwise
    alphabetic token — e.g. "Diaz0" for "Diazo", or a methodology name like
    "(5-Nitro-5'-methyl-BAPTA)" printed right after a label. A token is only
    masked if it does NOT start with a number-like character — real results
    always lead with their digits even when a unit gets OCR-fused onto the
    end with no space (e.g. "0.79+{(10^3/uL]"), so leading-digit tokens are
    left untouched; only letter-led tokens (pure text/methodology) have
    their digits stripped, since a letter-led digit is reliably OCR noise."""
    def _mask_token(m):
        tok = m.group(0)
        if re.match(r'^[<>@\d]', tok):
            return tok
        return re.sub(r'\d', '', tok) if re.search(r'[A-Za-z]', tok) else tok
    return re.sub(r'\S+', _mask_token, s)


def _first_numeric_token(s):
    """First clean numeric token in a string, after masking OCR garbage."""
    m = re.search(rf'({_NUM})(?=\D|$)', _mask_ocr_digit_garbage(s))
    return _clean_value(m.group(1)) if m else None


def same_line_value(text, label_pattern):
    """Value is the first number appearing after the label, same line.
    Tries every occurrence of the label in turn, so a section title or
    table header printed before the real data row (e.g. "RETICULOCYTE
    COUNT" as a heading, with the actual "Reticulocyte Count  1.10" row
    further down) doesn't cause the whole lookup to give up early."""
    for m in re.finditer(rf'(?i){label_pattern}', text):
        line_end = text.find('\n', m.end())
        if line_end == -1:
            line_end = len(text)
        val = _first_numeric_token(text[m.end():line_end])
        if val is not None:
            return val
    return None


def next_line_value(text, label_pattern):
    """Value is the first number on the line immediately after the label.
    Tries every occurrence of the label in turn (same reasoning as
    same_line_value above)."""
    for m in re.finditer(rf'(?i){label_pattern}', text):
        next_start = text.find('\n', m.end())
        if next_start == -1:
            continue
        next_end = text.find('\n', next_start + 1)
        if next_end == -1:
            next_end = len(text)
        val = _first_numeric_token(text[next_start + 1:next_end])
        if val is not None:
            return val
    return None


def last_match_value(text, label_pattern):
    """Like same_line_value, but returns the LAST matching occurrence.
    Useful when a report template repeats a result in two sections and
    only one occurrence (typically the later one) is reliably printed —
    e.g. a value that's handwritten/illegible in an early panel but
    reprinted cleanly elsewhere in the same PDF."""
    result = None
    for line in text.split('\n'):
        m = re.search(rf'(?i){label_pattern}', line)
        if m:
            val = _first_numeric_token(line[m.end():])
            if val is not None:
                result = val
    return result


def value_before_label(text, label_pattern):
    """Value is on the line immediately BEFORE the matched label's line.
    Useful when a result's own row-label gets OCR-corrupted but a nearby
    reliable marker (e.g. a 'Method <Test>' line just below it) survives."""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if re.search(label_pattern, line, re.IGNORECASE) and i > 0:
            val = _first_numeric_token(lines[i - 1])
            if val is not None:
                return val
    return None


def _fix_arrow_digit_corruption(value_str, lo, hi):
    """Some scanned CBC printouts flag abnormal results with an up/down
    arrow (↑/↓) printed right before the number; OCR sometimes merges that
    arrow into an extra leading digit (e.g. '↓ 11.3' misread as '411.3',
    '↓ 31.6' misread as '131.6'). If the raw value is physiologically
    impossible for this parameter but stripping its first digit brings it
    into the plausible range, use the stripped version instead."""
    if value_str is None:
        return None
    try:
        v = float(value_str)
    except ValueError:
        return value_str
    if lo <= v <= hi:
        return value_str
    if len(value_str) > 1:
        try:
            v2 = float(value_str[1:])
            if lo <= v2 <= hi:
                return value_str[1:]
        except ValueError:
            pass
    return value_str


def value_anywhere_on_line(text, label_pattern):
    """Value can appear either before or after the label on its own line
    (e.g. '106.0  80-155 µg/dL  Copper') — masks out reference-range
    pairs first, then returns the first standalone number found anywhere
    on that line. Tries every line containing the label in turn."""
    for line in text.split('\n'):
        if re.search(rf'(?i){label_pattern}', line):
            masked = re.sub(r'\d+(?:\.\d+)?\s*[-–−]\s*\d+(?:\.\d+)?', ' ', line)
            masked = _mask_ocr_digit_garbage(masked)
            m = re.search(rf'({_NUM})(?=\D|$)', masked)
            if m:
                return _clean_value(m.group(1))
    return None


def value_whole_line_near_label(text, label_pattern, lookahead=2):
    """Like value_last_standalone_near_label, but searches the label's
    ENTIRE line (not just the text after the label match) plus the next
    `lookahead` lines. Needed for reports where the value sometimes
    prints BEFORE the label on the same line, e.g.:
        '4.34  RBC COUNT − (BLOOD)  3.8 − 4.8 million/cumm'
        '67.5  40 − 75%  Neutrophils'
    Masks out reference-range pairs first, then returns the first
    standalone number found. Tries every occurrence of the label."""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if not re.search(rf'(?i){label_pattern}', line):
            continue
        window = ' '.join([line] + lines[i + 1:i + 1 + lookahead])
        masked = re.sub(r'\d+(?:\.\d+)?\s*[-–−]\s*\d+(?:\.\d+)?', ' ', window)
        masked = _mask_ocr_digit_garbage(masked)
        m = re.search(rf'({_NUM})(?=\D|$)', masked)
        if m:
            return _clean_value(m.group(1))
    return None


def value_last_standalone_near_label(text, label_pattern, lookahead=2):
    """For reports where a long label wraps across lines, the row gets
    reordered to 'LABEL...  REFRANGE \\n UNIT  VALUE \\n rest-of-LABEL'
    instead of the normal 'LABEL  VALUE  REFRANGE  UNIT'
    (e.g. 'ABSOLUTE NEUTROPHIL COUNT, WHOLE  2000 - 7000\\ncells/mm3  3230
    \\nBLOOD EDTA'). Finds the first number in the label's own line plus
    the next `lookahead` lines that is NOT part of an 'X - Y' range pair
    — range-pair numbers get masked out first, since the real result is
    always a standalone number in both the normal and reordered layouts,
    while a reference range is always exactly two numbers joined by a
    hyphen. Tries every occurrence of the label in turn."""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        m = re.search(rf'(?i){label_pattern}', line)
        if not m:
            continue
        window = ' '.join([line[m.end():]] + lines[i + 1:i + 1 + lookahead])
        masked = re.sub(r'\d+(?:\.\d+)?\s*[-–−]\s*\d+(?:\.\d+)?', ' ', window)
        masked = _mask_ocr_digit_garbage(masked)
        vm = re.search(rf'({_NUM})(?=\D|$)', masked)
        if vm:
            return _clean_value(vm.group(1))
    return None


def same_or_next_line_value(text, label_pattern):
    """Value is the first number on the label's own line, OR (if that line
    has none) the line right after it — handles reports where a long
    methodology in parentheses pushes the label onto its own line and the
    actual result wraps to the next line, e.g.:
        'Total Bilirubin\n(DIAZOTIZATION with  0.85  mg/dL  0.3 - 1.2'
    Tries every occurrence of the label in turn (skips stray duplicate/
    empty label lines that sometimes appear in these reports)."""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        m = re.search(rf'(?i){label_pattern}', line)
        if not m:
            continue
        val = _first_numeric_token(line[m.end():])
        if val is not None:
            return val
        if i + 1 < len(lines):
            val = _first_numeric_token(lines[i + 1])
            if val is not None:
                return val
    return None


def value_before_unit(text, label_pattern, unit):
    """Number on the label's line that sits immediately before a given
    unit string. Useful when a report's Result/Ref.Range column order
    gets scrambled so the first number on the line is actually the
    reference range, not the result (e.g. 'Copper  70-140  56.36  ug/dL'
    — the real result, 56.36, is the number right before the unit)."""
    for line in text.split('\n'):
        if re.search(label_pattern, line, re.IGNORECASE):
            masked = _mask_ocr_digit_garbage(line)
            m = re.search(rf'({_NUM})\s*{re.escape(unit)}', masked)
            if m:
                return _clean_value(m.group(1))
    return None


def value_before_percent(text, label_pattern):
    """For CBC differential rows that print BOTH the absolute count and the
    percentage on the same line (e.g. 'NEUT 3.85 [10^3/uL] 63.6 [%') —
    same_line_value would grab the absolute count (first number); this
    grabs the number immediately preceding the '%' sign instead."""
    for line in text.split('\n'):
        if re.search(label_pattern, line, re.IGNORECASE):
            masked = _mask_ocr_digit_garbage(line)
            m = re.search(rf'({_NUM})\s*[\[\({{]*\s*%', masked)
            if m:
                return _clean_value(m.group(1))
    return None


def extract_by_mapping(text, mapping, default_strategy=same_line_value):
    """
    Run every parameter in `mapping` through a strategy. Each mapping value
    is either:
      - a regex pattern string          -> uses default_strategy
      - a (pattern, strategy_fn) tuple  -> uses that strategy instead
      - None                            -> not tested at this centre, skipped
    Returns dict Standard_Param_Name -> value (or None).
    """
    result = {}
    for param, spec in mapping.items():
        if spec is None:
            result[param] = None
        elif isinstance(spec, tuple):
            pattern, strategy = spec
            result[param] = strategy(text, pattern)
        else:
            result[param] = default_strategy(text, spec)
    return result


# ══════════════════════════════════════════════════════════════════════════════
# 4. CENTRE:  AIIMS BATHINDA
# ══════════════════════════════════════════════════════════════════════════════

aiims_bathinda_mapping = {
    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'\bHaemoglobin\b',
    "PCV":              r'HCT\s*\(\s*P\.C\.V\.\s*\)',
    "TRBC":             r'Total\s+Erythrocyte\s+Count',
    "MCV":              r'M\.C\.V\.',
    "MCH":              r'M\.C\.H\.(?!C)',
    "MCHC":             r'M\.C\.H\.C',
    "RDW":              r'R\.D\.W\.\s*CV',
    "TLC":              r'Total\s+Leucocyte\s+Count',
    "Neutrophil":       r'\bNeutrophils\b',
    "Lymphocyte":       r'\bLymphocytes\b',
    "Monocyte":         r'\bMonocytes\b',
    "Eosinophil":       r'\bEosinophils\b',
    "Basophil":         r'\bBasophils\b',
    "Platelet_Count":   r'Platelet\s+count',
    "MPV":              r'\bMPV\b',
    "Abs_Neutrophil":   r'Absolute\s+Neutrophil\s+Count',
    "Abs_Lymphocyte":   r'Absolute\s+Lymphocyte\s+Count',
    "Abs_Monocyte":     r'Absolute\s+Monocyte\s+Count',
    "Abs_Eosinophil":   r'Absolute\s+Eosinophil\s+Count',
    "Abs_Basophil":     r'Absolute\s+Basophil\s+Count',
    "Reticulocyte":     r'Reticulocyte\s+Count',
    "ESR":              r'\bESR\b',

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'RANDOM\s+BLOOD\s+GLUCOSE',   # reported as random here
    "HbA1c":            r'\bHBA1C\b',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'(?<!HDL\s)(?<!LDL\s)(?<!VLDL\s)\bCholesterol\s*-\s*Serum',
    "HDL":              r'\bHDL\s+Cholesterol\s*-\s*Serum',
    "LDL":              r'\bLDL\s+Cholesterol\s*-\s*Serum',
    "Triglycerides":    r'Triglyceride\s*-\s*Serum',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              r'\bTSH\b',
    "T3_Total":         r'T3\s*\(Tri.iodothyronine\)',
    "FT3":              None,   # not tested at this centre
    "T4_Total":         r'T4\s*\(Thyroxine\)',
    "FT4":              None,   # not tested at this centre
    "Anti_TPO":         r'Anti\s+TPO\s+Antibodies',
    "Anti_Thyroglobulin": r'Anti\s+Thyroglobulin\s+Antibody',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Total\s+Bilirubin\s*-\s*Serum',
    "Bilirubin_Direct": r'Direct\s+Bilirubin\s*-\s*Serum',
    "Bilirubin_Indirect": r'Indirect\s+Bilirubin\s*-\s*Serum',
    "AST":              r'Aspartate\s+Transaminase\s*\(SGOT',
    "ALT":              r'Alanine\s+Transaminase\s*\(SGPT',
    "ALP":              r'Alkaline\s+Phosphatase\s*-\s*Serum',
    "GGT":              r'Gamma\s+Glutamyl\s+Transferase\s*-\s*Serum',
    "Total_Protein":    r'Total\s+Protein\s*-\s*Serum',
    "Albumin":          r'Albumin\s*-\s*Serum',
    "Globulin":         r'Globulin\s*-\s*Serum',   # see note above

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'Urea\s*-\s*Serum',
    "Creatinine":       r'Creatinine\s*-\s*Serum',
    "Uric_Acid":        r'Uric\s+Acid\s*-\s*Serum',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'Sodium\s*-\s*Serum',
    "Potassium":        r'Potassium\s*-\s*Serum',
    "Chloride":         r'Chloride\s*-\s*Serum',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'Calcium\s*-\s*Serum',
    "Phosphorus":       r'Phosphorous\s*-\s*Serum',
    "Magnesium":        r'\bMagnesium\b',
    "Amylase":          r'Amylase\s*-\s*Serum',
    "Lipase":           r'Lipase\s*-\s*Serum',
    "CRP":              r'CRP\s*\(C-Reactive\s+Protein\)',

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             r'\bIron\b',
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'\bTIBC\b',
    "TFR_Saturation":   None,   # not reported at this centre

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      r'Vitamin\s+B12\s*-\s*Serum',
    "Vitamin_D":        r'VITAMIN\s+D\s+TOTAL\s*\(25.OH\)',
    "Folate":           r'Folic\s+Acid',
    "Copper":           r'Copper-Serum',
    "Zinc":             None,   # not tested at this centre
}


def extract_patient_info_aiims_bathinda(text):
    """Age / Gender / Collection date / lab's own Patient UID (Record_ID and
    Name come from the filename now, not from here)."""
    info = {}

    m = re.search(r'Age\s+and\s+Gender\s*:\s*(\d+)\s*Years?\s*/\s*(Male|Female)', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = m.group(2).capitalize()

    m = re.search(r'Sample\s+Collected\s+On\s*:\s*([\d./]+)', text, re.IGNORECASE)
    if m:
        info['Collection_Date'] = m.group(1).strip()

    m = re.search(r'Patient\s+UID\s+No\s*:\s*(\S+)', text, re.IGNORECASE)
    if m:
        info['Patient_UID'] = m.group(1).strip()

    return info


def extract_parameters_aiims_bathinda(text):
    """All standard parameters for AIIMS Bathinda via the generic engine,
    plus the one non-numeric field (Blood_Group) handled separately."""
    params = extract_by_mapping(text, aiims_bathinda_mapping, default_strategy=same_line_value)

    bg_m = re.search(r'Blood\s+Group\s+"?([ABO]{1,2})"?\s*Rh\s*(Positive|Negative)', text, re.IGNORECASE)
    params['Blood_Group'] = f"{bg_m.group(1).upper()} Rh {bg_m.group(2).capitalize()}" if bg_m else None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# 4b. CENTRE:  AIIMS BHOPAL
# ══════════════════════════════════════════════════════════════════════════════



# Checked against a real sample PDF: TIBC, Creatinine, Potassium, Chloride,
# Total_Protein, and GGT are all printed normally, NOT handwritten — the
# earlier version of this file wrongly hardcoded them to None for every
# patient. Real patterns for all six are now in the mapping below.
#
# The one field actually seen handwritten (pen-entered, not in the PDF's
# text layer, so it can't be regex-extracted at all) is LDL-Cholesterol —
# and only in 1 of 17 PDFs so far. Kept here purely so a reviewer gets a
# flag to go check the original PDF image for that one patient instead of
# assuming the test wasn't done.
AIIMS_BHOPAL_HANDWRITTEN_PRONE_FIELDS = ["LDL"]

aiims_bhopal_mapping = {
    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'\bHemoglobin\b',
    "PCV":              r'Hematrocit',                       # centre's own typo
    "TRBC":             r'R\s*B\s*C\s*Count',
    "MCV":              r'Mean\s+Cell\s+Volume',
    "MCH":              r'Mean\s+Cell\s+Hemoglobin\b',
    "MCHC":             r'Mean\s+Cell\s+Hb\s+Concentration',
    "RDW":              r'RDW\s+CV',
    "TLC":              r'White\s+Blood\s+Cell\s+Count',
    "Neutrophil":       r'\bNeutrophils\b',
    "Lymphocyte":       r'\bLymphocytes\b',
    "Monocyte":         r'\bMonocytes\b',
    "Eosinophil":       r'\bEosinophils\b',
    "Basophil":         r'\bBasophils\b',
    "Platelet_Count":   r'Platelet\s+Count',
    "MPV":              r'Mean\s+Platelet\s+Volume',
    "Abs_Neutrophil":   r'Abs\w+\s+Neutrophil\s+Count',
    "Abs_Lymphocyte":   r'Abs\w+\s+Lymphocyte\s+Count',
    "Abs_Monocyte":     r'Abs\w+\s+Monocyte\s+Count',
    "Abs_Eosinophil":   r'Abs\w+\s+E\w*inophil\w*\s+Count',   # OCR: "Ecsinophil"
    "Abs_Basophil":     r'Abs\w+\s+Basophil\s+Count',
    "Reticulocyte":     r'\bReticulocytes\b',
    "ESR":              (r'Erythrocyte\s+Sedimentation\s+Rate\s+Test', next_line_value),

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'Fasting\s+Blood\s+Sugar',
    "HbA1c":            r'\bA1C\b',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'\bTotal\s+Cholesterol\b',
    "HDL":              r'(?<!L)DL[-\s]*Cholester\w*',   # tolerant of OCR dropping the leading "H"
    "LDL":              r'\bLDL[-\s]*Cholesterol\b',
    "Triglycerides":    r'\bTriglycerides\b',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              r'\bTSH\b',
    "T3_Total":         r'(?<!Free\s)\bT3\b',
    "FT3":              None,   # not tested at this centre
    "T4_Total":         r'(?<!Free\s)\bT4\b',
    "FT4":              r'Free\s+T4',
    "Anti_TPO":         r'Anti\s+T\w{2}\s+Ab',    # OCR: "Anti Too Ab" for "Anti Tpo Ab"
    "Anti_Thyroglobulin": None,   # not tested at this centre

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Total\s+Bilirubin',
    "Bilirubin_Direct": r'Direct\s+Bilirubin',
    "Bilirubin_Indirect": r'Indirect\s+Bilirubin',
    "AST":              r'\bAST\b',
    "ALT":              r'\bALT\b',
    "ALP":              r'\bALP\b',
    "GGT":              r'\bGGT\b',
    "Total_Protein":    r'Total\s+Protein\b',
    "Albumin":          r'\bAlbumin\b',
    "Globulin":         None,   # blank in this sample; kept for future patients

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'\bUrea\b',
    "Creatinine":       r'\bCreatinine\b',
    "Uric_Acid":        r'Uric\s+Acid',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'\bSodium\b',
    "Potassium":        r'\bPotassium\b',
    "Chloride":         r'\bChloride\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'Total\s+Calcium\s*\(TC\)',
    "Phosphorus":       r'\bPhosphate\b',
    "Magnesium":        r'\bMagnesium\b',
    "Amylase":          r'\bAmylase\b',
    "Lipase":           r'\bLipase\b',
    "CRP":              r'C\s+Reactive\s+Protein',

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             (r'Serum\s+Iron', last_match_value),  # see note above
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'(?<!\()TIBC(?!\))',   # excludes the "(TIBC)" section header
    "TFR_Saturation":   r'Transferrin\s+Saturation',

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      r'Vitamin\s+B12',
    "Vitamin_D":        r'\bVitamin\s+D\b',
    "Folate":           None,   # not tested at this centre
    "Copper":           None,   # not tested at this centre
    "Zinc":             None,   # not tested at this centre
}


def extract_patient_info_aiims_bhopal(text):
    """Age / Gender / CR No (Record_ID and Name come from the filename).
    Header text is noisy from OCR (Hindi text/logo interference); we only
    pull what's reliably recoverable."""
    info = {}

    # OCR frequently mangles the "/" in "Yr/M" into stray characters (e.g.
    # "YrIM", "YriM"), so we don't require a literal slash — just a little
    # tolerance for junk between "Yr" and the M/F letter.
    m = re.search(r'Age\W*Sex\W{0,6}(\d{1,3})\s*Yr\w{0,4}\W{0,3}([MF])\b', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = 'Male' if m.group(2).upper() == 'M' else 'Female'

    m = re.search(r'CR\s*No\s*[:\s]*(\d{6,})', text)
    if m:
        info['Patient_CR_No'] = m.group(1).strip()

    return info


def extract_parameters_aiims_bhopal(text):
    params = extract_by_mapping(text, aiims_bhopal_mapping, default_strategy=same_line_value)

    # Flag if LDL (the one field seen handwritten so far) came back empty
    # for THIS patient, so a reviewer knows to check the original PDF image
    # rather than assume the test wasn't done.
    missing_prone = [f for f in AIIMS_BHOPAL_HANDWRITTEN_PRONE_FIELDS if params.get(f) is None]
    params['_Needs_Manual_Review'] = ', '.join(missing_prone) if missing_prone else None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# 4c. CENTRE:  AIIMS DELHI  (via "SMART Lab" outsourced reporting)
# ══════════════════════════════════════════════════════════════════════════════
#
# PDFs here are a bundle of several separate report pages per patient (CBC
# Sysmex printout + 2-3 separate biochemistry panels + immunoassay panel +
# a Transasia ESR-analyzer batch strip), all scanned/OCR'd rather than
# text-layer PDFs, so OCR quality is the main limiter here, not layout.
#
# Known gaps in this centre's PDFs (not extraction bugs — genuinely not
# machine-readable):
#   - ESR is only present on a shared multi-patient analyzer strip at the
#     end, matched to the patient by UHID position in a printed table. Too
#     fragile to regex reliably (OCR mangles the UHID digits themselves) —
#     left as None; check manually if ESR is needed for a given patient.
#   - Estradiol is reported but isn't part of the standard 66-field
#     schema shared across centres, so it isn't captured here. Let me know
#     if you want it added as a new column.

AIIMS_DELHI_HANDWRITTEN_PRONE_FIELDS = []  # none observed handwritten so far

aiims_delhi_mapping = {
    # ── CBC (Sysmex XN printout) ────────────────────────────────────────────
    "Hb":               r'\bHGB\b',
    "PCV":              r'\bHCT\b',
    "TRBC":             r'\bRBC\b(?!-)',            # excludes "RBC-BF" later on the slip
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             r'\bMCHC\b',
    "RDW":              r'RDW\W{0,3}CV',             # tolerant of OCR dropping the hyphen
    "TLC":              r'\bWBC\b(?!\s*-)',           # excludes "WBC-BF" / "WBC IP Message"
    "Neutrophil":       (r'\bNEUT\b', value_before_percent),
    "Lymphocyte":       (r'\bLYMPH\b', value_before_percent),
    "Monocyte":         (r'\bMONO\b', value_before_percent),
    "Eosinophil":       (r'\bEO\b', value_before_percent),
    "Basophil":         (r'\bBASO\b', value_before_percent),
    "Platelet_Count":   r'\bPLT\b',
    "MPV":              r'\bMPV\b',
    "Abs_Neutrophil":   r'\bNEUT\b',
    "Abs_Lymphocyte":   r'\bLYMPH\b',
    "Abs_Monocyte":     r'\bMONO\b',
    "Abs_Eosinophil":   r'\bEO\b',
    "Abs_Basophil":     r'\bBASO\b',
    "Reticulocyte":     r'\bRET\b(?!-)',              # excludes "RET-He" below it
    "ESR":              None,   # see note above — only on the shared analyzer strip

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'Glucose\s*F\b',
    "HbA1c":            None,   # not reported in this centre's panel set

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'Total\s+Cholesterol\b',
    "HDL":              (r'HDL\s*-\s*C\b', value_before_label),   # value prints ABOVE this label in this report layout
    "LDL":              r'(?<!V)LDL-C\b',              # excludes "VLDL-C"
    "Triglycerides":    r'\bTriglycerides\b',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              r'\bTSH\b',
    "T3_Total":         r'\bT3\b',
    "FT3":              None,   # not tested at this centre
    "T4_Total":         r'\bT4\b',
    "FT4":              None,   # not tested at this centre
    "Anti_TPO":         None,   # not tested at this centre
    "Anti_Thyroglobulin": None,   # not tested at this centre

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Bilirub\w*\s*\(T\)',
    "Bilirubin_Direct": r'Bilirub\w*\s*\(D\)',
    "Bilirubin_Indirect": r'Bilirub\w*\s*\(I\)',
    "AST":              r'\bAST\b',
    "ALT":              r'\bALT\b',
    "ALP":              r'\bALP\b',
    "GGT":              None,   # not tested at this centre
    "Total_Protein":    r'Total\s+protein\b',
    "Albumin":          r'\bAlbumin\b',
    "Globulin":         r'\bGlobulin\b',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'\bUrea\b',
    "Creatinine":       r'\bCreatinine\b',
    "Uric_Acid":        r'Uric\s+Acid',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'\bSodium\b',
    "Potassium":        r'\bPotassium\b',
    "Chloride":         r'\bChloride\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'\bCalcium\b',
    "Phosphorus":       r'\bPhosphate\b',
    "Magnesium":        None,   # not tested at this centre
    "Amylase":          r'Total\s+Amylase\b',
    "Lipase":           None,   # not tested at this centre
    "CRP":              None,   # not tested at this centre

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             None,   # not tested at this centre
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             None,   # not tested at this centre
    "TFR_Saturation":   None,   # not tested at this centre

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      None,   # not tested at this centre
    "Vitamin_D":        None,   # not tested at this centre
    "Folate":           None,   # not tested at this centre
    "Copper":           None,   # not tested at this centre
    "Zinc":             None,   # not tested at this centre
}


def extract_patient_info_aiims_delhi(text):
    """Age / Gender / UHID (Record_ID and Name come from the filename)."""
    info = {}

    m = re.search(r'UHID\s*[:\s]*(\d{6,})', text, re.IGNORECASE)
    if m:
        info['Patient_UHID'] = m.group(1).strip()

    m = re.search(r'Age\s*[:\s]*(\d{1,3})\s*Y', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)

    m = re.search(r'\bSex\s*[:\s]*(Male|Female)\b', text, re.IGNORECASE)
    if m:
        info['Gender'] = m.group(1).capitalize()

    return info


def extract_parameters_aiims_delhi(text):
    params = extract_by_mapping(text, aiims_delhi_mapping, default_strategy=same_line_value)

    missing_prone = [f for f in AIIMS_DELHI_HANDWRITTEN_PRONE_FIELDS if params.get(f) is None]
    params['_Needs_Manual_Review'] = ', '.join(missing_prone) if missing_prone else None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# 4d. CENTRE:  AIIMS JODHPUR
# ══════════════════════════════════════════════════════════════════════════════
#
# Two things make this centre different from the others:
#   1. AIIMS Jodhpur's own pages (Biochemistry/Immunoassay/Blood Bank) ARE
#      text-layer PDFs, but the label/value table gets linearized in a
#      scrambled order by the PDF text extractor — a row's methodology
#      text often wraps onto its own line, pushing the actual result onto
#      the line below the label rather than right after it. That's what
#      same_or_next_line_value (used as the default strategy here) is for.
#   2. CBC/ESR/Reticulocyte come from a second, outsourced lab (JMCH) as
#      a separate scanned report bundled into the same PDF, so those
#      fields go through OCR while the rest don't.
#
# Known gap: this JMCH CBC printout flags abnormal results with an arrow
# (↑/↓) that OCR sometimes fuses into an extra leading digit on the
# result itself (e.g. Hb "↓ 11.3" misread as "411.3"). Fixed for
# Hb/MCHC via a physiological-range sanity check (see
# _fix_arrow_digit_corruption above) since those two showed the corruption
# in the sample seen so far; worth a manual glance at other CBC fields
# from this centre until we've seen more samples.

aiims_jodhpur_mapping = {
    # ── CBC (JMCH, scanned) ──────────────────────────────────────────────
    "Hb":               (r'HAEMOGLOBIN', lambda t, p: _fix_arrow_digit_corruption(same_or_next_line_value(t, p), 3, 22)),
    "PCV":              r'\bPCV\b',
    "TRBC":             r'RBC\s+COUNT\b',
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             (r'\bMCHC\b', lambda t, p: _fix_arrow_digit_corruption(same_or_next_line_value(t, p), 20, 40)),
    "RDW":              r'\bRDW\b',
    "TLC":              r'\bWBC\b',
    "Neutrophil":       r'Neutrophils\b',
    "Lymphocyte":       r'Lymphocytes\b',
    "Monocyte":         r'Monocytes\b',
    "Eosinophil":       r'Eosinophils\b',
    "Basophil":         r'Basophils\b',
    "Platelet_Count":   r'PLATELET\s+COUNT\b',
    "MPV":              None,   # not reported at this centre
    "Abs_Neutrophil":   r'Absolute\s+Neutrophils\s+Counts?\b',
    "Abs_Lymphocyte":   r'Absolute\s+Lymphocytes\s+Counts?\b',
    "Abs_Monocyte":     r'Absolute\s+Monocytes\s+Counts?\b',
    "Abs_Eosinophil":   r'Absolute\s+Eosinophils\s+Counts?\b',
    "Abs_Basophil":     r'Absolute\s+Basophils\s+Counts?\b',
    "Reticulocyte":     r'RETICULOCYTE\s+COUNT\b',
    "ESR":              r'\bESR\b',

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'Fasting\s+Blood\s+Sugar\b',
    "HbA1c":            r'Hba1c\b',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'Total\s+Cholesterol\b',
    "HDL":              r'Hdl\s+Choles\w*',
    "LDL":              r'LDL\s+cholesterol\b',
    "Triglycerides":    r'\bTriglycerides\b',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              r'\bTsh\b',
    "T3_Total":         r'Total\s+T3\b',
    "FT3":              r'\bFt3\b',
    "T4_Total":         r'Total\s+T4\b',
    "FT4":              r'\bFt4\b',
    "Anti_TPO":         r'Anti\s+Tpo\b',
    "Anti_Thyroglobulin": r'Anti\s+Thyroglobulin\s+Antibody\b',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Total\s+Bilirubin\b',
    "Bilirubin_Direct": r'Direct\s+Bilirubin\b',
    "Bilirubin_Indirect": None,   # not reported at this centre
    "AST":              r'\bAst\b',
    "ALT":              r'\bAlt\b',
    "ALP":              r'\bAlp\b',
    "GGT":              r'\bGgt\b',
    "Total_Protein":    r'Total\s+Protein\b',
    "Albumin":          r'\bAlbumin\b',
    "Globulin":         r'\bGlobulin\b',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'Blood\s+Urea\b',
    "Creatinine":       r'Serum\s+Creatinine\b',
    "Uric_Acid":        r'Uric\s+Acid\b',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'Sodium\b',
    "Potassium":        r'Potassium\b',
    "Chloride":         r'Chloride\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'\bCalcium\b',
    "Phosphorus":       r'\bPhosphorus\b',
    "Magnesium":        r'\bMagnesium\b',
    "Amylase":          r'Serum\s+Amylase\b',
    "Lipase":           r'\bLipase\b',
    "CRP":              r'\(IMMUNOTURBIDIMETRY\)',   # see note: label/value split across 3 lines, methodology is the reliable anchor

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             r'Iron\s*\(TPTZ\)',
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'\bTibc\b',
    "TFR_Saturation":   r'Tfr\s+saturation\b',

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      r'Vitamin\s+B12\b',
    "Vitamin_D":        r'Vitamin\s+D\b',
    "Folate":           r'\bFolate\b',
    "Copper":           (r'\bCopper\b', lambda t, p: value_before_unit(t, p, 'ug/dL')),
    "Zinc":             r'\bZinc\b',
}


def extract_patient_info_aiims_jodhpur(text):
    """Age / Gender / UHID / CR No. Deliberately searches the whole
    document for these self-contained patterns (e.g. '23 Yr /F',
    'UHID735013') rather than doing label-then-value lookups, since this
    centre's own pages linearize their label/value table in a scrambled
    order that makes simple adjacency unreliable."""
    info = {}

    m = re.search(r'(\d{1,3})\s*Y(?:rs?)?\s*/\s*(Male|Female|M|F)\b', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = 'Male' if m.group(2).upper().startswith('M') else 'Female'

    m = re.search(r'\bUHID(\d+)\b', text, re.IGNORECASE)
    if m:
        info['Patient_UHID'] = m.group(1)

    m = re.search(r'\b(\d{15})\b', text)   # AIIMS Jodhpur's CR No is consistently a 15-digit ID
    if m:
        info['Patient_CR_No'] = m.group(1)

    return info


def extract_parameters_aiims_jodhpur(text):
    return extract_by_mapping(text, aiims_jodhpur_mapping, default_strategy=same_or_next_line_value)


# ══════════════════════════════════════════════════════════════════════════════
# 4e. CENTRE:  AIIMS KALYANI
# ══════════════════════════════════════════════════════════════════════════════
#
# Best of the centres seen so far: these PDFs have a real text layer on
# every page except the HbA1c electropherogram graph page (which OCR still
# handles, but that page has no extra data we need — the actual HbA1c
# value is on the text-layer page right before it). ~5s/PDF vs ~4s/PAGE for
# the scanned centres.
#
# One layout quirk to know about: the patient-info header row (CR No / Age-
# Sex / etc.) gets scrambled by the text linearizer — labels come out on
# one line and their values on a DIFFERENT line, not lined up 1:1 with the
# labels above them. So patient info here is pulled with whole-document,
# self-contained patterns (a 15-digit CR No, a bare "20 Yr/M" token) rather
# than "find label, read next line", same approach as AIIMS Jodhpur.
#
# Another quirk seen twice in the mapping below: a few labels have a
# same-line parenthetical that itself contains a digit — e.g.
# "Total Triiodothyronine(T3)  1.22" — so the label pattern must swallow
# the "(T3)" itself, otherwise the extractor grabs the "3" in "(T3)" as
# the result instead of "1.22". Flagged inline below.

AIIMS_KALYANI_HANDWRITTEN_PRONE_FIELDS = []  # none observed handwritten so far — real text-layer PDFs

aiims_kalyani_mapping = {
    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'\bHaemoglobin\b',
    "PCV":              r'\bHCT\b',
    "TRBC":             r'R\.B\.C\s*Count',
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             r'\bMCHC\b',
    "RDW":              r'RDW\W*CV',
    "TLC":              r'Total\s+Leukocyte\s+Count',
    "Neutrophil":       r'\bNeutrophils\b',
    "Lymphocyte":       r'\bLymphocytes\b',
    "Monocyte":         r'\bMonocytes\b',
    "Eosinophil":       r'\bEosinophils\b',
    "Basophil":         r'\bBasophils\b',
    "Platelet_Count":   r'Platelet\s+Count',
    "MPV":              None,   # not reported in this centre's CBC panel
    "Abs_Neutrophil":   r'Absolute\s+Neutrophil\s+Count',
    "Abs_Lymphocyte":   r'Absolute\s+Lymphocyte\s+Count',
    "Abs_Monocyte":     r'Absolute\s+Monocyte\s+Count',
    "Abs_Eosinophil":   r'Absolute\s+Eosinophil\s+Count',
    "Abs_Basophil":     r'Absolute\s+Basophil\s+Count',
    "Reticulocyte":     r'Reticulocyte\s+Count',
    "ESR":              r'Erythrocyte\s+Sedimentation\s+Rate',

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'Fasting\s+Plasma\s+Glucose',
    "HbA1c":            r'\bHbA1c\b',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'Serum\s+Total\s+Cholesterol\b',
    "HDL":              r'\bHDL\s+Cholesterol\b',
    "LDL":              r'\bLDL\s+Cholesterol\b',
    "Triglycerides":    r'Serum\s+Triglycerides\b',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    # TSH and Anti_TPO's labels get split across lines by the text
    # linearizer (methodology text pushes the label onto 2 lines with the
    # value sandwiched after the FIRST line) — next_line_value handles that.
    "TSH":              (r'Thyroid-stimulating', next_line_value),
    "T3_Total":         r'Total\s+Triiodothyronine\s*\(T3\)',   # must swallow "(T3)" — see note above
    "FT3":              r'\bFt3\b',
    "T4_Total":         r'Total\s+Thyroxine\s*\(T4\)',          # must swallow "(T4)" — see note above
    "FT4":              r'Free\s+T4\b',
    "Anti_TPO":         (r'Thyroid\s+peroxidase', next_line_value),
    "Anti_Thyroglobulin": r'Thyroglobulin\s+AB\b',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Serum\s+Bilirubin\s+Total\b',
    "Bilirubin_Direct": r'Serum\s+Bilirubin\s+Direct',
    "Bilirubin_Indirect": r'Serum\s+Bilirubin\s+Indirect\b',
    "AST":              r'Aspartate\s+transaminase\b',
    "ALT":              r'Alanine\s+Transaminase\b',
    "ALP":              r'Alkaline\s+Phosphatase\b',
    "GGT":              r'Gamma\s+Glutamyl\b',
    "Total_Protein":    r'Serum\s+Protein\b',
    "Albumin":          r'Serum\s+Albumin\b',
    "Globulin":         r'Serum\s+Globulin\b',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'Serum\s+Urea\b',
    "Creatinine":       r'Serum\s+Creatinine\b',
    "Uric_Acid":        r'Serum\s+Uric\s+Acid\b',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'Serum\s+Sodium\b',
    "Potassium":        r'Serum\s+Potassium\b',
    "Chloride":         r'Serum\s+Chloride\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'Serum\s+Calcium\b',
    "Phosphorus":       r'Serum\s+Phosphorus\b',
    "Magnesium":        r'Serum\s+Magnesium\b',
    "Amylase":          r'Serum\s+Amylase\b',
    "Lipase":           r'Serum\s+lipase\b',
    "CRP":              r'Serum\s+CRP\b',

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             r'Serum\s+Iron\b',
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'\bTibc\b',
    "TFR_Saturation":   r'Transferrin\s+Saturation\b',

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      r'Vitamin[\s-]*B12\b',
    "Vitamin_D":        r'Vitamin\s+D\b',
    "Folate":           r'\bFolate\b',
    "Copper":           None,   # not observed in this centre's sample — add if seen for another patient
    "Zinc":             None,   # not observed in this centre's sample — add if seen for another patient
}


def extract_patient_info_aiims_kalyani(text):
    """Age / Gender / CR No (Record_ID and Name come from the filename).
    Header row's label/value pairs get scrambled by the text linearizer
    (values land on a different line than their labels), so — like AIIMS
    Jodhpur — this searches the whole document for self-contained patterns
    instead of doing label-then-adjacent-value lookups."""
    info = {}

    m = re.search(r'(\d{1,3})\s*Yr\s*/\s*(M|F)\b', text)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = 'Male' if m.group(2).upper() == 'M' else 'Female'

    m = re.search(r'\b(\d{15})\b', text)   # CR No is consistently a 15-digit ID, same as other AIIMS centres
    if m:
        info['Patient_CR_No'] = m.group(1)

    return info


def extract_parameters_aiims_kalyani(text):
    params = extract_by_mapping(text, aiims_kalyani_mapping, default_strategy=same_line_value)

    missing_prone = [f for f in AIIMS_KALYANI_HANDWRITTEN_PRONE_FIELDS if params.get(f) is None]
    params['_Needs_Manual_Review'] = ', '.join(missing_prone) if missing_prone else None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# 4f. CENTRE:  AIIMS RAIPUR
# ══════════════════════════════════════════════════════════════════════════════
#
# Text-layer PDF, no OCR. Two report styles bundled together: AIIMS Raipur's
# own "Nabl-Clinical/Immuno Biochemistry" reports (clean single-line
# Label/Result/Unit/RefRange), and outsourced Agilus Diagnostics reports
# (CBC, Iron/TIBC, Vitamin B12/D, CRP, Anti-TPO, Folic Acid, Copper/Zinc)
# which print a section-header line (e.g. "IRON AND TIBC STUDIES,SERUM")
# right before the actual data line, so same_or_next_line_value's
# fallback-to-next-line is what makes most of these resolve correctly.

aiims_raipur_mapping = {
    # ── CBC (Agilus) ─────────────────────────────────────────────────────
    "Hb":               r'\((?-i:HB)\)',
    "PCV":              r'\((?-i:PCV)\)',
    "TRBC":             r'\((?-i:RBC)\)\s*COUNT',
    "MCV":              r'\((?-i:MCV)\)',
    "MCH":              r'\((?-i:MCH)\)',
    "MCHC":             (r'\((?-i:MCHC)\)', value_before_label),
    "RDW":              r'\((?-i:RDW)\)',
    "TLC":              r'\((?-i:WBC)\)\s*COUNT',
    "Neutrophil":       r'(?-i:NEUTROPHILS)\b',
    "Lymphocyte":       r'(?-i:LYMPHOCYTES)\b',
    "Monocyte":         r'(?-i:MONOCYTES)\b',
    "Eosinophil":       r'(?-i:EOSINOPHILS)\b',
    "Basophil":         r'(?-i:BASOPHILS)\b',
    "Platelet_Count":   r'(?-i:PLATELET\s+COUNT)\b',
    "MPV":              r'\((?-i:MPV)\)',
    "Abs_Neutrophil":   r'(?-i:ABSOLUTE\s+NEUTROPHIL\s+COUNT)\b',
    "Abs_Lymphocyte":   r'(?-i:ABSOLUTE\s+LYMPHOCYTE\s+COUNT)\b',
    "Abs_Monocyte":     r'(?-i:ABSOLUTE\s+MONOCYTE\s+COUNT)\b',
    "Abs_Eosinophil":   r'(?-i:ABSOLUTE\s+EOSINOPHIL\s+COUNT)\b',
    "Abs_Basophil":     r'(?-i:ABSOLUTE\s+BASOPHIL\s+COUNT)\b',
    "Reticulocyte":     r'(?-i:RETICULOCYTE\s+COUNT)\b',
    "ESR":              r'(?-i:E\.S\.R)\b',

    # ── Glucose / Diabetes (own reports) ────────────────────────────────
    "Glucose_Fasting":  r'Fasting\s+Plasma\s+Glucose\b',
    "HbA1c":            r'Hba1c\b',

    # ── Lipid Profile (own reports) ─────────────────────────────────────
    "Total_Cholesterol": r'Total\s+Cholesterol\b',
    "HDL":              r'\bHDL\b',
    "LDL":              r'\bLDL\b',
    "Triglycerides":    r'\bTriglycerides\b',

    # ── Thyroid Profile (own reports) ───────────────────────────────────
    "TSH":              r'TSH\s+ultra\b',
    "T3_Total":         r'T3\s+Total\b',
    "FT3":              r'T3\s+Free\b',
    "T4_Total":         r'T4\s+Total\b',
    "FT4":              r'T4\s+Free\b',
    "Anti_TPO":         r'(?-i:ANTI-THYROID\s+PEROXIDASE\s+ANTIBODIES)\b(?!,)',   # excludes the ", SERUM" section-title line
    "Anti_Thyroglobulin": None,   # this centre reports plain Thyroglobulin (tumor marker), not the antibody test

    # ── LFT (own reports) ────────────────────────────────────────────────
    "Bilirubin_Total":  r'Total\s+Bilirubin\b',
    "Bilirubin_Direct": r'Direct\s+Bilirubin\b',
    "Bilirubin_Indirect": r'Indirect\s+Bilirubin\b',
    "AST":              r'\bAST\b',
    "ALT":              r'\bALT\b',
    "ALP":              r'\bALP\b',
    "GGT":              r'\bGGT\b',
    "Total_Protein":    r'Total\s+Protein\b',
    "Albumin":          r'\bAlbumin\b',
    "Globulin":         None,   # not reported at this centre

    # ── KFT (own reports) ────────────────────────────────────────────────
    "Urea":             r'\bUrea\b',
    "Creatinine":       r'\bCreatinine\b',
    "Uric_Acid":        r'Uric\s+Acid\b',

    # ── Electrolytes (own reports) ──────────────────────────────────────
    "Sodium":           r'\bSodium\b',
    "Potassium":        r'\bPotassium\b',
    "Chloride":         r'\bChloride\b',

    # ── Others (own reports) ─────────────────────────────────────────────
    "Calcium":          r'\bCalcium\b',
    "Phosphorus":       r'Phosphor\w*\b',   # this centre spells it "Phosphorous"
    "Magnesium":        r'\bMagnesium\b',
    "Amylase":          r'\bAmylase\b',
    "Lipase":           r'\bLipase\b',
    "CRP":              r'(?-i:C-REACTIVE\s+PROTEIN)\b(?!,)',   # excludes the ", SERUM (QUANTITATIVE)" section-title line

    # ── Iron Studies (Agilus) ────────────────────────────────────────────
    "Iron":             r'(?-i:IRON)\b(?!\s+AND)',   # excludes the "IRON AND TIBC STUDIES" section-title line
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'(?-i:TOTAL\s+IRON\s+BINDING\s+CAPACITY)\b',
    "TFR_Saturation":   r'(?-i:%\s*SATURATION)\b',

    # ── Additional (Agilus) ──────────────────────────────────────────────
    "Vitamin_B12":      r'(?-i:VITAMIN\s*B12)\b(?!\()',   # excludes the "VITAMIN B12(CYANOCOBALAMINE)," section-title line
    "Vitamin_D":        r'(?-i:HYDROXYVITAMIN\s*D)\b(?!\(VITAMIN)',   # excludes the "...D(VITAMIN D TOTAL),SERUM" section-title line
    "Folate":           r'(?-i:FOLIC\s+ACID)\b(?!,)',   # excludes the ", SERUM" section-title line
    "Copper":           r'(?-i:COPPER,\s*SERUM)\b',
    "Zinc":             r'(?-i:ZINC)\b(?!,)',
}


def extract_patient_info_aiims_raipur(text):
    """Age / Gender / CR No. Handles both this centre's own report header
    ('23 Yr/M') and the outsourced Agilus report header ('23 Years Male')."""
    info = {}

    m = re.search(r'(\d{1,3})\s*(?:Yr|Years?)\.?\s*/?\s*(Male|Female|M|F)\b', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = 'Male' if m.group(2).upper().startswith('M') else 'Female'

    m = re.search(r'\b(\d{15})\b', text)   # AIIMS Raipur's own CR No is a 15-digit ID
    if m:
        info['Patient_CR_No'] = m.group(1)

    return info


def flagged_or_normal_value(text, label_pattern):
    """Agilus reports sometimes pull an abnormal (Low/High) result to the
    FRONT of its line, ahead of the label itself, e.g.:
        '4.21  Low  mil/uL  RED BLOOD CELL (RBC) COUNT  4.5 - 5.5'
    instead of the normal 'LABEL  VALUE  RefRange' order. Checks for a
    Low/High-flagged number anywhere on the label's line first; if none,
    falls back to the normal same-line/next-line search."""
    for line in text.split('\n'):
        if re.search(label_pattern, line):
            m = re.search(rf'({_NUM})\s+(?:Low|High)\b', line, re.IGNORECASE)
            if m:
                return _clean_value(m.group(1))
    return same_or_next_line_value(text, label_pattern)


def extract_parameters_aiims_raipur(text):
    return extract_by_mapping(text, aiims_raipur_mapping, default_strategy=flagged_or_normal_value)


# ══════════════════════════════════════════════════════════════════════════════
# CENTRE: NIRRH PORT BLAIR
# (Gleneagles report format)
# ══════════════════════════════════════════════════════════════════════════════

nirrh_port_blair_mapping = {

    # CBC
    "Hb": r'Haemoglobin',
    "PCV": r'Packed\s+Cell\s+Volume',
    "TRBC": r'RBC\s+COUNT',
    "MCV": r'\bMCV\b',
    "MCH": r'\bMCH\b(?!C)',
    "MCHC": r'\bMCHC\b',
    "RDW": r'RDW-CV',
    "TLC": r'Total\s+WBC\s+Count',
    "Neutrophil": r'Neutrophils',
    "Lymphocyte": r'Lymphocytes',
    "Monocyte": r'Monocytes',
    "Eosinophil": r'Eosinophils',
    "Basophil": r'Basophils',
    "Platelet_Count": r'Platelet\s+Count',
    "MPV": None,

    "Abs_Neutrophil": r'ABSOLUTE\s+NEUTROPHIL\s+COUNT',
    "Abs_Lymphocyte": r'ABSOLUTE\s+LYMPHOCYTE\s+COUNT',
    "Abs_Monocyte": r'ABSOLUTE\s+MONOCYTE\s+COUNT',
    "Abs_Eosinophil": r'ABSOLUTE\s+EOSINOPHIL\s+COUNT',
    "Abs_Basophil": r'ABSOLUTE\s+BASOPHIL\s+COUNT',

    "Reticulocyte": r'RETICULOCYTE\s+COUNT',
    "ESR": r'ESR\s*\(1\s*Hour\)',   # consumes "(1 Hour)" so that "1" can't be mistaken for the result

    # Diabetes
    "Glucose_Fasting": None,
    "HbA1c": None,

    # Lipid
    "Total_Cholesterol": r'CHOLESTEROL-TOTAL',
    "HDL": r'HDL\s+CHOLESTEROL',
    "LDL": r'LDL\s+CHOLESTEROL',
    "Triglycerides": r'TRIGLYCERIDES',

    # Thyroid
    "TSH": r'TSH',
    "T3_Total": r'TOTAL\s+T3',
    "FT3": r'FREE\s+T3',
    "T4_Total": r'TOTAL\s+T4',
    "FT4": r'FREE\s+T4',
    "Anti_TPO": r'ANTI-TPO',
    "Anti_Thyroglobulin": r'ANTI-TG',

    # LFT
    "Bilirubin_Total": r'BILIRUBIN\(TOTAL\)',
    "Bilirubin_Direct": r'BILIRUBIN\s+DIRECT',
    "Bilirubin_Indirect": None,
    "AST": r'\bAST\b',
    "ALT": r'\bALT\b',
    "ALP": r'\bALP\b',
    "GGT": r'\bGGT\b',
    "Total_Protein": r'TOTAL\s+PROTEIN',
    "Albumin": r'ALBUMIN',
    "Globulin": r'\bGLOBULIN\b',

    # KFT
    "Urea": r'UREA',
    "Creatinine": r'CREATININE',
    "Uric_Acid": r'URIC\s+ACID',

    # Electrolytes
    "Sodium": r'SODIUM',
    "Potassium": r'POTASSIUM',
    "Chloride": None,

    # Others
    "Calcium": r'CALCIUM-TOTAL',
    "Phosphorus": r'INORGANIC\s+PHOSPHORUS',
    "Magnesium": r'MAGNESIUM',
    "Amylase": r'AMYLASE',
    "Lipase": r'LIPASE',
    "CRP": r'CRP',

    # Iron
    "Iron": r'Serum\s+Iron',
    "Ferritin": r'FERRITIN',
    "TIBC": r'TIBC\s*\(TOTAL\s+IRON\s+BINDING\s+CAPACITY\)',
    "TFR_Saturation": r'TRANSFERRIN\s+SATUARATION',

    # Vitamins
    "Vitamin_B12": r'VITAMIN\s+B12',
    "Vitamin_D": r'25-OH\s+VITAMIN-D',
    "Folate": r'FOLIC\s+ACID',
    "Copper": (r'\bCopper\b(?!,)', value_anywhere_on_line),   # excludes "Copper, Serum" section-title line
    "Zinc": (r'Zinc,\s*Serum\b', value_anywhere_on_line),
}

def extract_patient_info_nirrh_port_blair(text):
    info = {}

    m = re.search(r'(\d+)Y\s*/\s*([MF])', text)
    if m:
        info["Age"] = m.group(1)
        info["Gender"] = "Male" if m.group(2) == "M" else "Female"

    m = re.search(r'UHID\s+(\d+)', text)
    if m:
        info["Patient_UHID"] = m.group(1)

    m = re.search(r'COLLECTED DATE & TIME\s+([\d-]+)', text)
    if m:
        info["Collection_Date"] = m.group(1)

    return info

def extract_parameters_nirrh_port_blair(text):
    params = extract_by_mapping(
        text,
        nirrh_port_blair_mapping,
        default_strategy=value_last_standalone_near_label
    )

    m = re.search(
        r'Blood\s+Group\s+([ABO]{1,2})\b.*?Rh\s+Typing\s+(POSITIVE|NEGATIVE)',
        text,
        re.I | re.S,
    )

    if m:
        params["Blood_Group"] = f"{m.group(1)} Rh {'Positive' if m.group(2).upper()=='POSITIVE' else 'Negative'}"
    else:
        params["Blood_Group"] = None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# CENTRE: JSS MYSORE
# ══════════════════════════════════════════════════════════════════════════════

jss_mysore_mapping = {

    # CBC — note: JSS's PDF text reorders long rows in several different
    # ways (value can print before OR after the label, sometimes with a
    # methodology line wedged between the label and the value), so this
    # centre uses value_whole_line_near_label as its default strategy —
    # see extract_parameters_jss_mysore below.
    "Hb": r"\bHAEMOGLOBIN\s*\(HB\)",
    "PCV": r"PCV/HCT",
    "TRBC": r"\bRBC\s+COUNT\b",
    "MCV": r"\bMCV\b",
    "MCH": r"\bMCH\s*\(",
    "MCHC": r"\bMCHC\s*\(",
    "RDW": r"RDW\s*[-–−]?\s*CV",
    "TLC": r"TOTAL\s+LEUCOCYTE\s+COUNT",
    "Neutrophil": r"\bNeutrophils\b",
    "Lymphocyte": r"\bLymphocytes\b",
    "Monocyte": r"\bMonocytes\b",
    "Eosinophil": r"\bEosinophils\b",
    "Basophil": r"\bBasophils\b",
    "Platelet_Count": r"PLATELET\s+COUNT",
    "MPV": r"\bMPV\b",

    "Abs_Neutrophil": r"NEUTROPHILS#",
    "Abs_Lymphocyte": r"LYMPHOCYTES\s*\(ALC\)",
    "Abs_Monocyte": r"MONOCYTES\s*\(AMC\)",
    "Abs_Eosinophil": r"EOSINOPHILS\s*\(AEC\)",
    "Abs_Basophil": r"BASOPHILS\s*\(ABC\)",

    "Reticulocyte": r"RETICULOCYTE\s+COUNT",
    "ESR": r"\bESR\b",

    # Diabetes
    "Glucose_Fasting": r"PLASMA\s+GLUCOSE",
    "HbA1c": r"\bHbA1c\b",

    # Lipid
    "Total_Cholesterol": r"TOTAL\s+CHOLESTEROL",
    "HDL": r"HDL-CHOLESTEROL",
    "LDL": r"LDL\s*-\s*CHOLESTEROL",
    "Triglycerides": r"\bTRIGLYCERIDES\b",

    # Thyroid
    "TSH": r"\bTSH\b",
    "T3_Total": r"TOTAL\s+T3",
    "FT3": r"FREE\s+T3",
    "T4_Total": r"TOTAL\s+T4",
    "FT4": r"FREE\s+T4",
    "Anti_TPO": r"ANTI\s+TPO",
    "Anti_Thyroglobulin": r"ANTI-THYROGLOBULIN\s+ANTIBODY",

    # Liver
    "Bilirubin_Total": r"BILIRUBIN\s+TOTAL",
    "Bilirubin_Direct": r"BILIRUBIN\s+DIRECT",
    "Bilirubin_Indirect": r"INDIRECT\s+BILIRUBIN",
    "AST": r"\bAST\b(?!/ALT)",       # excludes the separate "AST/ALT RATIO" row
    "ALT": r"\bALT\b",
    "ALP": r"ALKALINE\s+PHOSPHATASE",
    "GGT": r"GAMMA\s+GT",
    "Total_Protein": r"TOTAL\s+PROTEINS",
    "Albumin": r"\bALBUMIN\b",
    "Globulin": r"\bGLOBULIN\b",

    # Renal
    "Urea": r"\bUREA\b",
    "Creatinine": r"\bCREATININE\b",
    "Uric_Acid": r"URIC\s+ACID",

    # Electrolytes
    "Sodium": r"\bSODIUM\b",
    "Potassium": r"\bPOTASSIUM\b",
    "Chloride": r"\bCHLORIDE\b",

    # Others
    "Calcium": r"\bCALCIUM\b",
    "Phosphorus": r"\bPHOSPHORUS\b",
    "Magnesium": r"\bMAGNESIUM\b",
    "Amylase": r"\bAMYLASE\b",
    "Lipase": r"\bLIPASE\b",
    "CRP": r"\bCRP\b",

    # Iron
    "Iron": r"\bIRON\b\s*[-–−]\s*\(SERUM\)",   # excludes "IRON & TOTAL IRON BINDING CAPACITY..." style headers
    "Ferritin": r"\bFERRITIN\b",
    "TIBC": r"\bTIBC\b",
    "TFR_Saturation": r"TRANSFERRIN\s+SATURATION",

    # Vitamins
    "Vitamin_B12": r"VITAMIN\s+B12",
    "Vitamin_D": r"VITAMIN\s+D\b(?!EFICIENCY)",
    "Folate": r"FOLIC\s+ACID",

    # Trace elements (from the attached outsourced Dr Lal PathLabs report)
    "Copper": r"COPPER,\s*SERUM",
    "Zinc": r"ZINC,\s*SERUM",
}


def extract_patient_info_jss_mysore(text):
    info = {}

    m = re.search(r'(\d+)\s*Y\s*/\s*(Male|Female)', text, re.I)
    if m:
        info["Age"] = m.group(1)
        info["Gender"] = m.group(2).title()

    # "Registration Number  : OT 9438040  Mrs ROOPA N ..." — stop before
    # the patient name that follows on the same extracted line.
    m = re.search(r'Registration\s+Number\s*:\s*([A-Z]{1,4}\s?\d+)', text)
    if m:
        info["Patient_UHID"] = m.group(1).strip()

    m = re.search(r'Requested\s+on\s*:\s*([\d-]+)', text)
    if m:
        info["Collection_Date"] = m.group(1)

    return info


def extract_parameters_jss_mysore(text):
    params = extract_by_mapping(text, jss_mysore_mapping, default_strategy=value_whole_line_near_label)

    m = re.search(
        r'BLOOD\s+GROUPING.*?([ABO]{1,2}\s+(?:Positive|Negative))',
        text,
        re.I | re.S,
    )
    params["Blood_Group"] = m.group(1) if m else None

    return params

# ══════════════════════════════════════════════════════════════════════════════
# 4g. CENTRE:  KIMS BHUBANESWAR
# ══════════════════════════════════════════════════════════════════════════════
#
# Bundled multi-report PDF per patient (own Central Lab Biochemistry +
# Haematology reports, plus an outsourced Metropolis Healthcare report for
# Copper). Several labels wrap across 2 lines before the value appears
# (HDL/LDL Cholesterol, TSH, Vitamin B12, Copper) — value_whole_line_near_label
# (lookahead=2) is used as the default strategy for the whole mapping so both
# same-line and wrapped-label rows resolve without per-field overrides.
# Uses SGOT/SGPT (not AST/ALT) and "GAMA GT" (their spelling) as printed labels.

kims_bhubaneswar_mapping = {
    # ── CBC (Haematology report) ────────────────────────────────────────────
    "Hb":               r'\bHAEMOGLOBIN\(',
    "PCV":              r'\bPCV\(',
    "TRBC":             r'\bRBC\s+COUNT\(',
    "MCV":              r'\bMCV\(',
    "MCH":              r'\bMCH\(',
    "MCHC":             r'\bMCHC\(',
    "RDW":              r'RDW-CV\(',
    "TLC":              r'WBC\s+COUNT\(',
    "Neutrophil":       r'\bNEUTROPHIL\(',
    "Lymphocyte":       r'\bLYMPHOCYTE\(',
    "Monocyte":         r'\bMONOCYTE\(',
    "Eosinophil":       r'\bEOSINOPHIL\(',
    "Basophil":         r'\bBASOPHIL\(',
    "Platelet_Count":   r'PLATELET\s+COUNT',
    "MPV":              r'\bMPV\(',
    "Abs_Neutrophil":   r'ABSOLUTE\s+NEUTROPHIL\s+COUNT',
    "Abs_Lymphocyte":   r'ABSOLUTE\s+LYMPHOCYTE\s+COUNT',
    "Abs_Monocyte":     r'ABSOLUTE\s+MONOCYTE\s+COUNT',
    "Abs_Eosinophil":   r'ABSOLUTE\s+EOSINOPHIL\s+COUNT',
    "Abs_Basophil":     r'ABSOLUTE\s+BASOPHIL\s+COUNT',
    "Reticulocyte":     r'RETICULOCYTE\s+COUNT',
    "ESR":              None,   # not present in reference sample — add regex if seen on another patient

    # ── Glucose / Diabetes ───────────────────────────────────────────────────
    "Glucose_Fasting":  r'FASTING\s+PLASMA\s+GLUCOSE',
    "HbA1c":            r'\bHbA1c\b',

    # ── Lipid Profile ─────────────────────────────────────────────────────────
    "Total_Cholesterol": r'SERUM\s+CHOLESTEROL\(',
    "HDL":              r'SERUM\s+HDL\s+CHOLESTEROL',
    "LDL":              r'SERUM\s+LDL\s+CHOLESTEROL',
    "Triglycerides":    r'SERUM\s+TRIGLYCERIDE',

    # ── Thyroid Profile ───────────────────────────────────────────────────────
    "TSH":              r'THYROID\s+STIMULATING\s+HORMONE',
    "T3_Total":         r'\bT3\b',                # standalone "T3" row — FT3's "T3" isn't \b-bounded, no collision
    "FT3":              r'\bFT3\b',
    "T4_Total":         r'TOTAL\s+T4\b',
    "FT4":              r'\bFT4\b',
    "Anti_TPO":         r'SERUM\s+ANTI\s+TPO',
    "Anti_Thyroglobulin": r'ANTI\s+THYROGLOBULIN\s+ANTIBODIES',

    # ── LFT (note: this centre prints SGOT/SGPT, not AST/ALT) ─────────────────
    "Bilirubin_Total":  r'SERUM\s+BILIRUBIN\(TOTAL\)',
    "Bilirubin_Direct": r'SERUM\s+BILIRUBIN\(DIRECT\)',
    "Bilirubin_Indirect": r'SERUM\s+BILIRUBIN\(INDIRECT\)',
    "AST":              r'SERUM\s+SGOT',
    "ALT":              r'SERUM\s+SGPT',
    "ALP":              r'SERUM\s+ALKALINE\s+PHOSPHATASE',
    "GGT":              r'SERUM\s+GAMA\s+GT',     # their spelling — not "GAMMA"
    "Total_Protein":    r'SERUM\s+TOTAL\s+PROTEIN',
    "Albumin":          r'SERUM\s+ALBUMIN',
    "Globulin":         r'SERUM\s+GLOBULIN',

    # ── KFT ───────────────────────────────────────────────────────────────────
    "Urea":             r'SERUM\s+UREA',
    "Creatinine":       r'SERUM\s+CREATININE',
    "Uric_Acid":        r'SERUM\s+URIC\s+ACID',

    # ── Electrolytes ──────────────────────────────────────────────────────────
    "Sodium":           r'SERUM\s+SODIUM',
    "Potassium":        r'SERUM\s+POTASSIUM',
    "Chloride":         r'SERUM\s+CHLORIDE',

    # ── Others ────────────────────────────────────────────────────────────────
    "Calcium":          r'SERUM\s+CALCIUM',
    "Phosphorus":       r'SERUM\s+PHOSPHORUS',
    "Magnesium":        r'\bMAGNESIUM\(',
    "Amylase":          r'SERUM\s+AMYLASE',
    "Lipase":           r'SERUM\s+LIPASE',
    "CRP":              r'CRP\s+QUANTITATIVE',

    # ── Iron Studies ──────────────────────────────────────────────────────────
    "Iron":             r'SERUM\s+IRON\(',
    "Ferritin":         r'\bFERRITIN\(',
    "TIBC":             r'SERUM\s+TIBC',
    "TFR_Saturation":   r'TRANSFERRIN\s+SATURATION',

    # ── Vitamins / trace elements ────────────────────────────────────────────
    "Vitamin_B12":      r'VITAMIN\s+B12',
    "Vitamin_D":        r'VITAMIN\s+D\s*\(',
    "Folate":           r'SERUM\s+FOLATE',
    "Copper":           r'Copper,\s*Serum',       # outsourced Metropolis report
    "Zinc":             r'SERUM\s+ZINC',
}


def extract_patient_info_kims_bhubaneswar(text):
    """Age / Gender (MRN is redacted in the reference sample — Record_ID and
    Name still come from the filename, same as every other centre)."""
    info = {}

    m = re.search(r'(\d+)\s*Y\s*/\s*(MALE|FEMALE)', text, re.I)
    if m:
        info["Age"] = m.group(1)
        info["Gender"] = m.group(2).title()

    return info


def extract_parameters_kims_bhubaneswar(text):
    params = extract_by_mapping(text, kims_bhubaneswar_mapping, default_strategy=value_whole_line_near_label)

    m = re.search(r'Blood\s+group[-\s]*([ABO]{1,2}\s*(?:Positive|Negative))', text, re.I)
    params['Blood_Group'] = m.group(1) if m else None

    return params


# ══════════════════════════════════════════════════════════════════════════════
# 4d. CENTRE:  P.D. HINDUJA — CSV-BASED (not OCR)
# ══════════════════════════════════════════════════════════════════════════════
#
# This centre supplies a structured CSV alongside each scanned PDF. The scan
# itself OCRs badly (faint watermark — see earlier notes), but the CSV is
# machine-readable and gives exact values, so we bypass PDF/OCR entirely for
# this centre and parse the CSV instead. Layout: col1=ANALYTES, col2=ABBR,
# col3=RESULTS, col4=UNIT, col5=REFERENCE VALUES. Section-header rows (e.g.
# "Kidney Function Test (KFT)") and sub-rows with no result (e.g. Peripheral
# Blood Smear) are skipped automatically since their RESULTS cell is empty.

PD_HINDUJA_ABBR_TO_FIELD = {
    "HB": "Hb", "PCV": "PCV", "TRBC": "TRBC", "MCV": "MCV", "MCH": "MCH", "MCHC": "MCHC",
    "RDW": "RDW", "TLC": "TLC", "N%": "Neutrophil", "L%": "Lymphocyte", "M%": "Monocyte",
    "E%": "Eosinophil", "B%": "Basophil", "PLT": "Platelet_Count", "MPV": "MPV",
    "NEUT#": "Abs_Neutrophil", "LYMPH#": "Abs_Lymphocyte", "MONO#": "Abs_Monocyte",
    "EO#": "Abs_Eosinophil", "BASO#": "Abs_Basophil", "RET%": "Reticulocyte",
    "GLU": "Glucose_Fasting", "HBA1C": "HbA1c",
    "U": "Urea", "CR": "Creatinine", "UA": "Uric_Acid",
    "TBIL": "Bilirubin_Total", "DBIL": "Bilirubin_Direct", "IBIL": "Bilirubin_Indirect",
    "ALT/SGPT": "ALT", "AST/SGOT": "AST", "ALP": "ALP", "TP": "Total_Protein", "ALB": "Albumin",
    "GGT": "GGT",
    "TCHOL": "Total_Cholesterol", "LDLC": "LDL", "HDLC": "HDL", "TG": "Triglycerides",
    "TSH": "TSH", "T3": "T3_Total", "FT3": "FT3", "T4": "T4_Total", "FT4": "FT4",
    "ATA": "Anti_Thyroglobulin", "TPO": "Anti_TPO",
    "NA+": "Sodium", "K+": "Potassium", "CL-": "Chloride",
    "AMY": "Amylase", "CA": "Calcium", "P": "Phosphorus", "LIPASE": "Lipase",
    "FE": "Iron", "FERR": "Ferritin",
    "TFR SATURATION": "TFR_Saturation", "TIBC": "TIBC", "VIT B12": "Vitamin_B12",
    "CRP": "CRP", "ESR": "ESR", "VIT D": "Vitamin_D",
    "CU": "Copper", "MG": "Magnesium", "ZN": "Zinc",
}

# Rows where ABBR is printed as "-" — matched by ANALYTES text instead.
PD_HINDUJA_ANALYTE_TO_FIELD = {
    "Folate": "Folate",
}

# Full standard field set for this centre, so every patient row has the same
# columns even when a field isn't in that particular report (e.g. Globulin
# isn't tested here at all).
PD_HINDUJA_ALL_FIELDS = sorted(set(PD_HINDUJA_ABBR_TO_FIELD.values()) |
                                set(PD_HINDUJA_ANALYTE_TO_FIELD.values()) |
                                {"Globulin", "Bilirubin_Indirect"})


def extract_pd_hinduja_csv(csv_bytes):
    """Parse the P.D. Hinduja CSV directly (no OCR). Returns (info, params)
    matching the shape extract_patient_info_X / extract_parameters_X give
    for every other centre."""
    text = csv_bytes.decode('utf-8-sig', errors='replace')
    rows = list(csv.reader(io.StringIO(text)))

    info = {}
    m = re.search(r'Age\s*:\s*(\d+)\s*Years?', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
    m = re.search(r'Gender\s*:\s*(Male|Female)', text, re.IGNORECASE)
    if m:
        info['Gender'] = m.group(1).capitalize()
    m = re.search(r'Sample\s+Collection\s+Date\s*:\s*([\d/.,\s]+?)(?:,|$)', text, re.IGNORECASE)
    if m:
        info['Collection_Date'] = m.group(1).strip()

    params = {field: None for field in PD_HINDUJA_ALL_FIELDS}
    abo, rh = None, None

    for row in rows:
        if len(row) < 4:
            continue
        analyte = row[1].strip()
        abbr = row[2].strip()
        result = row[3].strip()
        if not result:
            continue

        abbr_key = abbr.upper()
        if abbr_key in PD_HINDUJA_ABBR_TO_FIELD:
            params[PD_HINDUJA_ABBR_TO_FIELD[abbr_key]] = _clean_value(result)
        elif analyte in PD_HINDUJA_ANALYTE_TO_FIELD:
            params[PD_HINDUJA_ANALYTE_TO_FIELD[analyte]] = _clean_value(result)
        elif analyte == "ABO blood grouping":
            abo = result
        elif analyte == "Rh blood grouping":
            rh = result

    params['Blood_Group'] = f"{abo.upper()} Rh {rh.capitalize()}" if (abo and rh) else None
    return info, params

# ══════════════════════════════════════════════════════════════════════════════
# 4e. CENTRE:  KMC MANIPAL (Kasturba Hospital Laboratory Services)
# ══════════════════════════════════════════════════════════════════════════════
#
# Native text PDF, three sub-reports stapled together per patient:
#   1. Kasturba Hospital Lab Services — CBC + Biochemistry (bulk of the data)
#   2. A separate one-page Blood Group slip (different template)
#   3. Copper/Zinc outsourced to Dr Lal PathLabs (different template again,
#      same pattern as the outsourced Copper report seen at KIMS Bhubaneswar)
# Row layout is "LABEL  [(L)/(H) flag]  VALUE  UNIT  RANGE  METHOD", but long
# labels wrap onto 2-3 lines before the value — hence lookahead=2 below.

kmc_manipal_mapping = {
    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'HAEMOGLOBIN',
    "PCV":              r'HAEMATOCRIT',
    "TRBC":             r'RBC\s+COUNT',
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             r'\bMCHC\b',
    "RDW":              r'RDW[-\s]*CV',
    "TLC":              r'TOTAL\s+WBC',
    "Neutrophil":       r'\bNEUTROPHIL\b',
    "Lymphocyte":       r'\bLYMPHOCYTE\b',
    "Monocyte":         r'\bMONOCYTE\b',
    "Eosinophil":       r'\bEOSINOPHIL\b',
    "Basophil":         r'\bBASOPHIL\b',
    "Platelet_Count":   r'PLATELET\s+COUNT',
    "MPV":              r'\bMPV\b',
    "Abs_Neutrophil":   r'ABSOLUTE\s+NEUTROPHIL\s+COUNT',
    "Abs_Lymphocyte":   r'ABSOLUTE\s+LYMPHOCYTE\s+COUNT',
    "Abs_Monocyte":     None,   # not reported at this centre
    "Abs_Eosinophil":   r'ABSOLUTE\s+EOSINOPHIL\s+COUNT',
    "Abs_Basophil":     None,   # not reported at this centre
    "Reticulocyte":     r'RET\s*%',
    "ESR":              r'\bESR\b',

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'GLUCOSE\s+FASTING',
    "HbA1c":            r'HbA1C',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'\bTOTAL\s+CHOLESTEROL\b(?!/)',   # (?!/) skips the TC/HDL ratio row
    "HDL":              r'HIGH\s+DENSITY\s+LIPOPROTEIN\s+CHOLESTEROL',
    "LDL":              r'LOW\s+DENSITY\s+LIPOPROTEIN\s+CHOLESTEROL',
    "Triglycerides":    r'TRIGLYCERIDES',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              r'THYROID\s+STIMULATING\s+HORMONE',
    "T3_Total":         r'TRIIODOT\w*RONINE\s*\(T3\)',        # centre's own typo: "TRIIODOTYRONINE"
    "FT3":              r'FREE\s+TRIIODOTHYRONINE\s*-\s*FREE\s+T3',
    "T4_Total":         r'(?<!FREE\s)THYROXINE\s*\(T4\)',
    "FT4":              r'FREE\s+THYROXINE\s*-\s*FREE\s+T4',
    "Anti_TPO":         r'ANTI[-\s]*THYROID\s+PEROXIDASE',
    "Anti_Thyroglobulin": r'ANTI\s+THYROGLOBULIN\s+ANTIBODY',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'TOTAL\s+BILIRUBIN',
    "Bilirubin_Direct": r'DIRECT\s+BILIRUBIN',
    "Bilirubin_Indirect": None,   # not reported at this centre
    "AST":              r'ASPARTATE\s+TRANSAMINASE',
    "ALT":              r'ALANINE\s+TRANSAMINASE',
    "ALP":              r'ALKALINE\s+PHOSPHATASE',
    "GGT":              r'GAMMA\s+GLUTAMYLTRANSFERASE',
    "Total_Protein":    r'TOTAL\s+PROTEIN',
    "Albumin":          r'\bALBUMIN\b',
    "Globulin":         r'\bGLOBULIN\b',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'\bUREA\b',
    "Creatinine":       r'\bCREATININE\b',
    "Uric_Acid":        r'URIC\s+ACID',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'\bSODIUM\b',
    "Potassium":        r'\bPOTASSIUM\b',
    "Chloride":         r'\bCHLORIDE\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'\bCALCIUM\b',
    "Phosphorus":       r'PHOSPHOROUS',    # centre's own spelling
    "Magnesium":        r'\bMAGNESIUM\b',
    "Amylase":          r'\bAMYLASE\b',
    "Lipase":           r'\bLIPASE\b',
    "CRP":              r'C-REACTIVE\s+PROTEIN',

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             r'\bIRON\s*\(Serum\)',
    "Ferritin":         r'FERRITIN',
    "TIBC":             r'TOTAL\s+IRON\s+BINDING\s+CAPACITY',
    "TFR_Saturation":   None,   # not reported at this centre

    # ── Vitamins / trace elements ────────────────────────────────────────
    "Vitamin_B12":      r'VITAMIN\s+B12',
    "Vitamin_D":        r'VITAMIN\s+D\s*\(Serum\)',
    "Folate":           r'\bFOLATE\b',
    "Copper":           r'COPPER,\s*SERUM',      # outsourced Dr Lal PathLabs report
    "Zinc":             r'ZINC,\s*SERUM',         # outsourced Dr Lal PathLabs report
}


def extract_patient_info_kmc_manipal(text):
    """Age / Gender (Record_ID and Name come from the filename, same as
    every other centre)."""
    info = {}

    m = re.search(r'(\d+)\s*Year\(s\)\s*/\s*(Male|Female)', text, re.IGNORECASE)
    if m:
        info["Age"] = m.group(1)
        info["Gender"] = m.group(2).title()

    return info


def extract_parameters_kmc_manipal(text):
    """All standard parameters via the generic engine, plus Blood_Group
    (pulled from the separate Blood Group Report page, different template
    from the main lab report)."""
    params = extract_by_mapping(
        text, kmc_manipal_mapping,
        default_strategy=lambda t, p: value_whole_line_near_label(t, p, lookahead=2)
    )

    bg_m = re.search(r'Results\s*:\s*([ABO]{1,2})\s*Rh\s*\(D\)\s*(Positive|Negative)', text, re.IGNORECASE)
    params['Blood_Group'] = f"{bg_m.group(1).upper()} Rh {bg_m.group(2).capitalize()}" if bg_m else None

    return params

# ══════════════════════════════════════════════════════════════════════════════
# 4f. CENTRE:  DR B BOROOAH CANCER INSTITUTE, GUWAHATI (BCCI)
# ══════════════════════════════════════════════════════════════════════════════
#
# Native text PDF — bundle of up to 4 stapled sub-reports per patient:
#   1. BBCI's own Biochemistry report (lipids, LFT, KFT, electrolytes)
#   2. BBCI's own CBC report (separate glucose-only report sometimes too)
#   3. BBCI's own Peripheral Smear / Reticulocyte report
#   4. Outsourced Ekopath/Metropolis report (HbA1c, iron studies, ESR,
#      ferritin, thyroid panel, antibodies, vitamins, blood group, trace
#      elements) — labels here often wrap onto 2-3 lines before the value,
#      hence lookahead=4 below.
# Not every patient will have all 4 sub-reports (e.g. if a test wasn't
# ordered) — missing fields will correctly come back as None, not an error.

bcci_guwahati_mapping = {
    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'Serum\s+Cholesterol\b',
    "HDL":              r'Serum\s+HDL-Cholesterol',
    "LDL":              r'Serum\s+LDL-Cholesterol',
    "Triglycerides":    r'Serum\s+Triglycerides',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'Serum\s+Urea',
    "Uric_Acid":        r'Serum\s+Uric\s+Acid',
    "Creatinine":       r'Serum\s+Creatinine',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'Serum\s+Sodium',
    "Potassium":        r'Serum\s+Potassium',
    "Chloride":         r'Serum\s+Chlorides',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Total_Protein":    r'Serum\s+Protein',
    "Albumin":          r'Serum\s+Albumin',
    "Globulin":         r'Serum\s+Globulin',
    "ALP":              r'Serum\s+Alkaline\s+Phosphatase',
    "Bilirubin_Total":  r'Total\s+Bilirubin',
    "Bilirubin_Direct": r'Direct\s+Bilirubin',
    "Bilirubin_Indirect": r'Indirect\s+Bilirubin',
    "AST":              r'Serum\s+AST',
    "ALT":              r'Serum\s+ALT',
    "GGT":              r'Serum\s+Gamma\s+Glutamyl\s+Transferase',

    # ── Others (BBCI biochem page) ───────────────────────────────────────
    "Amylase":          r'Serum\s+Amylase',
    "Lipase":           r'Serum\s+Lipase',
    "Calcium":          r'Serum\s+Calcium',
    "Phosphorus":       r'Serum\s+Phosphorus',
    "Magnesium":        r'Serum\s+Magnesium',
    "Glucose_Fasting":  r'Fasting\s+Blood\s+Glucose',

    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'HAEMOGLOBIN',
    "TRBC":             r'RBC\s+COUNT',
    "PCV":              r'HAEMATOCRIT',
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             r'\bMCHC\b',
    "RDW":              r'\bRDW\b',
    "Platelet_Count":   r'PLATELETS\b',
    "MPV":              r'\bMPV\b',
    "TLC":              r'WBC\s+COUNT',
    "Neutrophil":       r'NEUTROPHIL\s*%',
    "Lymphocyte":       r'LYMPHOCYTE\s*%',
    "Monocyte":         r'MONOCYTE\s*%',
    "Eosinophil":       r'EOSINOPHIL\s*%',
    "Basophil":         r'BASOPHIL\s*%',
    "Abs_Neutrophil":   r'NEUTROPHIL\s+ABS',
    "Abs_Lymphocyte":   r'LYMPHOCYTE\s+ABS',
    "Abs_Monocyte":     r'MONOCYTE\s+ABS',
    "Abs_Eosinophil":   r'EOSINOPHIL\s+ABS',
    "Abs_Basophil":     r'BASOPHIL\s+ABS',
    "Reticulocyte":     r'Reticulocyte\s+Count',

    # ── Ekopath/Metropolis outsourced panel ─────────────────────────────
    "HbA1c":            r'HbA1c-\s*Glycated\s+Haemoglobin',
    "Iron":             r'Iron,\s*Serum',
    "TIBC":             r'\bTIBC\b',
    "TFR_Saturation":   r'Transfer\w*\s+Saturation',
    "CRP":              r'CRP\s*\(C\s+Reactive\s+Protein\)',
    "ESR":              r'ESR\s*\(Erythrocyte\s+Sedimentation\s+Rate\)',
    "Ferritin":         r'\bFerritin\b',
    "FT3":              r'FT3\s*\(Free\s+Triiodothyronine\)',
    "FT4":              r'FT4\s*\(Free\s+Thyroxine\)',
    "Anti_TPO":         r'Microsomal\s*\(TPO\)\s+Antibody',
    "Anti_Thyroglobulin": r'Thyroglobulin\s+antibody',
    "Vitamin_B12":      r'Vitamin\s+B12\s*\(Cyanocobalamin\)',
    "Vitamin_D":        r'Vitamin\s+D\s+Total\s*-\s*25\s+Hydroxy',
    "T3_Total":         r'T3\s*\(Total\s+Triiodothyronine\)',
    "T4_Total":         r'T4\s*\(Total\s+Thyroxine\)',
    "TSH":              r'TSH\s*\(Thyroid\s+Stimulating\s+Hormone\)',
    "Copper":           r'Copper,\s*Serum',
    "Zinc":             r'Zinc\s+by\s+ICPMS',
    "Folate":           r'Folic\s+Acid',
}


def extract_patient_info_bcci_guwahati(text):
    """Age / Gender. Prefers the clean Ekopath-report line
    ("Age / Gender : 23 Year(s)/ Male") when present; falls back to BBCI's
    own header ("M / 23 Years") for patients with only the BBCI sub-reports."""
    info = {}

    m = re.search(r'Age\s*/\s*Gender\s*:\s*(\d+)\s*Year\(s\)/\s*(Male|Female)', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = m.group(2).capitalize()
    else:
        m = re.search(r'\b([MF])\s*/\s*(\d+)\s*Years?\b', text)
        if m:
            info['Gender'] = 'Male' if m.group(1).upper() == 'M' else 'Female'
            info['Age'] = m.group(2)

    return info


def extract_parameters_bcci_guwahati(text):
    """All standard parameters via the generic engine (generous lookahead,
    since several Ekopath-panel labels wrap across 2-3 lines of method/
    technique text before the actual value), plus Blood_Group handled
    separately since it's two labelled fields, not one row."""
    params = extract_by_mapping(
        text, bcci_guwahati_mapping,
        default_strategy=lambda t, p: value_whole_line_near_label(t, p, lookahead=4)
    )

    abo_m = re.search(r'Blood\s+group\s*\(ABO\s+typing\)\s*([ABO]{1,2})', text, re.IGNORECASE)
    rh_m = re.search(r'RhD\s+factor\s*\(Rh\s+typing\)\s*(Positive|Negative)', text, re.IGNORECASE)
    params['Blood_Group'] = f"{abo_m.group(1).upper()} Rh {rh_m.group(1).capitalize()}" if (abo_m and rh_m) else None

    return params

# ══════════════════════════════════════════════════════════════════════════════
# 4d. CENTRE:  KGMU LUCKNOW  (via TATA 1MG Labs)
# ══════════════════════════════════════════════════════════════════════════════
# Clean text-layer reports (no OCR needed in the sample seen). Layout is a
# straightforward "Label  Value  Unit  Bio.Ref.Interval  Method" row per line,
# EXCEPT: (1) the TSH label wraps onto two lines before its value, and
# (2) the outsourced Copper (Metropolis) result has a 2-line method
# description wedged between the label and its value.

kgmu_lucknow_mapping = {
    # ── CBC ───────────────────────────────────────────────────────────────
    "Hb":               r'\bHemoglobin\b',
    "TRBC":             r'\bRBC\b',
    "PCV":              r'\bHCT\b',
    "MCV":              r'\bMCV\b',
    "MCH":              r'\bMCH\b(?!C)',
    "MCHC":             r'\bMCHC\b',
    "RDW":              r'RDW-CV',
    "TLC":              r'Total\s+Leucocyte\s+Count',
    "Neutrophil":       r'\bNeutrophils\b',
    "Lymphocyte":       r'\bLymphocytes\b',
    "Monocyte":         r'\bMonocytes\b',
    "Eosinophil":       r'\bEosinophils\b',
    "Basophil":         r'\bBasophils\b',
    "Abs_Neutrophil":   r'Absolute\s+Neutrophil\s+Count',
    "Abs_Lymphocyte":   r'Absolute\s+Lymphocyte\s+Count',
    "Abs_Monocyte":     r'Absolute\s+Monocyte\s+Count',
    "Abs_Eosinophil":   r'Absolute\s+Eosinophil\s+Count',
    "Abs_Basophil":     r'Absolute\s+Basophil\s+Count',
    "Platelet_Count":   r'Platelet\s+Count',
    "MPV":              r'\bMPV\b',
    "Reticulocyte":     r'Reticulocyte\s+Count',
    "ESR":              r'Erythrocyte\s+Sedimentation\s+Rate',

    # ── Glucose / Diabetes ───────────────────────────────────────────────
    "Glucose_Fasting":  r'Glucose\s*-\s*Fasting',
    "HbA1c":            r'Glycosylated\s+Hemoglobin\s*\(HbA1c\)',

    # ── Lipid Profile ─────────────────────────────────────────────────────
    "Total_Cholesterol": r'Cholesterol\s*-\s*Total',
    "HDL":              r'Cholesterol\s*-\s*HDL',
    "LDL":              r'Cholesterol\s*-\s*LDL',
    "Triglycerides":    r'\bTriglycerides\b',

    # ── Thyroid Profile ───────────────────────────────────────────────────
    "TSH":              (r'Thyroid\s+Stimulating\s+Hormone', same_or_next_line_value),
    "T3_Total":         r'T3,\s*Total',
    "FT3":              r'Free\s+T3',
    "T4_Total":         r'T4,\s*Total',
    "FT4":              r'Free\s+T4',
    "Anti_TPO":         r'Anti-Thyroid\s+Peroxidase',
    "Anti_Thyroglobulin": r'Anti\s+Thyroglobulin\s+Antibody',

    # ── LFT ───────────────────────────────────────────────────────────────
    "Bilirubin_Total":  r'Bilirubin-Total',
    "Bilirubin_Direct": r'Bilirubin-Direct',
    "Bilirubin_Indirect": r'Bilirubin-Indirect',
    "AST":              r'SGOT\s*\(Aspartate\s+Aminotransferase\)',
    "ALT":              r'SGPT\s*\(Alanine\s+Transaminase\)',
    "ALP":              r'Alkaline\s+Phosphatase',
    "GGT":              r'Gamma\s+Glutamyltransferase',
    "Total_Protein":    r'Protein,\s*Total',
    "Albumin":          r'\bAlbumin\b',
    "Globulin":         r'\bGlobulin\b',

    # ── KFT ───────────────────────────────────────────────────────────────
    "Urea":             r'\bUrea\b(?!\s+Nitrogen)',
    "Creatinine":       r'(?<!/)Creatinine(?!\s*Ratio)',
    "Uric_Acid":        r'Uric\s+Acid',

    # ── Electrolytes ──────────────────────────────────────────────────────
    "Sodium":           r'\bSodium\b',
    "Potassium":        r'\bPotassium\b',
    "Chloride":         r'\bChloride\b',

    # ── Others ────────────────────────────────────────────────────────────
    "Calcium":          r'\bCalcium\b',
    "Phosphorus":       r'\bPhosphorus\b',
    "Magnesium":        r'\bMagnesium\b',
    "Amylase":          r'\bAmylase\b',
    "Lipase":           r'\bLipase\b',
    "CRP":              r'C-Reactive\s+Protein',

    # ── Iron Studies ──────────────────────────────────────────────────────
    "Iron":             r'Iron\s+Serum',
    "Ferritin":         r'\bFerritin\b',
    "TIBC":             r'Total\s+Iron\s+Binding\s+Capacity',
    "TFR_Saturation":   r'Transferrin\s+Saturation',

    # ── Additional ────────────────────────────────────────────────────────
    "Vitamin_B12":      r'Vitamin\s+B12\b',
    "Vitamin_D":        r'Vitamin\s+D\s*\(25-OH\)',
    "Folate":           r'Vitamin\s+B9\s*\(Folic\s+Acid\)',
    "Copper":           (r'Copper,\s*Serum', lambda t, p: value_whole_line_near_label(t, p, lookahead=4)),
    "Zinc":             r'Zinc,?\s*Serum',
}


def extract_patient_info_kgmu_lucknow(text):
    """Age / Gender / Collection date / lab's own visit ID (Record_ID and
    Name come from the filename, not from here)."""
    info = {}

    m = re.search(r'Age/Gender\s*:\s*(\d+)Y.*?/\s*(Male|Female)', text, re.IGNORECASE)
    if m:
        info['Age'] = m.group(1)
        info['Gender'] = m.group(2).capitalize()

    m = re.search(r'Collection\s+Date\s*:\s*(\d{2}/\w{3}/\d{4})', text, re.IGNORECASE)
    if m:
        info['Collection_Date'] = m.group(1).strip()

    m = re.search(r'Lab\s+Visit\s+ID\s*:\s*(\S+)', text, re.IGNORECASE)
    if m:
        info['Patient_UID'] = m.group(1).strip()

    return info


def extract_parameters_kgmu_lucknow(text):
    """All standard parameters for KGMU Lucknow via the generic engine,
    plus Blood_Group (two separately-labelled fields, not one row)."""
    params = extract_by_mapping(text, kgmu_lucknow_mapping, default_strategy=same_line_value)

    abo_m = re.search(r'Blood\s+Group\s*\(ABO\s+typing\)\s*([ABO]{1,2})\b', text, re.IGNORECASE)
    rh_m = re.search(r'Rh\s+Factor\s*\n?\s*(Positive|Negative)', text, re.IGNORECASE)
    params['Blood_Group'] = f"{abo_m.group(1).upper()} Rh {rh_m.group(1).capitalize()}" if (abo_m and rh_m) else None

    return params

CENTRE_REGISTRY = {
    "aiims_bathinda": (extract_patient_info_aiims_bathinda, extract_parameters_aiims_bathinda),
    "aiims_bhopal":   (extract_patient_info_aiims_bhopal, extract_parameters_aiims_bhopal),
    "aiims_delhi":    (extract_patient_info_aiims_delhi, extract_parameters_aiims_delhi),
    "aiims_jodhpur":  (extract_patient_info_aiims_jodhpur, extract_parameters_aiims_jodhpur),
    "aiims_kalyani":  (extract_patient_info_aiims_kalyani, extract_parameters_aiims_kalyani),
    "aiims_raipur":   (extract_patient_info_aiims_raipur, extract_parameters_aiims_raipur),
    "nirrh_port_blair": (extract_patient_info_nirrh_port_blair,extract_parameters_nirrh_port_blair,),
    "jss_mysore": (extract_patient_info_jss_mysore, extract_parameters_jss_mysore),
    "kims_bhubaneswar": (extract_patient_info_kims_bhubaneswar, extract_parameters_kims_bhubaneswar),
    "kmc_manipal": (extract_patient_info_kmc_manipal, extract_parameters_kmc_manipal),
    "bcci_guwahati": (extract_patient_info_bcci_guwahati, extract_parameters_bcci_guwahati),
    "kgmu_lucknow": (extract_patient_info_kgmu_lucknow, extract_parameters_kgmu_lucknow),
}


# ══════════════════════════════════════════════════════════════════════════════
# 4c. PARALLEL WORKER  (top-level + picklable, required for ProcessPoolExecutor,
#     especially on Windows where "spawn" needs everything importable by name)
# ══════════════════════════════════════════════════════════════════════════════

def process_single_pdf(file_name, pdf_bytes, centre_key):
    """
    Run the full per-file pipeline (filename parse -> text extraction ->
    field extraction) for ONE PDF, given its raw bytes already in memory.
    Designed to be handed to a multiprocessing worker: takes/returns only
    plain picklable types (str / bytes / dict), no Drive service, no file
    handles.

    Returns: {'status': 'ok', 'row': {...}} or {'status': 'error', 'error': str}
    """
    try:
        info_fn, params_fn = CENTRE_REGISTRY[centre_key]
        record_id, participant_name = parse_filename(file_name)
        buffer = io.BytesIO(pdf_bytes)
        text = extract_text_from_pdf(buffer)
        info = info_fn(text)
        params = params_fn(text)
        row = {'Record_ID': record_id, 'Name': participant_name, **info, **params}
        return {'status': 'ok', 'row': row}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def process_single_csv_pd_hinduja(file_name, csv_bytes):
    """CSV-based equivalent of process_single_pdf, for P.D. Hinduja only.
    Same return contract, so it drops straight into the existing
    ProcessPoolExecutor / result-handling code in main_pipeline.py."""
    try:
        record_id, participant_name = parse_filename(file_name)
        info, params = extract_pd_hinduja_csv(csv_bytes)
        row = {'Record_ID': record_id, 'Name': participant_name, **info, **params}
        return {'status': 'ok', 'row': row}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

# ══════════════════════════════════════════════════════════════════════════════
# 5. CLI — debug a local PDF
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_path> [centre]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    centre = sys.argv[2] if len(sys.argv) > 2 else "aiims_bathinda"

    record_id, name = parse_filename(pdf_path)
    print(f"Record_ID: {record_id}   Name: {name}")

    with open(pdf_path, "rb") as f:
        buffer = io.BytesIO(f.read())
    text = extract_text_from_pdf(buffer)

    info_fn, params_fn = CENTRE_REGISTRY[centre]
    info = info_fn(text)
    params = params_fn(text)

    print("\n--- PATIENT INFO ---")
    for k, v in info.items():
        print(f"  {k}: {v}")

    found = {k: v for k, v in params.items() if v is not None}
    missing = [k for k, v in params.items() if v is None]

    print("\n--- FOUND PARAMETERS ---")
    for k, v in found.items():
        print(f"  {k}: {v}")

    print("\n--- MISSING PARAMETERS ---")
    for k in missing:
        print(f"  {k}")

    print(f"\nSummary: {len(found)} found, {len(missing)} missing out of {len(params)} total")