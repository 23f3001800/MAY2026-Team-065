"""A minimal PDF writer, enough for a one-page acknowledgement slip.

Why not a library: the slip is text and rules on a single page. reportlab and
weasyprint are large dependencies (weasyprint pulls a rendering stack), and the
PDF written here uses only the base-14 fonts, which every reader has built in --
so nothing needs embedding and the output is a few kilobytes.

The trade-off is real and worth stating: this handles text, lines and Latin-1
characters. It has no images, no tables, no wrapping across pages, and no
Unicode beyond Latin-1. If the slip ever needs a logo, a map thumbnail or Indian
language text, replace this with a real library rather than growing it -- the
next feature after those is font embedding, and that is where hand-rolling
stops being sensible.

Layout is in PDF points: 1 pt = 1/72 inch, origin at the BOTTOM-left, so y
decreases down the page.
"""

from __future__ import annotations

import zlib
from typing import List, Optional, Tuple

# A4 in points.
PAGE_WIDTH = 595.28
PAGE_HEIGHT = 841.89

MARGIN = 56.0
LINE_HEIGHT = 14.0

# Widths of the base-14 Helvetica glyphs, in 1/1000 em. Only what is needed to
# wrap text without overshooting the margin; anything unlisted falls back to an
# average, which errs slightly wide and so wraps early rather than late.
_AVG_WIDTH = 500
_WIDTHS = {
    " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
    "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
    "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
    "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
    "@": 1015, "[": 278, "\\": 278, "]": 278, "^": 469, "_": 556, "`": 333,
    "{": 334, "|": 260, "}": 334, "~": 584,
    "A": 667, "B": 667, "C": 722, "D": 722, "E": 667, "F": 611, "G": 778, "H": 722,
    "I": 278, "J": 500, "K": 667, "L": 556, "M": 833, "N": 722, "O": 778, "P": 667,
    "Q": 778, "R": 722, "S": 667, "T": 611, "U": 722, "V": 667, "W": 944, "X": 667,
    "Y": 667, "Z": 611,
    "a": 556, "b": 556, "c": 500, "d": 556, "e": 556, "f": 278, "g": 556, "h": 556,
    "i": 222, "j": 222, "k": 500, "l": 222, "m": 833, "n": 556, "o": 556, "p": 556,
    "q": 556, "r": 333, "s": 500, "t": 278, "u": 556, "v": 500, "w": 722, "x": 500,
    "y": 500, "z": 500,
}


def text_width(text: str, size: float) -> float:
    """Width of a string in points at the given size."""
    total = sum(_WIDTHS.get(ch, _AVG_WIDTH) for ch in text)
    return total * size / 1000.0


def wrap(text: str, size: float, max_width: float) -> List[str]:
    """Greedy word wrap. A single word longer than the line is broken by character."""
    lines: List[str] = []
    for paragraph in (text or "").splitlines() or [""]:
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = ""
        for word in words:
            candidate = word if not current else current + " " + word
            if text_width(candidate, size) <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current)
            # A URL or a long id can exceed the line on its own.
            while text_width(word, size) > max_width:
                cut = len(word)
                while cut > 1 and text_width(word[:cut], size) > max_width:
                    cut -= 1
                lines.append(word[:cut])
                word = word[cut:]
            current = word
        if current:
            lines.append(current)
    return lines


def _escape(text: str) -> bytes:
    """Escape for a PDF literal string, and drop what Latin-1 cannot carry.

    Characters outside Latin-1 are replaced rather than raising: a slip that
    prints with a '?' where an em dash was is far better than a 500 on download.
    """
    encoded = (text or "").encode("latin-1", "replace")
    out = bytearray()
    for byte in encoded:
        if byte in (0x28, 0x29, 0x5C):  # ( ) \
            out.append(0x5C)
        out.append(byte)
    return bytes(out)


class Page:
    """Accumulates drawing operations for one page."""

    def __init__(self) -> None:
        self.ops: List[bytes] = []

    def text(self, x: float, y: float, value: str, *, size: float = 10.0,
             bold: bool = False, gray: Optional[float] = None) -> None:
        font = "F2" if bold else "F1"
        parts = [b"BT"]
        if gray is not None:
            parts.append(("%.3f g" % gray).encode("ascii"))
        parts.append(("/%s %.2f Tf" % (font, size)).encode("ascii"))
        parts.append(("%.2f %.2f Td" % (x, y)).encode("ascii"))
        parts.append(b"(" + _escape(value) + b") Tj")
        parts.append(b"ET")
        if gray is not None:
            parts.append(b"0 g")
        self.ops.append(b"\n".join(parts))

    def line(self, x1: float, y1: float, x2: float, y2: float,
             *, width: float = 0.5, gray: float = 0.8) -> None:
        self.ops.append(
            ("%.3f G %.2f w %.2f %.2f m %.2f %.2f l S 0 G"
             % (gray, width, x1, y1, x2, y2)).encode("ascii")
        )

    def rect(self, x: float, y: float, w: float, h: float, *, gray: float = 0.95) -> None:
        self.ops.append(
            ("%.3f g %.2f %.2f %.2f %.2f re f 0 g" % (gray, x, y, w, h)).encode("ascii")
        )

    def content(self) -> bytes:
        return b"\n".join(self.ops)


