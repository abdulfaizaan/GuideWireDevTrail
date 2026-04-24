"""
GigShield AI Service v2.0 — Production ML Scoring Engine
=========================================================
Endpoints:
  POST /predict-premium   → dynamic premium multiplier (XGBoost)
  POST /predict-fraud     → fraud probability (RandomForest + IsolationForest)
  POST /predict-risk      → multi-factor risk score
  GET  /health            → model metrics & status
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import numpy as np
import xgboost as xgb
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from datetime import datetime

SEED = 42
RNG = np.random.default_rng(SEED)

app = FastAPI(title="GigShield AI Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Lookup Tables ─────────────────────────────────────────────────────────────
CITY_RISK: dict[str, float] = {
    "delhi": 0.82, "mumbai": 0.68, "kolkata": 0.72, "chennai": 0.58,
    "bangalore": 0.45, "hyderabad": 0.50, "pune": 0.42, "jaipur": 0.55,
    "lucknow": 0.60, "chandigarh": 0.48, "gurugram": 0.70, "noida": 0.72,
}
PROFESSION_RISK: dict[str, float] = {
    "delivery_rider": 0.75, "cab_driver": 0.60, "auto_driver": 0.65,
    "freelancer": 0.35, "street_vendor": 0.70, "construction": 0.80, "other": 0.50,
}
PROFESSION_INCOME: dict[str, float] = {
    "delivery_rider": 900, "cab_driver": 1200, "auto_driver": 800,
    "freelancer": 1500, "street_vendor": 600, "construction": 700, "other": 800,
}
SEASON_INDEX: dict[int, float] = {
    1: 0.35, 2: 0.30, 3: 0.40, 4: 0.50, 5: 0.55, 6: 0.80,
    7: 0.95, 8: 0.90, 9: 0.85, 10: 0.60, 11: 0.55, 12: 0.45,
}


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


# ═══════════════════════════════════════════════════════════════════════════════
# PREMIUM MODEL (XGBoost Regressor)
# ═══════════════════════════════════════════════════════════════════════════════
def build_premium_features(
    zone_risk: np.ndarray, seasonal_risk: np.ndarray, risk_score: np.ndarray,
    weeks_active: np.ndarray, base_premium: np.ndarray,
) -> np.ndarray:
    normalized_risk = risk_score / 100.0
    loyalty = 1.0 / np.sqrt(weeks_active + 1.0)
    blended = zone_risk * 0.42 + seasonal_risk * 0.33 + normalized_risk * 0.25
    return np.column_stack([
        zone_risk, seasonal_risk, normalized_risk, weeks_active, base_premium,
        zone_risk * seasonal_risk, zone_risk * normalized_risk,
        seasonal_risk * normalized_risk, blended, loyalty,
        np.log1p(weeks_active), base_premium / 149.0,
    ])


def generate_premium_data(n: int = 8000):
    zr = RNG.uniform(0.05, 0.98, n)
    sr = RNG.uniform(0.05, 0.95, n)
    rs = RNG.uniform(10, 98, n)
    wa = RNG.integers(1, 156, n)
    bp = RNG.choice([49.0, 89.0, 149.0], size=n, p=[0.35, 0.45, 0.20])
    nr = rs / 100.0
    sb = np.clip(wa / 104.0, 0.0, 1.2) * 0.12
    vp = zr * 0.40 + sr * 0.34 + nr * 0.31
    y = (0.95 + 0.70 * zr + 0.48 * sr + 0.42 * nr + 0.22 * zr * sr
         + 0.16 * sr * nr + 0.10 * np.sqrt(bp / 49.0) - sb
         + 0.08 * np.maximum(0.0, vp - 0.72) + RNG.normal(0, 0.035, n))
    return build_premium_features(zr, sr, rs, wa, bp), np.clip(y, 1.0, 2.7)


def train_premium_model():
    X, y = generate_premium_data()
    Xt, Xv, yt, yv = train_test_split(X, y, test_size=0.2, random_state=SEED)
    m = xgb.XGBRegressor(
        n_estimators=320, max_depth=5, learning_rate=0.045,
        subsample=0.9, colsample_bytree=0.9, reg_lambda=1.2,
        reg_alpha=0.08, min_child_weight=2, random_state=SEED,
    )
    m.fit(Xt, yt, eval_set=[(Xv, yv)], verbose=False)
    p = m.predict(Xv)
    mae = float(mean_absolute_error(yv, p))
    rmse = float(np.sqrt(np.mean((yv - p) ** 2)))
    return m, {"mae": round(mae, 4), "rmse": round(rmse, 4), "samples": len(y)}


# ═══════════════════════════════════════════════════════════════════════════════
# FRAUD MODEL (RandomForest + IsolationForest)
# ═══════════════════════════════════════════════════════════════════════════════
def build_fraud_features(
    claimed_rain, actual_rain, gps_speed, trust, blacklisted,
    hist_weather, hist_claims, geo_risk, vehicle,
) -> np.ndarray:
    wd = np.abs(claimed_rain - actual_rain)
    wr = claimed_rain / np.maximum(actual_rain + 1.0, 1.0)
    ti = 1.0 - (trust / 100.0)
    ss = np.maximum(gps_speed - 55.0, 0.0) / 65.0
    sc = (claimed_rain >= 25.0).astype(float)
    do = (actual_rain <= 5.0).astype(float)
    ltb = ((trust < 35.0) & (blacklisted > 0.5)).astype(float)
    return np.column_stack([
        claimed_rain, actual_rain, wd, wr, gps_speed, trust, blacklisted,
        ss, sc, do, ti, ltb, hist_weather, wd * ss, wd * ti,
        hist_weather * do, hist_claims, geo_risk, vehicle, geo_risk * hist_claims,
    ])


def generate_fraud_data(n: int = 16000):
    ar = np.clip(RNG.gamma(1.7, 7.0, n), 0, 70)
    cr = np.clip(ar + RNG.normal(0, 6.5, n), 0, 95)
    gs = np.clip(RNG.normal(32, 22, n), 0, 140)
    ts = np.clip(RNG.normal(70, 18, n), 5, 99)
    bz = RNG.binomial(1, 0.18, n).astype(float)
    hw = RNG.uniform(0.1, 0.9, n)
    hc = RNG.integers(0, 5, n).astype(float)
    gr = RNG.uniform(0.1, 0.9, n)
    vt = RNG.integers(1, 5, n).astype(float)

    idx = RNG.choice(n, size=n // 6, replace=False)
    cr[idx] += RNG.uniform(12, 36, len(idx))
    gs[idx] += RNG.uniform(18, 45, len(idx))
    ts[idx] -= RNG.uniform(15, 38, len(idx))
    cr = np.clip(cr, 0, 95); gs = np.clip(gs, 0, 140); ts = np.clip(ts, 5, 99)

    wd = np.abs(cr - ar)
    sig = (-4.3 + 0.11 * wd + 0.055 * np.maximum(gs - 60, 0)
           + 1.35 * bz + 0.075 * np.maximum(42 - ts, 0)
           + 0.095 * np.maximum(cr - ar - 5, 0)
           + 0.85 * (1 - hw) * np.maximum(cr - ar - 5, 0)
           + 0.70 * hc + 1.25 * gr * (1 - ts / 100)
           + 1.15 * ((wd > 18) & (gs > 68))
           + 1.30 * ((ts < 30) & (bz > 0))
           + 1.15 * ((cr > 32) & (ar < 7)))
    fp = np.clip(sigmoid(sig) + RNG.normal(0, 0.035, n), 0, 1)
    labels = (fp > 0.52).astype(int)
    return build_fraud_features(cr, ar, gs, ts, bz, hw, hc, gr, vt), labels


def best_threshold(probs, labels):
    prec, rec, thr = precision_recall_curve(labels, probs)
    if len(thr) == 0:
        return 0.5
    f1 = (2 * prec[:-1] * rec[:-1]) / np.maximum(prec[:-1] + rec[:-1], 1e-9)
    return float(clamp(thr[int(np.argmax(f1))], 0.35, 0.8))


def train_fraud_models():
    X, y = generate_fraud_data()
    Xt, Xv, yt, yv = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    fr = max(float(yt.mean()), 1e-6)
    clf = RandomForestClassifier(
        n_estimators=300, max_depth=12, min_samples_split=4, min_samples_leaf=2,
        class_weight={0: 1.0, 1: (1 - fr) / fr}, random_state=SEED, n_jobs=-1,
    )
    clf.fit(Xt, yt)
    iso = IsolationForest(n_estimators=250, contamination=0.06, random_state=SEED)
    iso.fit(Xt[yt == 0])
    probs = clf.predict_proba(Xv)[:, 1]
    thr = best_threshold(probs, yv)
    preds = (probs >= thr).astype(int)
    metrics = {
        "auc": round(float(roc_auc_score(yv, probs)), 4),
        "f1": round(float(f1_score(yv, preds)), 4),
        "precision": round(float(precision_score(yv, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(yv, preds, zero_division=0)), 4),
        "threshold": round(thr, 4),
        "fraud_rate": round(float(y.mean()), 4),
    }
    return iso, clf, thr, metrics


# ── Train at startup ──────────────────────────────────────────────────────────
premium_model, premium_metrics = train_premium_model()
iso_forest, fraud_clf, fraud_thr, fraud_metrics = train_fraud_models()


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
def health():
    return {
        "status": "ok", "service": "gigshield-ai", "version": "2.0.0",
        "models": {"premium": "XGBoostRegressor", "fraud": "RF+IsolationForest"},
        "premium_metrics": premium_metrics,
        "fraud_metrics": fraud_metrics,
    }


# ── Premium Prediction ────────────────────────────────────────────────────────
class PremiumRequest(BaseModel):
    zone_risk: float = 0.5
    seasonal_risk: float = 0.4
    risk_score: float = 60.0
    weeks_active: int = 10
    base_premium: float = 49.0
    city: str = "mumbai"
    profession: str = "delivery_rider"
    season_override: float | None = None

class PremiumResponse(BaseModel):
    multiplier: float
    final_premium: float
    risk_score: float
    season_factor: float
    city_risk: float
    profession_risk: float


@app.post("/predict-premium", response_model=PremiumResponse)
@app.post("/predict", response_model=PremiumResponse)
def predict_premium(req: PremiumRequest):
    city_r = CITY_RISK.get(req.city.lower().strip(), 0.50)
    prof_r = PROFESSION_RISK.get(req.profession.lower().strip(), 0.50)
    season = req.season_override if req.season_override is not None else SEASON_INDEX.get(datetime.now().month, 0.5)

    effective_zone = clamp(req.zone_risk * 0.5 + city_r * 0.3 + prof_r * 0.2, 0.05, 0.98)
    effective_season = clamp(req.seasonal_risk * 0.6 + season * 0.4, 0.05, 0.95)

    features = build_premium_features(
        np.array([effective_zone]), np.array([effective_season]),
        np.array([req.risk_score]), np.array([req.weeks_active], dtype=float),
        np.array([req.base_premium]),
    )
    mult = round(clamp(float(premium_model.predict(features)[0]), 1.0, 2.5), 2)
    risk = round(clamp(
        effective_zone * 35 + effective_season * 30 + (req.risk_score / 100) * 25
        + (1 / max(req.weeks_active, 1)) * 10, 0, 100
    ), 1)
    return PremiumResponse(
        multiplier=mult, final_premium=round(req.base_premium * mult),
        risk_score=risk, season_factor=round(season, 3),
        city_risk=city_r, profession_risk=prof_r,
    )


# ── Fraud Prediction ──────────────────────────────────────────────────────────
class FraudRequest(BaseModel):
    claimed_rain: float
    actual_rain: float
    gps_speed: float
    user_trust_score: float
    is_blacklisted_zone: int = 0
    location: str = "Mumbai"
    historical_weather_risk: float = 0.5
    historical_claim_frequency: int = 0
    geographic_risk_rating: float = 0.5
    vehicle_type: int = 1
    device_fingerprint_hash: str | None = None
    rapid_claim_count_24h: int = 0
    payout_account_age_days: int = 90

class FraudResponse(BaseModel):
    is_fraud: bool
    fraud_probability: float
    is_anomaly: bool
    status: str
    reason: str
    classification: str  # AUTO_APPROVE, REVIEW, HOLD


@app.post("/predict-fraud", response_model=FraudResponse)
@app.post("/api/ml/predict-fraud", response_model=FraudResponse)
def predict_fraud(req: FraudRequest):
    features = build_fraud_features(
        np.array([req.claimed_rain]), np.array([req.actual_rain]),
        np.array([req.gps_speed]), np.array([req.user_trust_score]),
        np.array([float(req.is_blacklisted_zone)]),
        np.array([req.historical_weather_risk]),
        np.array([float(req.historical_claim_frequency)]),
        np.array([req.geographic_risk_rating]),
        np.array([float(req.vehicle_type)]),
    )

    is_anomaly = bool(iso_forest.predict(features)[0] == -1)
    clf_prob = float(fraud_clf.predict_proba(features)[0][1])
    boost = 0.10 if is_anomaly else 0.0

    # V2 fraud signals
    if req.rapid_claim_count_24h >= 3:
        boost += 0.15
    if req.payout_account_age_days < 7:
        boost += 0.10

    fraud_prob = clamp(clf_prob + boost, 0.0, 0.999)
    is_fraud = fraud_prob >= fraud_thr or (is_anomaly and clf_prob >= fraud_thr - 0.06)

    # 3-tier classification
    if fraud_prob < 0.4:
        classification = "AUTO_APPROVE"
    elif fraud_prob < 0.7:
        classification = "REVIEW"
    else:
        classification = "HOLD"

    reasons: list[str] = []
    wd = abs(req.claimed_rain - req.actual_rain)
    if is_fraud:
        status = "REJECTED"
        if wd > 18:
            reasons.append(f"Weather discrepancy: {req.claimed_rain}mm claimed vs {req.actual_rain}mm actual.")
        if req.gps_speed > 65:
            reasons.append(f"GPS anomaly: {req.gps_speed} km/h movement detected.")
        if req.user_trust_score < 30:
            reasons.append("Critically low trust score.")
        if req.is_blacklisted_zone:
            reasons.append("Flagged risk zone.")
        if is_anomaly:
            reasons.append("Behavioral outlier detected.")
        if req.rapid_claim_count_24h >= 3:
            reasons.append(f"Rapid repeat claims: {req.rapid_claim_count_24h} in 24h.")
        if req.payout_account_age_days < 7:
            reasons.append("New payout account (<7 days).")
        if not reasons:
            reasons.append("Flagged by ensemble model.")
    else:
        status = "APPROVED"
        reasons.append("Claim verified. All checks within thresholds.")

    return FraudResponse(
        is_fraud=is_fraud, fraud_probability=round(fraud_prob, 3),
        is_anomaly=is_anomaly, status=status,
        reason=" ".join(reasons), classification=classification,
    )


# ── Risk Score Prediction ─────────────────────────────────────────────────────
class RiskRequest(BaseModel):
    city: str = "mumbai"
    profession: str = "delivery_rider"
    claims_history_count: int = 0
    device_trust: float = 80.0
    payment_consistency: float = 90.0
    pincode: str | None = None

class RiskResponse(BaseModel):
    risk_score: int
    tier: str
    factors: dict
    daily_income_baseline: float
    recommended_plan: str
    recommended_premium: float


@app.post("/predict-risk", response_model=RiskResponse)
def predict_risk(req: RiskRequest):
    city_r = CITY_RISK.get(req.city.lower().strip(), 0.50)
    prof_r = PROFESSION_RISK.get(req.profession.lower().strip(), 0.50)
    income = PROFESSION_INCOME.get(req.profession.lower().strip(), 800)
    season = SEASON_INDEX.get(datetime.now().month, 0.5)

    claims_penalty = min(req.claims_history_count * 8, 30)
    device_factor = (100 - req.device_trust) * 0.15
    payment_factor = (100 - req.payment_consistency) * 0.10

    raw = (city_r * 30 + prof_r * 25 + season * 15
           + claims_penalty + device_factor + payment_factor)
    score = int(clamp(raw, 5, 98))

    tier = "low" if score <= 40 else "medium" if score <= 70 else "high"
    plan = "Basic" if tier == "low" else "Standard" if tier == "medium" else "Premium"
    premiums = {"Basic": 49, "Standard": 89, "Premium": 149}

    return RiskResponse(
        risk_score=score, tier=tier,
        factors={
            "city_risk": round(city_r, 2), "profession_risk": round(prof_r, 2),
            "season": round(season, 2), "claims_penalty": claims_penalty,
            "device_trust": round(device_factor, 2),
            "payment_consistency": round(payment_factor, 2),
        },
        daily_income_baseline=income,
        recommended_plan=plan,
        recommended_premium=premiums[plan],
    )
