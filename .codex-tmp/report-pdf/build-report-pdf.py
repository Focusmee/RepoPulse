from pathlib import Path
import re
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

REPO_ROOT = Path("D:/Projects/RepoPulse")
REPORT_PATH = REPO_ROOT / "reports/2026/2026-05-18-ai-builder.md"
OUTPUT_DIR = REPO_ROOT / "outputs/repopulse-report-2026-05-18"
OUTPUT_PATH = OUTPUT_DIR / "RepoPulse_AI_Builder_Daily_2026-05-18.pdf"

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

PALETTE = {
    "ink": colors.HexColor("#172033"),
    "muted": colors.HexColor("#64748B"),
    "line": colors.HexColor("#DCE7F3"),
    "soft": colors.HexColor("#F8FAFC"),
    "deep": colors.HexColor("#0F766E"),
    "watch": colors.HexColor("#2563EB"),
    "idea": colors.HexColor("#9333EA"),
    "caution": colors.HexColor("#B45309"),
    "dark": colors.HexColor("#111827"),
    "warn_bg": colors.HexColor("#FFFBEB"),
}

SECTION_TONES = {
    "今日最值得深读": ("deep", "学习价值高、证据足、画像匹配强，适合优先打开 README。"),
    "上升很快，值得观察": ("watch", "趋势信号强，但成熟度或证据仍需观察。"),
    "可转化为项目灵感": ("idea", "适合复刻、二次开发、写简历项目。"),
    "谨慎关注": ("caution", "热度存在，但风险明显，建议先核验再投入时间。"),
}


def main():
    markdown = REPORT_PATH.read_text(encoding="utf-8")
    report = parse_report(markdown)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_pdf(report, OUTPUT_PATH)
    print(OUTPUT_PATH)


def parse_report(markdown):
    lines = normalize_markdown(markdown).splitlines()
    title = next((line[2:].strip() for line in lines if line.startswith("# ")), "RepoPulse 日报")
    profile = next((line.strip() for line in lines if line.startswith("画像：")), "")
    sections = []
    current = None
    for line in lines:
        h2 = re.match(r"^##\s+(.+?)\s*$", line)
        if h2:
            current = {"title": h2.group(1).strip(), "lines": []}
            sections.append(current)
            continue
        if current and not line.startswith("# "):
            current["lines"].append(line)

    project_sections = []
    for title_key in SECTION_TONES:
        projects = parse_projects(find_section(sections, title_key))
        if projects:
            project_sections.append({"title": title_key, "projects": projects})

    return {
        "title": title,
        "profile": profile,
        "conclusion": simple_lines(find_section(sections, "今日结论")),
        "overview": simple_lines(find_section(sections, "运行概览")),
        "project_sections": project_sections,
        "quality": simple_lines(find_section(sections, "质量警告")),
        "usage": simple_lines(find_section(sections, "使用建议")),
    }


def normalize_markdown(text):
    text = text.replace("\r", "")
    text = re.sub(r"：\s{2,}- ", "：\n  - ", text)
    text = re.sub(r"([。；])\s{2,}(\d+\.\s+)", r"\1\n  \2", text)
    labels = r"GitHub metadata|README|release|topics|license|趋势信号|社区信号|近期活跃|匹配说明|语言/主题信号|medium|low|high"
    text = re.sub(rf"([^\n])\s{{2,}}- ({labels})：", r"\1\n  - \2：", text)
    return text


def find_section(sections, title):
    for section in sections:
        if section["title"] == title:
            return section["lines"]
    return []


def simple_lines(lines):
    return [line.strip() for line in lines if line.strip()]


def parse_projects(lines):
    projects = []
    current = None
    for line in lines:
        h3 = re.match(r"^###\s+\d+\.\s+(.+?)\s*$", line)
        if h3:
            current = {"repo": h3.group(1).strip(), "raw": []}
            projects.append(current)
            continue
        if current:
            current["raw"].append(line)

    parsed = []
    for project in projects:
        fields = parse_project_fields(project["raw"])
        parsed.append(
            {
                "repo": project["repo"],
                "summary": fields.get("一句话定位", ""),
                "level": fields.get("推荐等级", ""),
                "type": fields.get("项目类型", ""),
                "scores": parse_scores(fields.get("综合分", "")),
                "confidence": fields.get("置信度", ""),
                "facts": fields.get("事实来源", ""),
                "attention": fields.get("为什么值得关注", ""),
                "learning": fields.get("为什么值得学习", "") or fields.get("推荐理由与证据", ""),
                "profile": fields.get("为什么适合当前画像", ""),
                "path": fields.get("推荐阅读路径", ""),
                "idea": fields.get("可转化项目想法", ""),
                "risks": fields.get("风险", ""),
                "url": fields.get("链接", ""),
            }
        )
    return parsed


