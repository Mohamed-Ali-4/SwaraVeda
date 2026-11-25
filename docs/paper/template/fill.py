"""Pour the captured paper content into the NCDTE conference template (template's own XML formatting)."""
import json
import re
import shutil
import sys
from xml.sax.saxutils import escape

SRC_DIR, CONTENT, FIGURE = sys.argv[1], sys.argv[2], sys.argv[3]
doc = json.load(open(CONTENT))
front, body = doc["o"]["sections"][0]["children"], doc["o"]["sections"][1]["children"]

FONT = '<w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8}
SECTION_NAMES = {"Related Work": "Literature Review"}


def renumber(t):
    """Cross-references in the template's arabic numbering."""
    t = re.sub(r"\b(Sections?) (VIII|VII|VI|IV|V|III|II|I)\b(?: and (VIII|VII|VI|IV|V|III|II|I)\b)?",
               lambda m: f"{m.group(1)} {ROMAN[m.group(2)]}" + (f" and {ROMAN[m.group(3)]}" if m.group(3) else ""), t)
    t = re.sub(r"\bFig\. (\d+)", r"Figure \1", t)
    t = re.sub(r"\bTable I\b", "Table 1", t)
    return t


def rpr(size=24, b=False, i=False, sub=False, sup=False, color=True):
    return ("<w:rPr>" + FONT + ("<w:b/>" if b else "") + ("<w:i/>" if i else "") + ('<w:color w:val="000000"/>' if color else "")
            + f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
            + ('<w:vertAlign w:val="subscript"/>' if sub else '<w:vertAlign w:val="superscript"/>' if sup else "") + "</w:rPr>")


def run(text, size=24, b=False, i=False, sub=False, sup=False):
    parts = text.split("\t")
    out = []
    for k, p in enumerate(parts):
        if k:
            out.append(f"<w:r>{rpr(size, b, i)}<w:tab/></w:r>")
        if p:
            out.append(f'<w:r>{rpr(size, b, i, sub, sup)}<w:t xml:space="preserve">{escape(p)}</w:t></w:r>')
    return "".join(out)


def runs_of(par, size=24, bold_all=False, drop_first_tab=False):
    out = []
    for c in par["o"].get("children", []):
        if c["type"] != "TextRun":
            continue
        o = c["o"]
        text = renumber(o.get("text", ""))
        if drop_first_tab and text == "\t":
            drop_first_tab = False
            continue
        out.append(run(text, size, b=bold_all or bool(o.get("bold")), i=bool(o.get("italics")),
                       sub=bool(o.get("subScript")), sup=bool(o.get("superScript"))))
    return "".join(out)


def text_of(par):
    return "".join(c["o"].get("text", "") for c in par["o"].get("children", []) if c["type"] == "TextRun")


def para(content, jc="both", before=120, after=120, ind="", extra=""):
    return (f'<w:p><w:pPr>{extra}<w:spacing w:before="{before}" w:after="{after}" w:line="240" w:lineRule="auto"/>{ind}'
            f'<w:jc w:val="{jc}"/></w:pPr>{content}</w:p>')


BODY_IND = '<w:ind w:firstLine="624"/>'  # 1.1 cm first-line indent, as the template asks


def heading(text):
    return ('<w:p><w:pPr><w:keepNext/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>'
            '<w:spacing w:before="240" w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:left="357" w:hanging="357"/>'
            f'<w:jc w:val="both"/>{rpr(24, b=True)}</w:pPr>{run(text, 24, b=True)}</w:p>')


def plain_heading(text):
    return para(run(text, 24, b=True), before=240, extra="<w:keepNext/>")


def caption(label, text):
    return ('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="200" w:after="100"/><w:jc w:val="center"/></w:pPr>'
            + run(label, 22, b=True) + run(" " + text, 22) + "</w:p>")


