from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd
import streamlit as st
from PIL import Image

try:
    from .compliance_reporter import build_compliance_report
    from .gap_detector import detect_shelf_rows, get_row_detection_method
    from .image_preprocessor import preprocess_shelf_image
    from .infer import analyze_shelf_image, load_yolo_model, set_yolo_model
    from .sku_identifier import load_qwen_resources, set_qwen_resources
    from .visualize import draw_annotations
except ImportError:
    from compliance_reporter import build_compliance_report
    from gap_detector import detect_shelf_rows, get_row_detection_method
    from image_preprocessor import preprocess_shelf_image
    from infer import analyze_shelf_image, load_yolo_model, set_yolo_model
    from sku_identifier import load_qwen_resources, set_qwen_resources
    from visualize import draw_annotations


TMP_IMAGE_PATH = Path("/tmp/shelf_input.jpg")

st.set_page_config(page_title="Shelf Analyzer Planogram", layout="wide", page_icon="🛒")


@st.cache_resource
def _get_cached_yolo_model():
    return load_yolo_model()


@st.cache_resource
def _get_cached_qwen_resources():
    return load_qwen_resources()


def _prepare_models() -> None:
    yolo_model = _get_cached_yolo_model()
    set_yolo_model(yolo_model)

    processor, qwen_model = _get_cached_qwen_resources()
    set_qwen_resources(processor, qwen_model)


def _to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _build_table(detections: list[dict]) -> pd.DataFrame:
    rows = []
    slot_detections = [
        detection
        for detection in detections
        if detection.get("type") in {"product", "empty_space"}
    ]

    for index, detection in enumerate(slot_detections, start=1):
        sku = detection.get("sku") or {}
        confidence = sku.get("confidence", "")
        rows.append(
            {
                "#": index,
                "Type": detection.get("type", ""),
                "Brand": sku.get("brand", "") if detection.get("type") == "product" else "",
                "Product Name": sku.get("product_name", "") if detection.get("type") == "product" else "",
                "Variant": sku.get("variant", "") if detection.get("type") == "product" else "",
                "Size": sku.get("size", "") if detection.get("type") == "product" else "",
                "Confidence": (
                    f"{float(confidence):.2f}"
                    if detection.get("type") == "product" and confidence != ""
                    else ""
                ),
                "Bounding Box": str(detection.get("bbox", [])),
            }
        )

    return pd.DataFrame(rows)


def _style_table(dataframe: pd.DataFrame):
    if dataframe.empty:
        return dataframe

    return dataframe.style.apply(
        lambda row: [
            "background-color: #ffe5e5" if row["Type"] == "empty_space" else ""
            for _ in row
        ],
        axis=1,
    )


def _render_summary(detections: list[dict]) -> None:
    report = build_compliance_report(detections)
    visible_row_count = len(report["visible_rows"])
    total_row_count = max(int(report["total_planogram_rows"]), 1)
    compliance_score = int(report["compliance_score"])

    st.markdown(
        f"""
        <div style="
            display:flex;
            gap:18px;
            padding:16px 20px;
            border-radius:16px;
            background:#f6f7fb;
            border:1px solid #dbe2ea;
            margin:14px 0 18px 0;
            font-weight:600;
            flex-wrap:wrap;
        ">
            <div>📷 Rows visible in image: <span style="color:#0f172a;">{visible_row_count} of {total_row_count}</span></div>
            <div>|</div>
            <div>Compliance on visible rows: <span style="color:#166534;">{compliance_score}%</span></div>
            <div style="width:100%; color:#475569; font-size:0.95rem;">{report["visibility_note"]}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _unique_bbox_count(detections: list[dict], predicate) -> int:
    return len(
        {
            tuple(detection.get("bbox", []))
            for detection in detections
            if detection.get("type") == "product" and detection.get("bbox") and predicate(detection)
        }
    )


def _render_detection_quality_warnings(detections: list[dict], row_method: str) -> None:
    merged_box_count = _unique_bbox_count(
        detections,
        lambda detection: detection.get("detection_quality") == "merged_box",
    )
    side_only_count = _unique_bbox_count(
        detections,
        lambda detection: (detection.get("sku") or {}).get("visibility") == "side_only",
    )
    tall_box_count = _unique_bbox_count(
        detections,
        lambda detection: bool(detection.get("tall_box")),
    )

    with st.expander("⚠️ Detection Quality Warnings", expanded=True):
        st.markdown(f"- `{merged_box_count}` boxes may be double-counted as single detections")
        st.markdown(f"- `{side_only_count}` boxes were only partially visible and may be misidentified")
        st.markdown(f"- `{tall_box_count}` tall boxes detected (e.g. Wheaties, Rice Krispies) — assigned to row by bottom edge")
        st.markdown(f"- Rows detected via: `{row_method}`")


def main() -> None:
    st.title("Shelf Analyzer Planogram")

    left_col, right_col = st.columns([1, 2], gap="large")

    with left_col:
        st.subheader("Upload Shelf Image")
        uploaded_file = st.file_uploader(
            "Choose a shelf photo",
            type=["jpg", "jpeg", "png", "webp"],
        )
        analyze_clicked = st.button(
            "Analyze Shelf",
            disabled=uploaded_file is None,
            use_container_width=True,
        )

    if analyze_clicked and uploaded_file is not None:
        input_image = Image.open(uploaded_file).convert("RGB")
        TMP_IMAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
        input_image.save(TMP_IMAGE_PATH, format="JPEG", quality=95)

        with st.spinner("Detecting items on shelf..."):
            _prepare_models()

        with st.spinner("Identifying SKUs with Qwen-VL..."):
            _get_cached_qwen_resources()

        with st.spinner("Mapping empty spaces..."):
            detections = analyze_shelf_image(str(TMP_IMAGE_PATH))
            preprocessed_path = preprocess_shelf_image(str(TMP_IMAGE_PATH))
            preprocessed_image = Image.open(preprocessed_path).convert("RGB")
            annotated_image = draw_annotations(preprocessed_image, detections)

        product_boxes = [
            detection.get("bbox")
            for detection in detections
            if detection.get("type") == "product" and detection.get("bbox")
        ]
        row_hint = max((int(detection.get("row") or 0) for detection in detections), default=4) or 4
        row_bands = detect_shelf_rows(preprocessed_path, row_hint, boxes=product_boxes)
        row_method = get_row_detection_method(preprocessed_path)

        st.session_state["shelf_detections"] = detections
        st.session_state["annotated_image"] = annotated_image
        st.session_state["row_bands"] = row_bands
        st.session_state["row_method"] = row_method

    with right_col:
        st.subheader("Results")

        detections = st.session_state.get("shelf_detections", [])
        annotated_image = st.session_state.get("annotated_image")
        row_method = st.session_state.get("row_method", "unknown")

        if annotated_image is None:
            st.info("Upload a shelf image and click Analyze Shelf to see results.")
            return

        png_bytes = _to_png_bytes(annotated_image)
        st.image(annotated_image, caption="Annotated Shelf", use_container_width=True)
        _render_detection_quality_warnings(detections, row_method)
        st.download_button(
            "Download Annotated PNG",
            data=png_bytes,
            file_name="shelf_annotations.png",
            mime="image/png",
            use_container_width=True,
        )

        _render_summary(detections)

        table_df = _build_table(detections)
        if table_df.empty:
            st.warning("No detections were returned for this image.")
        else:
            st.dataframe(_style_table(table_df), use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
