from __future__ import annotations

from statistics import median

import cv2
import numpy as np
from PIL import Image, ImageDraw


PREPROCESSED_IMAGE_PATH = "/tmp/shelf_preprocessed.jpg"
MAX_IMAGE_WIDTH = 1600
ROW_BAND_ALPHA = 51
ROW_BAND_COLORS = [
    (173, 216, 230, ROW_BAND_ALPHA),
    (255, 255, 224, ROW_BAND_ALPHA),
]
CONTOUR_AREA_RATIO_THRESHOLD = 0.2
MIN_LINE_LENGTH_RATIO = 0.45
MAX_HORIZONTAL_ANGLE_DEGREES = 8
MIN_VERTICAL_ANGLE_DEGREES = 82


def _resize_image(image: np.ndarray) -> np.ndarray:
    image_height, image_width = image.shape[:2]
    if image_width <= MAX_IMAGE_WIDTH:
        return image

    scale = MAX_IMAGE_WIDTH / float(image_width)
    resized_dimensions = (MAX_IMAGE_WIDTH, int(round(image_height * scale)))
    return cv2.resize(image, resized_dimensions, interpolation=cv2.INTER_AREA)


def _order_points(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    point_sums = points.sum(axis=1)
    point_diffs = np.diff(points, axis=1)

    rect[0] = points[np.argmin(point_sums)]
    rect[2] = points[np.argmax(point_sums)]
    rect[1] = points[np.argmin(point_diffs)]
    rect[3] = points[np.argmax(point_diffs)]
    return rect


def _warp_from_quad(image: np.ndarray, quad: np.ndarray) -> np.ndarray:
    rect = _order_points(quad.astype("float32"))
    top_left, top_right, bottom_right, bottom_left = rect

    width_top = np.linalg.norm(top_right - top_left)
    width_bottom = np.linalg.norm(bottom_right - bottom_left)
    height_left = np.linalg.norm(bottom_left - top_left)
    height_right = np.linalg.norm(bottom_right - top_right)

    max_width = int(round(max(width_top, width_bottom)))
    max_height = int(round(max(height_left, height_right)))

    if max_width < 64 or max_height < 64:
        return image

    destination = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype="float32",
    )
    transform = cv2.getPerspectiveTransform(rect, destination)
    return cv2.warpPerspective(image, transform, (max_width, max_height))


def _intersection(line_a: tuple[float, float, float], line_b: tuple[float, float, float]) -> np.ndarray | None:
    a1, b1, c1 = line_a
    a2, b2, c2 = line_b
    determinant = (a1 * b2) - (a2 * b1)
    if abs(determinant) < 1e-6:
        return None

    x_value = ((c1 * b2) - (c2 * b1)) / determinant
    y_value = ((a1 * c2) - (a2 * c1)) / determinant
    return np.array([x_value, y_value], dtype="float32")


def _line_coefficients(line: tuple[int, int, int, int]) -> tuple[float, float, float]:
    x1, y1, x2, y2 = line
    a_value = float(y2 - y1)
    b_value = float(x1 - x2)
    c_value = (a_value * x1) + (b_value * y1)
    return a_value, b_value, c_value


def _detect_quad_from_contours(image: np.ndarray) -> np.ndarray | None:
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)
    edges = cv2.Canny(blurred, 60, 180)
    edges = cv2.dilate(edges, np.ones((3, 3), dtype=np.uint8), iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), dtype=np.uint8), iterations=2)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    image_area = float(image.shape[0] * image.shape[1])
    min_area = image_area * CONTOUR_AREA_RATIO_THRESHOLD

    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        contour_area = cv2.contourArea(contour)
        if contour_area < min_area:
            break

        perimeter = cv2.arcLength(contour, True)
        approximation = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approximation) != 4 or not cv2.isContourConvex(approximation):
            continue

        points = approximation.reshape(4, 2).astype("float32")
        x_value, y_value, width, height = cv2.boundingRect(approximation)
        if width < int(image.shape[1] * 0.6) or height < int(image.shape[0] * 0.45):
            continue

        if x_value <= 2 and y_value <= 2 and (x_value + width) >= image.shape[1] - 2 and (y_value + height) >= image.shape[0] - 2:
            continue

        return points

    return None