def picture():
    shutil.copy(FIGURE, f"{SRC_DIR}/word/media/image1.png")
    cx = 5400000
    from PIL import Image
    fw, fh = Image.open(FIGURE).size
    cy = int(cx * fh / fw)
    p = open(f"{SRC_DIR}/word/document.xml").read()
    m = re.search(r"<w:p [^>]*>(?:(?!</w:p>).)*?<w:drawing>.*?</w:p>", p, re.S)
    x = m.group(0)
    x = re.sub(r'<wp:extent cx="\d+" cy="\d+"/>', f'<wp:extent cx="{cx}" cy="{cy}"/>', x)
    x = re.sub(r'<a:ext cx="\d+" cy="\d+"/>', f'<a:ext cx="{cx}" cy="{cy}"/>', x)
    x = re.sub(r'<wp:docPr id="2" name="Picture 2"/>', '<wp:docPr id="2" name="Figure 1" descr="Architectural context diagram of SwaraVeda"/>', x)
    return x


BORDER = '<w:{s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>'


def table(rows, widths, header=True):
    total = sum(widths)
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    borders = "".join(BORDER.format(s=s) for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
    out = [f'<w:tbl><w:tblPr><w:tblW w:w="{total}" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders>{borders}</w:tblBorders>'
           f'<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>{grid}</w:tblGrid>']
    for r_i, row in enumerate(rows):
        out.append("<w:tr>" + ('<w:trPr><w:tblHeader/></w:trPr>' if header and r_i == 0 else ""))
        for c_i, cell in enumerate(row):
            out.append(f'<w:tc><w:tcPr><w:tcW w:w="{widths[c_i]}" w:type="dxa"/></w:tcPr>'
                       + para(cell if cell.startswith("<w:r>") else run(cell, 22, b=header and r_i == 0), jc="left", before=40, after=40)
                       + "</w:tc>")
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out)


def algorithm(cell_pars):
    lines = []
    for k, p in enumerate(cell_pars):
        content = runs_of(p, 22)
        ind = '<w:ind w:left="360"/>' if re.match(r"^\d: ", text_of(p)) and "    " in text_of(p) else ""
        border = '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="000000"/></w:pBdr>' if k == 0 else ""
        lines.append(para(content, jc="left", before=20, after=20, ind=ind, extra=border))
    borders = BORDER.format(s="top") + BORDER.format(s="bottom")
    return (f'<w:tbl><w:tblPr><w:tblW w:w="9072" w:type="dxa"/><w:tblBorders>{borders}</w:tblBorders></w:tblPr>'
            f'<w:tblGrid><w:gridCol w:w="9072"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="9072" w:type="dxa"/></w:tcPr>'
            + "".join(lines) + "</w:tc></w:tr></w:tbl>" + para("", before=0, after=0))


# ---- front matter
title = text_of(front[0])
out = [para(run(title, 28, b=True), jc="center", before=0, after=240)]
names = [("Laksh Yadav", "1"), ("Mikul Swamy", "1"), ("Mohamad Aashim", "1"), ("Mohamed Ali", "1*"), ("Priyanka K R", "2")]
line = []
for k, (n, sup) in enumerate(names):
    line.append(run(("" if k == 0 else ", ") + n, 24) + run(sup, 24, sup=True))
out.append(para("".join(line), jc="center", before=0, after=60))
dept = "Department of Computer Science and Engineering, RV Institute of Technology and Management, Bengaluru, Karnataka, India"
out.append(para(run("1", 22, i=True, sup=True) + run("Student, " + dept, 22, i=True), jc="center", before=0, after=0))
out.append(para(run("2", 22, i=True, sup=True) + run("Assistant Professor, " + dept, 22, i=True), jc="center", before=0, after=0))
out.append(para(run("mohamedali04123@gmail.com*", 22, i=True), jc="center", before=0, after=240))

