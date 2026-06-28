"""
TQI Bill Scanner Service — Google Drive style receipt scanner
Uses OpenCV for: edge detection, contour finding, perspective correction, auto-rotation
"""
import io
import base64
import math
import cv2
import numpy as np
from PIL import Image, ImageEnhance
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins="*")

MAX_SIZE = 10 * 1024 * 1024  # 10 MB


# ─── Helpers ────────────────────────────────────────────────────────────────

def b64_to_cv(b64: str) -> np.ndarray:
    """Decode base64 image string to OpenCV BGR array."""
    # strip data URL prefix if present
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    data = base64.b64decode(b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def cv_to_b64(img: np.ndarray, quality: int = 97) -> str:
    """Encode OpenCV BGR array to base64 JPEG string."""
    success, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise ValueError("Could not encode image")
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()


def order_points(pts: np.ndarray) -> np.ndarray:
    """Order 4 corner points: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left: smallest sum
    rect[2] = pts[np.argmax(s)]   # bottom-right: largest sum
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right: smallest diff
    rect[3] = pts[np.argmax(diff)]  # bottom-left: largest diff
    return rect


def four_point_transform(img: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Apply perspective warp using 4 corner points."""
    rect = order_points(pts)
    tl, tr, br, bl = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = max(int(height_a), int(height_b))

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(img, M, (max_width, max_height))
    return warped


def detect_document_contour(img: np.ndarray):
    """
    Find the largest quadrilateral contour in the image.
    Returns 4-point numpy array or None if not found.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive Canny
    v = np.median(blurred)
    lower = int(max(0, 0.67 * v))
    upper = int(min(255, 1.33 * v))
    edges = cv2.Canny(blurred, lower, upper)

    # Dilate to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for cnt in contours[:10]:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if len(approx) == 4:
            area = cv2.contourArea(approx)
            # Must cover at least 10% of image
            if area > 0.10 * h * w:
                return approx.reshape(4, 2).astype(np.float32)

    return None


def auto_rotate(img: np.ndarray) -> np.ndarray:
    """
    Detect text orientation using Pillow EXIF and correct rotation.
    Falls back to aspect-ratio heuristic for tall/wide receipts.
    """
    h, w = img.shape[:2]
    # Receipts are usually taller than wide — if wider, rotate 90°
    if w > h * 1.5:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    return img


def enhance_image(img: np.ndarray) -> np.ndarray:
    """
    Apply brightness/contrast/sharpness correction while preserving original colors.
    Does NOT grayscale, does NOT compress, does NOT resize.
    """
    # Convert to PIL for enhancement
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

    # Gentle brightness boost
    pil = ImageEnhance.Brightness(pil).enhance(1.05)
    # Slight contrast boost
    pil = ImageEnhance.Contrast(pil).enhance(1.1)
    # Sharpness
    pil = ImageEnhance.Sharpness(pil).enhance(1.3)

    return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)


def count_document_contours(img: np.ndarray) -> int:
    """Return approximate number of distinct document-like regions detected."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    large = [c for c in contours if cv2.contourArea(c) > 0.08 * h * w]
    return len(large)


# ─── Main processing pipeline ───────────────────────────────────────────────

def process_bill(b64_input: str):
    """
    Full Google Drive-style bill scan pipeline:
    1. Detect document contour
    2. Perspective correction
    3. Auto-rotation
    4. Image enhancement
    Returns: (original_b64, processed_b64, width, height, detected: bool)
    """
    img = b64_to_cv(b64_input)
    original_b64 = cv_to_b64(img)  # preserve original before any processing

    # Check for multiple documents
    doc_count = count_document_contours(img)
    if doc_count > 2:
        return original_b64, original_b64, img.shape[1], img.shape[0], False, "multiple"

    # Detect contour
    contour = detect_document_contour(img)

    if contour is not None:
        # Perspective correction
        warped = four_point_transform(img, contour)
    else:
        # No clear contour — use full image
        warped = img.copy()

    # Auto-rotation
    warped = auto_rotate(warped)

    # Enhancement (brightness/contrast/sharpness only, colors preserved)
    enhanced = enhance_image(warped)

    h, w = enhanced.shape[:2]
    processed_b64 = cv_to_b64(enhanced, quality=97)

    return original_b64, processed_b64, w, h, contour is not None, "ok"


# ─── Flask routes ────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "tqi-bill-scanner"})


@app.route("/api/finance/scan-bill", methods=["POST"])
def scan_bill():
    """
    Accepts either:
      - multipart/form-data with field 'image' (file upload)
      - JSON body with field 'image' (base64 data URL)
    """
    try:
        b64_input = None

        if request.content_type and "multipart" in request.content_type:
            # File upload
            if "image" not in request.files:
                return jsonify({"success": False, "error": "No image file provided"}), 400
            f = request.files["image"]
            raw = f.read()
            if len(raw) > MAX_SIZE:
                return jsonify({"success": False, "error": "Image too large (max 10MB)"}), 400
            b64_input = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
        else:
            # JSON base64
            data = request.get_json(silent=True) or {}
            b64_input = data.get("image", "")
            if not b64_input:
                return jsonify({"success": False, "error": "No image provided"}), 400

        original, processed, width, height, detected, status_code = process_bill(b64_input)

        if status_code == "multiple":
            return jsonify({
                "success": False,
                "error": "multiple_receipts",
                "message": "Multiple receipts detected. Scan one receipt at a time.",
                "original": original,
                "processed": original,
                "width": width,
                "height": height,
            })

        return jsonify({
            "success": True,
            "original": original,
            "processed": processed,
            "width": width,
            "height": height,
            "detected": detected,
            "message": "Bill processed successfully" if detected else "Bill processed (no clear edges detected, full image used)",
        })

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        app.logger.error(f"Scanner error: {e}")
        return jsonify({"success": False, "error": "Processing failed", "details": str(e)}), 500


@app.route("/api/finance/detect-bill", methods=["POST"])
def detect_bill():
    """
    Lightweight endpoint: just detect if a bill is present in the frame.
    Used for live camera overlay (draw green border).
    Returns: { detected: bool, corners: [[x,y]×4] | null }
    """
    try:
        data = request.get_json(silent=True) or {}
        b64_input = data.get("image", "")
        if not b64_input:
            return jsonify({"detected": False, "corners": None})

        img = b64_to_cv(b64_input)
        contour = detect_document_contour(img)

        if contour is None:
            return jsonify({"detected": False, "corners": None})

        ordered = order_points(contour)
        corners = ordered.tolist()

        return jsonify({
            "detected": True,
            "corners": corners,
            "imageWidth": img.shape[1],
            "imageHeight": img.shape[0],
        })
    except Exception as e:
        return jsonify({"detected": False, "corners": None, "error": str(e)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
