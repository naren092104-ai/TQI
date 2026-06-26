#!/usr/bin/env python3
"""
TQI Bill Scanner — Google Drive style receipt detection
Input:  stdin = base64 jpeg
Output: stdout = JSON {success, processed, width, height}
"""
import sys, base64, json, io, math
import numpy as np
from PIL import Image, ImageEnhance

def to_base64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=97, optimize=False)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def order_points(pts):
    pts = np.array(pts, dtype="float32")
    s = pts.sum(axis=1)
    rect = np.zeros((4, 2), dtype="float32")
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[2] = pts[np.argmax(s)]   # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # top-right
    rect[3] = pts[np.argmax(diff)] # bottom-left
    return rect

def four_point_transform(img_np, pts):
    rect = order_points(pts)
    tl, tr, br, bl = rect
    wA = np.linalg.norm(br - bl)
    wB = np.linalg.norm(tr - tl)
    W = max(int(wA), int(wB))
    hA = np.linalg.norm(tr - br)
    hB = np.linalg.norm(tl - bl)
    H = max(int(hA), int(hB))
    if W < 10 or H < 10:
        return None
    dst = np.array([[0,0],[W-1,0],[W-1,H-1],[0,H-1]], dtype="float32")
    try:
        import cv2
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(img_np, M, (W, H))
        return warped
    except Exception:
        return None

def process_with_opencv(img_np):
    try:
        import cv2
        h, w = img_np.shape[:2]
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        v = np.median(blurred)
        lo, hi = int(max(0, 0.6*v)), int(min(255, 1.4*v))
        edges = cv2.Canny(blurred, lo, hi)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
        dilated = cv2.dilate(edges, kernel, iterations=2)
        cnts, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:10]
        doc_cnt = None
        for c in cnts:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02*peri, True)
            if len(approx) == 4 and cv2.contourArea(approx) > 0.08*h*w:
                doc_cnt = approx.reshape(4,2).astype("float32")
                break
        if doc_cnt is not None:
            warped = four_point_transform(img_np, doc_cnt)
            if warped is not None:
                result = warped
            else:
                result = img_np
        else:
            result = img_np
        # Auto-rotate if landscape
        rh, rw = result.shape[:2]
        if rw > rh * 1.3:
            result = cv2.rotate(result, cv2.ROTATE_90_CLOCKWISE)
        # Enhance
        pil = Image.fromarray(result)
        pil = ImageEnhance.Contrast(pil).enhance(1.1)
        pil = ImageEnhance.Sharpness(pil).enhance(1.2)
        return pil
    except ImportError:
        return None

def process_pil_only(img: Image.Image) -> Image.Image:
    """Fallback when OpenCV not available — just enhance"""
    img = ImageEnhance.Contrast(img).enhance(1.1)
    img = ImageEnhance.Sharpness(img).enhance(1.2)
    return img

def main():
    try:
        b64 = sys.stdin.read().strip()
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        img_bytes = base64.b64decode(b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_np = np.array(img)

        result_img = None
        # Try OpenCV first
        result_np = process_with_opencv(img_np)
        if result_np is not None:
            result_img = result_np
        else:
            result_img = process_pil_only(img)

        if isinstance(result_img, np.ndarray):
            out_pil = Image.fromarray(result_img)
        else:
            out_pil = result_img

        w, h = out_pil.size
        print(json.dumps({
            "success": True,
            "processed": to_base64(out_pil),
            "width": w,
            "height": h,
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