def parse_project_fields(lines):
    fields = {}
    key = None
    value = []

    def commit():
        if key:
            fields[key] = "\n".join(value).strip()

    for raw_line in lines:
        line = raw_line.rstrip()
        match = re.match(r"^- ([^：]{1,24})：(.*)$", line)
        if match:
            commit()
            key = match.group(1).strip()
            value = [match.group(2).strip()]
        elif key and line.strip():
            value.append(line)
    commit()
    return fields


def parse_scores(score_text):
    pairs = []
    for part in re.split(r"[；;]", score_text):
        match = re.match(r"(.+?)：\s*([0-9.]+)", part.strip())
        if match:
            pairs.append((match.group(1).strip(), match.group(2)))
    return pairs[:4]


def build_pdf(report, output_path):
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=13 * mm,
        rightMargin=13 * mm,
        topMargin=13 * mm,
        bottomMargin=13 * mm,
        title=report["title"],
        author="RepoPulse",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=draw_page_footer)])

    styles = make_styles()
    story = []

    story.extend(render_cover(report, styles))
    story.append(PageBreak())
    story.extend(render_panel("今日结论", report["conclusion"], styles, index="01"))
    story.extend(render_overview(report["overview"], styles))

    section_index = 3
    for section in report["project_sections"]:
        tone, hint = SECTION_TONES[section["title"]]
        story.append(section_bar(section["title"], hint, tone, styles, f"{section_index:02d}"))
        for project in section["projects"]:
            story.extend(render_project(project, tone, styles))
        section_index += 1

    story.extend(render_panel("质量警告", report["quality"], styles, index=f"{section_index:02d}", warning=True))
    story.extend(render_panel("使用建议", report["usage"], styles, index=f"{section_index + 1:02d}"))

    doc.build(story)


def make_styles():
    base = getSampleStyleSheet()
    normal = ParagraphStyle(
        "CN",
        parent=base["BodyText"],
        fontName="STSong-Light",
        fontSize=8.8,
        leading=13.5,
        textColor=PALETTE["ink"],
        spaceAfter=4,
    )
    return {
        "normal": normal,
        "muted": ParagraphStyle("Muted", parent=normal, textColor=PALETTE["muted"]),
        "small": ParagraphStyle("Small", parent=normal, fontSize=7.8, leading=11.5),
        "h1": ParagraphStyle("H1", parent=normal, fontSize=24, leading=31, textColor=colors.white, spaceAfter=10),
        "h2": ParagraphStyle("H2", parent=normal, fontSize=15, leading=20, textColor=PALETTE["dark"], spaceAfter=8),
        "h3": ParagraphStyle("H3", parent=normal, fontSize=14, leading=18, textColor=PALETTE["dark"], spaceAfter=5),
        "chip": ParagraphStyle("Chip", parent=normal, fontSize=8, leading=10, alignment=TA_LEFT),
        "section_white": ParagraphStyle("SectionWhite", parent=normal, fontSize=14, leading=18, textColor=colors.white),
        "section_hint": ParagraphStyle("SectionHint", parent=normal, fontSize=8.5, leading=12, textColor=colors.HexColor("#E5E7EB")),
        "box_title": ParagraphStyle("BoxTitle", parent=normal, fontSize=9.5, leading=12, textColor=PALETTE["dark"], spaceAfter=5),
    }


