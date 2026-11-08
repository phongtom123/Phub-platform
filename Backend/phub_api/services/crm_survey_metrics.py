"""Survey reporting based on actual satisfaction answers, never inferred categories."""
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException


def _mean(scores):
    return sum(map(Decimal, scores)) / len(scores) if scores else None


def survey_insights(surveys, responses):
    all_scores, feedbacks = [], []
    rated_responses = 0
    for response in responses:
        scores, comments = [], []
        for answer in response.get("answers", []):
            if answer.get("noi_dung"):
                comments.append(answer["noi_dung"])
            if answer.get("nhom_noi_dung") != "HAI_LONG" or answer.get("loai_cau_hoi") != "DIEM_1_5":
                continue
            score = answer.get("diem")
            if score is None:
                continue
            if type(score) is not int or not 1 <= score <= 5:
                raise HTTPException(502, "Dữ liệu điểm khảo sát không hợp lệ. Không hiển thị điểm thay thế.")
            scores.append(score)
        all_scores.extend(scores)
        rated_responses += bool(scores)
        mean = _mean(scores)
        feedbacks.append({
            "customer_name": response.get("ten_nguoi_gui") or "Khách hàng",
            "overall_score": float(mean) if mean is not None else None,
            # Current schema distinguishes HAI_LONG, SO_THICH and CHUNG only.
            "product_score": None, "service_score": None,
            "comment": "\n".join(comments) or None,
            "created_at": str(response.get("ngay_gui") or "")[:10],
            "_time": str(response.get("ngay_gui") or ""),
            "_id": str(response.get("ma_bai_nop") or ""),
        })
    counts = Counter(all_scores)
    mean = _mean(all_scores)
    feedbacks.sort(key=lambda item: (item["_time"], item["_id"]), reverse=True)
    recent = [{k: v for k, v in item.items() if not k.startswith("_")} for item in feedbacks[:6]]
    return {
        "total_surveys": len(surveys), "total_responses": len(responses),
        "rated_responses": rated_responses, "total_ratings": len(all_scores),
        "avg_overall_score": float(mean.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)) if mean is not None else None,
        "avg_product_score": None, "avg_service_score": None,
        "rating_breakdown": [
            {"stars": score, "count": counts[score],
             "percentage": round(counts[score] / len(all_scores) * 100, 1) if all_scores else 0.0}
            for score in (5, 4, 3, 2, 1)
        ],
        "recent_feedbacks": recent,
    }