# ---- body
refs = False
ref_out = []
i = 0
sub_no = 0
sec_no = 0
while i < len(body):
    el = body[i]
    t = el["type"]
    if t == "Table":
        rows = el["o"]["rows"]
        cells = [[c["o"]["children"] for c in r["o"]["children"]] for r in rows]
        if len(rows) == 1 and len(cells[0]) == 1:
            out.append(algorithm(cells[0][0]))
        else:
            data = [[text_of(c[0]) for c in r] for r in cells]
            out.append(table([[renumber(x) for x in r] for r in data], [3000, 6072]))
            out.append(para("", before=0, after=0))
        i += 1
        continue
    kids = el["o"].get("children", [])
    txt = text_of(el)
    first = kids[0]["o"] if kids and kids[0]["type"] == "TextRun" else {}
    if any(k["type"] == "ImageRun" for k in kids):
        out.append(picture())
    elif not txt.strip():
        pass
    elif txt.startswith("Abstract"):
        out.append(para(run("Abstract:", 24, b=True, i=True) + run(" " + txt.split(":", 1)[1].strip(), 24), before=0, after=120))
    elif txt.startswith("Index Terms"):
        out.append(para(run("Keywords:", 24, b=True, i=True) + run(" " + txt.split(":", 1)[1].strip(), 24), before=0, after=240))
    elif first.get("smallCaps") and re.match(r"^(VIII|VII|VI|IV|V|III|II|I)\. $", first.get("text", "")):
        name = txt.split(". ", 1)[1].strip()
        out.append(heading(SECTION_NAMES.get(name, name)))
        sec_no += 1
        sub_no = 0
    elif first.get("smallCaps") and txt in ("Acknowledgment", "References"):
        out.append(plain_heading(txt))
        refs = txt == "References"
    elif first.get("smallCaps") and txt.startswith("TABLE "):
        label = txt.split()[1]
        nxt = text_of(body[i + 1])
        out.append(caption(f"Table {ROMAN.get(label, label)}.", nxt[0] + nxt[1:].lower()))
        i += 2
        continue
    elif first.get("italics") and len(kids) == 1 and re.match(r"^[A-H]\. ", txt):
        sub_no += 1
        out.append(para(run(f"{sec_no}.{sub_no} " + txt[3:], 24, b=True, i=True), before=180, after=60, extra="<w:keepNext/>"))
    elif el["o"].get("numbering"):
        roman = ["i", "ii", "iii", "iv", "v", "vi"][sum(1 for x in out if 'w:hanging="397"' in x)]
        out.append(para(run(f"({roman})\t", 24) + runs_of(el), ind='<w:ind w:left="397" w:hanging="397"/>', before=40, after=40,
                        extra='<w:tabs><w:tab w:val="left" w:pos="397"/></w:tabs>'))
    elif txt.startswith("\t") and re.search(r"\(\d\)$", txt):
        out.append('<w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="4536"/><w:tab w:val="right" w:pos="9072"/></w:tabs>'
                   '<w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/></w:pPr>' + runs_of(el) + "</w:p>")
    elif txt.startswith("Fig. "):
        num, rest = re.match(r"Fig\. (\d+)\. (.*)", txt).groups()
        out.append(caption(f"Figure {num}.", rest))
    elif refs and re.match(r"^\[\d+\]", txt):
        ref_out.append('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="4"/></w:numPr>'
                       '<w:spacing w:after="60"/><w:jc w:val="both"/></w:pPr>'
                       + runs_of({"o": {"children": kids[1:]}}, 24, drop_first_tab=True) + "</w:p>")
    else:
        indent = BODY_IND if el["o"].get("indent") else ""
        out.append(para(runs_of(el), ind=indent, extra="<w:keepNext/>" if txt.rstrip().endswith(":") else ""))
    i += 1
out += ref_out

src = open(f"{SRC_DIR}/word/document.xml").read()
a = src.index("<w:body>") + len("<w:body>")
b = src.index("<w:sectPr")
open(f"{SRC_DIR}/word/document.xml", "w").write(src[:a] + "".join(out) + src[b:])
print("paragraph blocks:", len(out), "references:", len(ref_out))