def render_cover(report, styles):
    project_count = sum(len(section["projects"]) for section in report["project_sections"])
    warning_count = sum(1 for line in report["quality"] if line.startswith("- "))
    overview = overview_map(report["overview"])
    rows = [
        [
            Paragraph("<b>RepoPulse</b>", styles["chip"]),
            "",
            "",
        ],
        [
            Paragraph(xml(report["title"]), styles["h1"]),
            "",
            "",
        ],
        [
            Paragraph("AI Builder 趋势项目可信日报 · 朋友评审分享版", styles["section_hint"]),
            "",
            "",
        ],
        [
            Paragraph(xml(report["profile"]), styles["section_hint"]),
            "",
            "",
        ],
        [
            cover_stat("推荐项目", str(project_count), styles),
            cover_stat("最终推荐", overview.get("最终推荐", "10"), styles),
            cover_stat("质量警告", str(warning_count), styles),
        ],
    ]
    table = Table(rows, colWidths=[58 * mm, 58 * mm, 58 * mm])
    table.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (2, 0)),
                ("SPAN", (0, 1), (2, 1)),
                ("SPAN", (0, 2), (2, 2)),
                ("SPAN", (0, 3), (2, 3)),
                ("BACKGROUND", (0, 0), (-1, -1), PALETTE["dark"]),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 18),
                ("RIGHTPADDING", (0, 0), (-1, -1), 18),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("BOX", (0, 0), (-1, -1), 0.8, PALETTE["dark"]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return [table]


def cover_stat(label, value, styles):
    return Paragraph(f'<font color="#CBD5E1">{xml(label)}</font><br/><font size="18"><b>{xml(value)}</b></font>', styles["normal"])


def render_panel(title, lines, styles, index="", warning=False):
    content = [[section_index(index, title, styles)]]
    if not lines:
        content.append([Paragraph("暂无内容。", styles["muted"])])
    else:
        for line in lines:
            if warning and line.startswith("- "):
                content.append([warning_para(line[2:], styles)])
            else:
                content.append([markdownish(line, styles)])
    table = Table(content, colWidths=[181 * mm], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, PALETTE["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return [table, Spacer(1, 7)]


def render_overview(lines, styles):
    data = []
    metrics = []
    for line in lines:
        if line.startswith("- "):
            text = line[2:]
            label, value = split_label(text)
            metrics.append(metric_box(label, value, styles))
    for i in range(0, len(metrics), 4):
        data.append(metrics[i : i + 4] + [""] * (4 - len(metrics[i : i + 4])))
    table = Table(data, colWidths=[45 * mm] * 4, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [section_index("02", "运行概览", styles), table, Spacer(1, 10)]


def metric_box(label, value, styles):
    return Table(
        [[Paragraph(f'<font color="#64748B">{xml(label)}</font><br/><b>{xml(value)}</b>', styles["small"])]],
        colWidths=[42 * mm],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), PALETTE["soft"]),
            ("BOX", (0, 0), (-1, -1), 0.5, PALETTE["line"]),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ],
    )


def section_bar(title, hint, tone, styles, index):
    table = Table(
        [[Paragraph(f'<font color="#DBEAFE">{xml(index)}</font>  <b>{xml(title)}</b>', styles["section_white"]), Paragraph(xml(hint), styles["section_hint"])]],
        colWidths=[76 * mm, 105 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALETTE[tone]),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return KeepTogether([Spacer(1, 5), table, Spacer(1, 7)])


def render_project(project, tone, styles):
    score_table = render_score_table(project["scores"], styles)
    rows = [
        [Paragraph(xml(project["repo"]), styles["h3"]), level_chip(project["level"], project["url"], tone, styles)],
        [Paragraph(xml(project["summary"]), styles["muted"]), ""],
        [score_table, score_table],
    ]
    rows.append([Paragraph(xml(project["type"] or project["confidence"]), styles["small"]), ""])
    card = Table(rows, colWidths=[142 * mm, 39 * mm], hAlign="LEFT")
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.6, PALETTE["line"]),
                ("LINEBEFORE", (0, 0), (0, -1), 4, PALETTE[tone]),
                ("SPAN", (0, 2), (1, 2)),
                ("SPAN", (0, 3), (1, 3)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )

    detail_rows = []
    detail_pairs = [
        ("事实来源", project["facts"], "soft"),
        ("为什么值得关注", project["attention"], "soft"),
        ("为什么值得学习", project["learning"], "soft"),
        ("为什么适合当前画像", project["profile"], "soft"),
    ]
    if project["idea"]:
        detail_pairs.append(("可转化项目想法", project["idea"], "soft"))
    detail_pairs.append(("风险", project["risks"], "warn"))

    for i in range(0, len(detail_pairs), 2):
        left = detail_box(*detail_pairs[i], styles)
        right = detail_box(*detail_pairs[i + 1], styles) if i + 1 < len(detail_pairs) else ""
        detail_rows.append([left, right])
    if project["path"]:
        detail_rows.append([detail_box("推荐阅读路径", project["path"], "soft", styles), ""])

    details = Table(detail_rows, colWidths=[90.5 * mm, 90.5 * mm], hAlign="LEFT")
    details.setStyle(
        TableStyle(
            [
                ("SPAN", (0, len(detail_rows) - 1), (1, len(detail_rows) - 1)) if project["path"] else ("GRID", (0, 0), (-1, -1), 0, colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return [KeepTogether([card, details]), Spacer(1, 8)]


def render_score_table(scores, styles):
    if not scores:
        return Paragraph("", styles["small"])
    cells = []
    for label, value in scores:
        cells.append(Paragraph(f'<font color="#64748B">{xml(label)}</font><br/><font size="13"><b>{xml(value)}</b></font>', styles["small"]))
    table = Table([cells], colWidths=[44 * mm] * len(cells), hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALETTE["soft"]),
                ("BOX", (0, 0), (-1, -1), 0.4, PALETTE["line"]),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, PALETTE["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def level_chip(level, url, tone, styles):
    parts = []
    if level:
        parts.append(f'<font color="#FFFFFF"><b>{xml(level)}</b></font>')
    if url:
        parts.append(f'<font color="#DBEAFE">GitHub</font>')
    text = "<br/>".join(parts)
    return Table(
        [[Paragraph(text, styles["chip"])]],
        colWidths=[34 * mm],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), PALETTE[tone]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ],
    )


def detail_box(title, content, kind, styles):
    bg = PALETTE["warn_bg"] if kind == "warn" else PALETTE["soft"]
    flow = [Paragraph(f"<b>{xml(title)}</b>", styles["box_title"])]
    flow.extend(markdownish_flowables(content, styles))
    table = Table([[flow]], colWidths=[88 * mm if title != "推荐阅读路径" else 179 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.4, PALETTE["line"]),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def markdownish(text, styles):
    flows = markdownish_flowables(text, styles)
    if len(flows) == 1:
        return flows[0]
    return KeepTogether(flows)


def markdownish_flowables(text, styles):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return [Paragraph("", styles["small"])]
    flows = []
    pending = []
    list_kind = None

    def flush():
        nonlocal pending, list_kind
        if not pending:
            return
        flows.append(
            ListFlowable(
                [ListItem(Paragraph(xml(item), styles["small"]), leftIndent=8) for item in pending],
                bulletType="bullet" if list_kind == "bullet" else "1",
                leftIndent=12,
                bulletFontName="STSong-Light",
            )
        )
        pending = []
        list_kind = None

    for line in lines:
        bullet = re.match(r"^-\s+(.+)$", line)
        numbered = re.match(r"^\d+\.\s+(.+)$", line)
        if bullet:
            if list_kind not in (None, "bullet"):
                flush()
            list_kind = "bullet"
            pending.append(bullet.group(1))
        elif numbered:
            if list_kind not in (None, "number"):
                flush()
            list_kind = "number"
            pending.append(numbered.group(1))
        else:
            flush()
            flows.append(Paragraph(xml(line), styles["small"]))
    flush()
    return flows


def section_index(index, title, styles):
    return Paragraph(f'<font color="#0369A1"><b>{xml(index)}</b></font>  <b>{xml(title)}</b>', styles["h2"])


def warning_para(text, styles):
    return Table(
        [[Paragraph(xml(text), styles["small"])]],
        colWidths=[174 * mm],
        style=[
            ("BACKGROUND", (0, 0), (-1, -1), PALETTE["warn_bg"]),
            ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor("#F59E0B")),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ],
    )


def overview_map(lines):
    out = {}
    for line in lines:
        if line.startswith("- "):
            label, value = split_label(line[2:])
            out[label] = value
    return out


def split_label(text):
    if "：" not in text:
        return text, "-"
    label, value = text.split("：", 1)
    return label.strip(), value.strip()


def draw_page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("STSong-Light", 7)
    canvas.setFillColor(PALETTE["muted"])
    canvas.drawString(doc.leftMargin, 7 * mm, "RepoPulse AI Builder Daily · 2026-05-18")
    canvas.drawRightString(A4[0] - doc.rightMargin, 7 * mm, f"{doc.page}")
    canvas.restoreState()


def xml(text):
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    main()
