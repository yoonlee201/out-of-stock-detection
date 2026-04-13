from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd
import streamlit as st
from PIL import Image

try:
    from .infer import analyze_shelf_image, load_yolo_model, set_yolo_model
    from .sku_identifier import load_qwen_resources, set_qwen_resources
    from .visualize import draw_annotations
except ImportError:
    from infer import analyze_shelf_image, load_yolo_model, set_yolo_model
    from sku_identifier import load_qwen_resources, set_qwen_resources
    from visualize import draw_annotations


TMP_IMAGE_PATH = Path("/tmp/shelf_input.jpg")

st.set_page_config(page_title="Shelf Analyzer", layout="wide", page_icon="🛒")


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


def _build_table(detections: list) -> pd.DataFrame:
    rows = []

    for index, detection in enumerate(detections, start=1):
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


def _render_summary(detections: list) -> None:
    product_detections = [item for item in detections if item.get("type") == "product"]
    empty_detections = [item for item in detections if item.get("type") == "empty_space"]
    unique_skus = {
        (
            (item.get("sku") or {}).get("brand", ""),
            (item.get("sku") or {}).get("product_name", ""),
            (item.get("sku") or {}).get("variant", ""),
            (item.get("sku") or {}).get("size", ""),
        )
        for item in product_detections
    }

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
        ">
            <div>Products: <span style="color:#166534;">{len(product_detections)}</span></div>
            <div>Empty Spaces: <span style="color:#b91c1c;">{len(empty_detections)}</span></div>
            <div>Unique SKUs: <span style="color:#1d4ed8;">{len(unique_skus)}</span></div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    st.title("Shelf Analyzer")

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
            annotated_image = draw_annotations(input_image, detections)

        st.session_state["shelf_detections"] = detections
        st.session_state["annotated_image"] = annotated_image

    with right_col:
        st.subheader("Results")

        detections = st.session_state.get("shelf_detections", [])
        annotated_image = st.session_state.get("annotated_image")

        if annotated_image is None:
            st.info("Upload a shelf image and click Analyze Shelf to see results.")
            return

        png_bytes = _to_png_bytes(annotated_image)
        st.image(annotated_image, caption="Annotated Shelf", use_container_width=True)
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