def build(pages: List[Page], *, title: str = "") -> bytes:
    """Assemble pages into a PDF file.

    Objects are written in order and their byte offsets recorded for the xref
    table, which is what makes the file navigable. Content streams are
    Flate-compressed -- a slip drops from a few KB to under one.
    """
    objects: List[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)  # object numbers are 1-based

    font_regular = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
                       b"/Encoding /WinAnsiEncoding >>")
    font_bold = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold "
                    b"/Encoding /WinAnsiEncoding >>")

    # Reserve the pages-tree number now so each page can point at its parent.
    #
    # Each page adds exactly two objects (its content stream, then the page
    # itself), and the tree is written straight after them. Object numbers are
    # 1-based, so the tree's number is the count after the loop, plus one.
    pages_obj = len(objects) + 2 * len(pages) + 1

    page_ids: List[int] = []
    for page in pages:
        stream = zlib.compress(page.content())
        content_id = add(
            b"<< /Length " + str(len(stream)).encode("ascii") + b" /Filter /FlateDecode >>\n"
            b"stream\n" + stream + b"\nendstream"
        )
        page_id = add(
            ("<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f] "
             "/Resources << /Font << /F1 %d 0 R /F2 %d 0 R >> >> "
             "/Contents %d 0 R >>"
             % (pages_obj, PAGE_WIDTH, PAGE_HEIGHT, font_regular, font_bold, content_id)
             ).encode("ascii")
        )
        page_ids.append(page_id)

    kids = " ".join("%d 0 R" % pid for pid in page_ids)
    actual_pages_obj = add(
        ("<< /Type /Pages /Count %d /Kids [%s] >>" % (len(page_ids), kids)).encode("ascii")
    )
    assert actual_pages_obj == pages_obj, "page tree object number mismatch"

    info_id = add(b"<< /Title (" + _escape(title) + b") /Producer (Smart Civic Connect) >>")
    catalog_id = add(("<< /Type /Catalog /Pages %d 0 R >>" % pages_obj).encode("ascii"))

    out = bytearray(b"%PDF-1.4\n")
    # A binary comment marks the file as binary for tools that sniff content.
    out += b"%\xe2\xe3\xcf\xd3\n"

    offsets: List[int] = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(number).encode("ascii") + b" 0 obj\n" + body + b"\nendobj\n"

    xref_at = len(out)
    out += b"xref\n0 " + str(len(objects) + 1).encode("ascii") + b"\n"
    out += b"0000000000 65535 f \n"
    for offset in offsets:
        out += ("%010d 00000 n \n" % offset).encode("ascii")

    out += (
        b"trailer\n<< /Size " + str(len(objects) + 1).encode("ascii")
        + b" /Root " + str(catalog_id).encode("ascii") + b" 0 R"
        + b" /Info " + str(info_id).encode("ascii") + b" 0 R >>\n"
        b"startxref\n" + str(xref_at).encode("ascii") + b"\n%%EOF\n"
    )
    return bytes(out)


# -- slip layout ---------------------------------------------------------

class Cursor:
    """Tracks the vertical position while writing a page top-down."""

    def __init__(self, page: Page, y: float):
        self.page = page
        self.y = y

    def down(self, amount: float = LINE_HEIGHT) -> None:
        self.y -= amount

    def heading(self, text: str, size: float = 11.0) -> None:
        self.down(8)
        self.page.text(MARGIN, self.y, text.upper(), size=size, bold=True, gray=0.35)
        self.down(4)
        self.page.line(MARGIN, self.y, PAGE_WIDTH - MARGIN, self.y)
        self.down(12)

    def field(self, label: str, value: str, *, width: float = 150.0) -> None:
        """One label/value row, the value wrapped inside the remaining width."""
        self.page.text(MARGIN, self.y, label, size=9, gray=0.45)
        available = PAGE_WIDTH - MARGIN - (MARGIN + width)
        lines = wrap(str(value) if value not in (None, "") else "-", 10, available)
        for i, line in enumerate(lines):
            if i:
                self.down()
            self.page.text(MARGIN + width, self.y, line, size=10)
        self.down(LINE_HEIGHT + 2)
