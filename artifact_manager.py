"""Artifact tracking for files created or used by the desktop agent."""

from __future__ import annotations

import json
import os
import re
import time
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape
from typing import Any, Dict, Iterable, List, Optional


TRACKED_EXTENSIONS = {
    ".txt", ".md", ".doc", ".docx", ".wps", ".pdf", ".ppt", ".pptx",
    ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg",
}


class ArtifactManager:
    def __init__(self, output_dir: str, instruction: str = ""):
        self.output_dir = Path(output_dir)
        self.instruction = instruction
        self.root_dir = self._choose_root_dir()
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.registry_path = self.root_dir / "artifacts.json"
        self._artifacts: List[Dict[str, Any]] = self._load_registry()

    def _choose_root_dir(self) -> Path:
        desktop = Path.home() / "Desktop"
        if desktop.exists():
            return desktop / "AgentOutputs"
        return self.output_dir / "AgentOutputs"

    def _load_registry(self) -> List[Dict[str, Any]]:
        if not self.registry_path.exists():
            return []
        try:
            data = json.loads(self.registry_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
        except Exception:
            return []
        return []

    def _save_registry(self) -> None:
        self.registry_path.write_text(
            json.dumps(self._artifacts, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def register_artifact(self, path: str, kind: str = "file", note: str = "") -> Optional[Dict[str, Any]]:
        resolved = Path(path).expanduser()
        try:
            resolved = resolved.resolve()
        except Exception:
            pass
        if not resolved.exists():
            return None

        record = {
            "path": str(resolved),
            "name": resolved.name,
            "kind": kind,
            "note": note,
            "size": resolved.stat().st_size,
            "mtime": resolved.stat().st_mtime,
            "registered_at": time.time(),
        }

        self._artifacts = [
            item for item in self._artifacts
            if os.path.normcase(str(item.get("path"))) != os.path.normcase(str(resolved))
        ]
        self._artifacts.append(record)
        self._artifacts.sort(key=lambda item: float(item.get("mtime") or 0), reverse=True)
        self._save_registry()
        return record

    def create_text_file(self, filename: str, text: str, kind: str = "report") -> Dict[str, Any]:
        safe_name = _safe_filename(filename or "agent_report.md")
        if "." not in safe_name:
            safe_name += ".md"
        path = self.root_dir / safe_name
        path.write_text(text or "", encoding="utf-8")
        record = self.register_artifact(str(path), kind=kind, note="created_by_agent")
        if record is None:
            raise RuntimeError(f"Failed to create artifact: {path}")
        return record

    def create_docx_file(self, filename: str, text: str, title: str = "") -> Dict[str, Any]:
        safe_name = _safe_filename(filename or "agent_report.docx")
        if not safe_name.lower().endswith(".docx"):
            safe_name += ".docx"
        path = self.root_dir / safe_name
        _write_minimal_docx(path, title=title or path.stem, text=text or "")
        record = self.register_artifact(str(path), kind="document", note="created_by_agent")
        if record is None:
            raise RuntimeError(f"Failed to create DOCX artifact: {path}")
        return record

    def scan_existing(self, extra_dirs: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
        dirs = [self.root_dir, self.output_dir]
        for item in extra_dirs or []:
            if item:
                dirs.append(Path(item))

        for folder in dirs:
            if not folder.exists() or not folder.is_dir():
                continue
            for path in folder.iterdir():
                if not path.is_file():
                    continue
                if path.suffix.lower() not in TRACKED_EXTENSIONS:
                    continue
                self.register_artifact(str(path), kind=_kind_for(path), note="discovered")
        return self.latest_artifacts()

    def latest_artifacts(self, limit: int = 8) -> List[Dict[str, Any]]:
        self._artifacts.sort(key=lambda item: float(item.get("mtime") or 0), reverse=True)
        return self._artifacts[:limit]

    def render_for_prompt(self, limit: int = 8) -> str:
        latest = self.latest_artifacts(limit)
        lines = [
            "Artifact/file workspace:",
            f"- Save new reports/files under: {self.root_dir}",
            f"- Registry: {self.registry_path}",
            "- When attaching a known artifact, paste the absolute path into the file picker.",
        ]
        if not latest:
            lines.append("- Known artifacts: none yet.")
            return "\n".join(lines)

        lines.append("- Known artifacts:")
        for item in latest:
            lines.append(
                f"  * {item.get('name')} | {item.get('kind')} | {item.get('path')}"
            )
        return "\n".join(lines)


def _safe_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", value).strip()
    value = re.sub(r"\s+", "_", value)
    return value[:120] or "agent_report.md"


def _kind_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt", ".doc", ".docx", ".wps", ".pdf"}:
        return "document"
    if suffix in {".ppt", ".pptx"}:
        return "presentation"
    if suffix in {".xls", ".xlsx", ".csv"}:
        return "spreadsheet"
    if suffix in {".png", ".jpg", ".jpeg"}:
        return "image"
    return "file"


def _write_minimal_docx(path: Path, title: str, text: str) -> None:
    paragraphs = [line.strip() for line in text.replace("\r\n", "\n").split("\n")]
    paragraphs = [line for line in paragraphs if line]
    if not paragraphs:
        paragraphs = ["No content provided."]

    def paragraph_xml(value: str, style: str = "") -> str:
        style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
        return (
            "<w:p>"
            f"{style_xml}"
            "<w:r><w:t xml:space=\"preserve\">"
            f"{escape(value)}"
            "</w:t></w:r>"
            "</w:p>"
        )

    body_parts = [paragraph_xml(title, "Title")] if title else []
    body_parts.extend(paragraph_xml(item) for item in paragraphs)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        + "".join(body_parts)
        + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" '
        'w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
        "</w:body></w:document>"
    )

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>"
    )
    package_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
        '<w:name w:val="Normal"/></w:style>'
        '<w:style w:type="paragraph" w:styleId="Title">'
        '<w:name w:val="Title"/><w:basedOn w:val="Normal"/>'
        '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
        "</w:styles>"
    )

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", package_rels)
        docx.writestr("word/document.xml", document_xml)
        docx.writestr("word/styles.xml", styles_xml)