def _detect_quad_from_lines(image: np.ndarray) -> np.ndarray | None:
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=int(image.shape[1] * MIN_LINE_LENGTH_RATIO),
        maxLineGap=40,
    )
    if lines is None:
        return None

    horizontal_lines: list[tuple[int, int, int, int]] = []
    vertical_lines: list[tuple[int, int, int, int]] = []

    for raw_line in lines:
        x1, y1, x2, y2 = [int(value) for value in raw_line[0]]
        dx = x2 - x1
        dy = y2 - y1
        angle = abs(np.degrees(np.arctan2(dy, dx))) if dx != 0 or dy != 0 else 0.0
        line_length = float(np.hypot(dx, dy))

        if angle <= MAX_HORIZONTAL_ANGLE_DEGREES and line_length >= image.shape[1] * MIN_LINE_LENGTH_RATIO:
            horizontal_lines.append((x1, y1, x2, y2))
        elif angle >= MIN_VERTICAL_ANGLE_DEGREES and line_length >= image.shape[0] * 0.35:
            vertical_lines.append((x1, y1, x2, y2))

    if len(horizontal_lines) < 2 or len(vertical_lines) < 2:
        return None

    top_line = min(horizontal_lines, key=lambda line: (line[1] + line[3]) / 2.0)
    bottom_line = max(horizontal_lines, key=lambda line: (line[1] + line[3]) / 2.0)
    left_line = min(vertical_lines, key=lambda line: (line[0] + line[2]) / 2.0)
    right_line = max(vertical_lines, key=lambda line: (line[0] + line[2]) / 2.0)

    intersections = [
        _intersection(_line_coefficients(top_line), _line_coefficients(left_line)),
        _intersection(_line_coefficients(top_line), _line_coefficients(right_line)),
        _intersection(_line_coefficients(bottom_line), _line_coefficients(right_line)),
        _intersection(_line_coefficients(bottom_line), _line_coefficients(left_line)),
    ]
    if any(point is None for point in intersections):
        return None

    quad = np.vstack(intersections).astype("float32")
    x_values = quad[:, 0]
    y_values = quad[:, 1]
    if (
        x_values.min() < -image.shape[1] * 0.1
        or y_values.min() < -image.shape[0] * 0.1
        or x_values.max() > image.shape[1] * 1.1
        or y_values.max() > image.shape[0] * 1.1
    ):
        return None

    return quad


def _apply_perspective_correction(image: np.ndarray) -> tuple[np.ndarray, bool]:
    contour_quad = _detect_quad_from_contours(image)
    if contour_quad is not None:
        return _warp_from_quad(image, contour_quad), True

    line_quad = _detect_quad_from_lines(image)
    if line_quad is not None:
        return _warp_from_quad(image, line_quad), True

    return image, False


def preprocess_shelf_image(image_path: str) -> str:
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Could not read image from `{image_path}`.")

    image = _resize_image(image)
    corrected_image, homography_applied = _apply_perspective_correction(image)
    corrected_image = _resize_image(corrected_image)

    # Use local contrast enhancement to handle glare and uneven store lighting.
    lab_image = cv2.cvtColor(corrected_image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab_image)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    enhanced_lab = cv2.merge((l_channel, a_channel, b_channel))
    enhanced = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    enhanced = cv2.convertScaleAbs(enhanced, alpha=1.08, beta=2)

    cv2.imwrite(PREPROCESSED_IMAGE_PATH, enhanced)
    print(
        "Preprocessing shelf image: "
        f"{'perspective correction applied' if homography_applied else 'perspective correction skipped'}, "
        "contrast enhanced"
    )
    return PREPROCESSED_IMAGE_PATH


def filter_real_rows(image_path: str, detected_row_bands, boxes=None) -> list:
    if not detected_row_bands:
        print("Detected 0 shelf bands, filtered to 0 real product rows (0 empty bands removed)")
        return []

    normalized_boxes = []
    for box in boxes or []:
        if not box or len(box) != 4:
            continue

        x1, y1, x2, y2 = [int(round(value)) for value in box]
        if x2 <= x1 or y2 <= y1:
            continue

        normalized_boxes.append(
            {
                "bbox": [x1, y1, x2, y2],
                "bottom_y": y2,
            }
        )

    band_heights = [max(0, int(bottom) - int(top)) for top, bottom in detected_row_bands]
    median_band_height = float(median(band_heights)) if band_heights else 0.0

    filtered_bands = []
    removed_band_count = 0

    for row_top, row_bottom in detected_row_bands:
        row_top = int(row_top)
        row_bottom = int(row_bottom)
        detection_count = sum(1 for box in normalized_boxes if row_top <= box["bottom_y"] <= row_bottom)
        band_height = max(0, row_bottom - row_top)

        is_empty_shelf = detection_count == 0
        if not is_empty_shelf and median_band_height > 0:
            is_empty_shelf = detection_count < 2 and band_height > (median_band_height * 1.5)

        if is_empty_shelf:
            removed_band_count += 1
            continue

        filtered_bands.append((row_top, row_bottom))

    print(
        f"Detected {len(detected_row_bands)} shelf bands, filtered to {len(filtered_bands)} "
        f"real product rows ({removed_band_count} empty bands removed)"
    )
    return filtered_bands


def draw_debug_rows(image_path: str, row_bands) -> Image.Image:
    base_image = Image.open(image_path).convert("RGBA")
    overlay = Image.new("RGBA", base_image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    image_width, _ = base_image.size

    for index, (row_top, row_bottom) in enumerate(row_bands):
        color = ROW_BAND_COLORS[index % len(ROW_BAND_COLORS)]
        draw.rectangle([0, int(row_top), image_width, int(row_bottom)], fill=color)

    return Image.alpha_composite(base_image, overlay).convert("RGB")
