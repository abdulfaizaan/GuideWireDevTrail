from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import xgboost as xgb
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

SEED = 42
RNG = np.random.default_rng(SEED)

app = FastAPI(title="GigShield AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


@app.get("/")
def home():
    return {
        "project": "GigShield AI Service",
        "status": "Running",
        "health_check": "/health",
        "predict_endpoint": "/predict",
        "docs": "/docs",
    }


def build_premium_features(
    zone_risk: np.ndarray,
    seasonal_risk: np.ndarray,
    risk_score: np.ndarray,
    weeks_active: np.ndarray,
    base_premium: np.ndarray,
) -> np.ndarray:
    normalized_risk = risk_score / 100.0
    loyalty = 1.0 / np.sqrt(weeks_active + 1.0)
    blended_pressure = zone_risk * 0.42 + seasonal_risk * 0.33 + normalized_risk * 0.25
    return np.column_stack(
        [
            zone_risk,
            seasonal_risk,
            normalized_risk,
            weeks_active,
            base_premium,
            zone_risk * seasonal_risk,
            zone_risk * normalized_risk,
            seasonal_risk * normalized_risk,
            blended_pressure,
            loyalty,
            np.log1p(weeks_active),
            base_premium / 149.0,
        ]
    )


def generate_premium_training_data(n_samples: int = 8000) -> tuple[np.ndarray, np.ndarray]:
    zone_risk = RNG.uniform(0.05, 0.98, n_samples)
    seasonal_risk = RNG.uniform(0.05, 0.95, n_samples)
    risk_score = RNG.uniform(10, 98, n_samples)
    weeks_active = RNG.integers(1, 156, n_samples)
    base_premium = RNG.choice([49.0, 89.0, 149.0], size=n_samples, p=[0.35, 0.45, 0.20])

    normalized_risk = risk_score / 100.0
    stability_bonus = np.clip(weeks_active / 104.0, 0.0, 1.2) * 0.12
    volatility_pressure = zone_risk * 0.40 + seasonal_risk * 0.34 + normalized_risk * 0.31
    target = (
        0.95
        + 0.70 * zone_risk
        + 0.48 * seasonal_risk
        + 0.42 * normalized_risk
        + 0.22 * zone_risk * seasonal_risk
        + 0.16 * seasonal_risk * normalized_risk
        + 0.10 * np.sqrt(base_premium / 49.0)
        - stability_bonus
        + 0.08 * np.maximum(0.0, volatility_pressure - 0.72)
        + RNG.normal(0.0, 0.035, n_samples)
    )
    target = np.clip(target, 1.0, 2.7)

    X = build_premium_features(zone_risk, seasonal_risk, risk_score, weeks_active, base_premium)
    return X, target


def train_premium_model() -> tuple[xgb.XGBRegressor, dict[str, float]]:
    X, y = generate_premium_training_data()
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=SEED)

    model = xgb.XGBRegressor(
        n_estimators=320,
        max_depth=5,
        learning_rate=0.045,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.2,
        reg_alpha=0.08,
        min_child_weight=2,
        random_state=SEED,
        objective="reg:squarederror",
    )
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

    predictions = model.predict(X_val)
    mae = float(mean_absolute_error(y_val, predictions))
    rmse = float(np.sqrt(np.mean((y_val - predictions) ** 2)))
    return model, {"mae": round(mae, 4), "rmse": round(rmse, 4), "samples": float(len(y))}


def build_fraud_features(
    claimed_rain: np.ndarray,
    actual_rain: np.ndarray,
    gps_speed: np.ndarray,
    user_trust_score: np.ndarray,
    is_blacklisted_zone: np.ndarray,
    historical_weather_risk: np.ndarray,
    historical_claim_frequency: np.ndarray,
    geographic_risk_rating: np.ndarray,
    vehicle_type: np.ndarray,
) -> np.ndarray:
    weather_diff = np.abs(claimed_rain - actual_rain)
    weather_ratio = claimed_rain / np.maximum(actual_rain + 1.0, 1.0)
    trust_inverse = 1.0 - (user_trust_score / 100.0)
    suspicious_speed = np.maximum(gps_speed - 55.0, 0.0) / 65.0
    severe_claim = (claimed_rain >= 25.0).astype(float)
    dry_oracle = (actual_rain <= 5.0).astype(float)
    low_trust_blacklisted = ((user_trust_score < 35.0) & (is_blacklisted_zone > 0.5)).astype(float)
    return np.column_stack(
        [
            claimed_rain,
            actual_rain,
            weather_diff,
            weather_ratio,
            gps_speed,
            user_trust_score,
            is_blacklisted_zone,
            suspicious_speed,
            severe_claim,
            dry_oracle,
            trust_inverse,
            low_trust_blacklisted,
            historical_weather_risk,
            weather_diff * suspicious_speed,
            weather_diff * trust_inverse,
            historical_weather_risk * dry_oracle,
            historical_claim_frequency,
            geographic_risk_rating,
            vehicle_type,
            geographic_risk_rating * historical_claim_frequency
        ]
    )


def generate_fraud_training_data(n_samples: int = 16000) -> tuple[np.ndarray, np.ndarray]:
    actual_rain = np.clip(RNG.gamma(shape=1.7, scale=7.0, size=n_samples), 0, 70)
    claimed_bias = RNG.normal(0.0, 6.5, n_samples)
    claimed_rain = np.clip(actual_rain + claimed_bias, 0, 95)
    gps_speed = np.clip(RNG.normal(32, 22, n_samples), 0, 140)
    user_trust_score = np.clip(RNG.normal(70, 18, n_samples), 5, 99)
    is_blacklisted_zone = RNG.binomial(1, 0.18, n_samples).astype(float)
    historical_weather_risk = RNG.uniform(0.1, 0.9, n_samples)
    historical_claim_frequency = RNG.integers(0, 5, n_samples).astype(float)
    geographic_risk_rating = RNG.uniform(0.1, 0.9, n_samples)
    vehicle_type = RNG.integers(1, 5, n_samples).astype(float) # 1: Bike, 2: Scooter, 3: Auto, 4: Car

    coordinated_idx = RNG.choice(n_samples, size=n_samples // 6, replace=False)
    claimed_rain[coordinated_idx] += RNG.uniform(12, 36, size=len(coordinated_idx))
    gps_speed[coordinated_idx] += RNG.uniform(18, 45, size=len(coordinated_idx))
    user_trust_score[coordinated_idx] -= RNG.uniform(15, 38, size=len(coordinated_idx))

    actual_rain = np.clip(actual_rain, 0, 70)
    claimed_rain = np.clip(claimed_rain, 0, 95)
    gps_speed = np.clip(gps_speed, 0, 140)
    user_trust_score = np.clip(user_trust_score, 5, 99)

    weather_diff = np.abs(claimed_rain - actual_rain)
    suspicious_speed = np.maximum(gps_speed - 60.0, 0.0)
    trust_penalty = np.maximum(42.0 - user_trust_score, 0.0)
    rain_overclaim = np.maximum(claimed_rain - actual_rain - 5.0, 0.0)

    fraud_signal = (
        -4.3
        + 0.11 * weather_diff
        + 0.055 * suspicious_speed
        + 1.35 * is_blacklisted_zone
        + 0.075 * trust_penalty
        + 0.095 * rain_overclaim
        + 0.85 * (1.0 - historical_weather_risk) * rain_overclaim # Low historical risk + overclaim = higher fraud chance
        + 0.70 * historical_claim_frequency # High past claims = higher fraud risk
        + 1.25 * geographic_risk_rating * (1.0 - (user_trust_score / 100.0))
        + 1.15 * ((weather_diff > 18) & (gps_speed > 68))
        + 1.30 * ((user_trust_score < 30) & (is_blacklisted_zone > 0))
        + 1.15 * ((claimed_rain > 32) & (actual_rain < 7))
    )
    fraud_probability = sigmoid(fraud_signal)
    fraud_probability = np.clip(fraud_probability + RNG.normal(0.0, 0.035, n_samples), 0.0, 1.0)
    labels = (fraud_probability > 0.52).astype(int)

    X = build_fraud_features(claimed_rain, actual_rain, gps_speed, user_trust_score, is_blacklisted_zone, historical_weather_risk, historical_claim_frequency, geographic_risk_rating, vehicle_type)
    return X, labels


def choose_best_threshold(probabilities: np.ndarray, labels: np.ndarray) -> float:
    precision, recall, thresholds = precision_recall_curve(labels, probabilities)
    if len(thresholds) == 0:
        return 0.5

    f1_scores = (2 * precision[:-1] * recall[:-1]) / np.maximum(precision[:-1] + recall[:-1], 1e-9)
    best_index = int(np.argmax(f1_scores))
    return float(clamp(thresholds[best_index], 0.35, 0.8))


def train_fraud_models() -> tuple[IsolationForest, RandomForestClassifier, float, dict[str, float]]:
    X, y = generate_fraud_training_data()
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)

    fraud_rate = max(float(y_train.mean()), 1e-6)
    scale_pos_weight = float((1.0 - fraud_rate) / fraud_rate)

    classifier = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight={0: 1.0, 1: scale_pos_weight},
        random_state=SEED,
        n_jobs=-1
    )
    classifier.fit(X_train, y_train)

    anomaly_model = IsolationForest(
        n_estimators=250,
        contamination=0.06,
        random_state=SEED,
    )
    anomaly_model.fit(X_train[y_train == 0])

    probabilities = classifier.predict_proba(X_val)[:, 1]
    threshold = choose_best_threshold(probabilities, y_val)
    predictions = (probabilities >= threshold).astype(int)

    metrics = {
        "auc": round(float(roc_auc_score(y_val, probabilities)), 4),
        "f1": round(float(f1_score(y_val, predictions)), 4),
        "precision": round(float(precision_score(y_val, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_val, predictions, zero_division=0)), 4),
        "threshold": round(float(threshold), 4),
        "samples": float(len(y)),
        "fraud_rate": round(float(y.mean()), 4),
    }
    return anomaly_model, classifier, threshold, metrics


premium_model, premium_metrics = train_premium_model()
iso_forest_model, xgb_fraud_model, fraud_threshold, fraud_metrics = train_fraud_models()


class PredictRequest(BaseModel):
    zone_risk: float = 0.5
    seasonal_risk: float = 0.4
    risk_score: float = 60.0
    weeks_active: int = 10
    base_premium: float = 49.0


class PredictResponse(BaseModel):
    multiplier: float
    final_premium: float
    risk_score: float


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "gigshield-ai",
        "models": {
            "premium_model": "XGBoostRegressor",
            "fraud_model": "RandomForestClassifier + IsolationForest",
        },
        "premium_metrics": premium_metrics,
        "fraud_metrics": fraud_metrics,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    features = build_premium_features(
        np.array([req.zone_risk], dtype=float),
        np.array([req.seasonal_risk], dtype=float),
        np.array([req.risk_score], dtype=float),
        np.array([req.weeks_active], dtype=float),
        np.array([req.base_premium], dtype=float),
    )
    multiplier = float(premium_model.predict(features)[0])
    multiplier = round(clamp(multiplier, 1.0, 2.5), 2)
    final_premium = round(req.base_premium * multiplier)

    risk = (
        req.zone_risk * 35
        + req.seasonal_risk * 30
        + (req.risk_score / 100.0) * 25
        + (1.0 / max(req.weeks_active, 1)) * 10
    )
    risk = round(clamp(risk, 0.0, 100.0), 1)

    return PredictResponse(
        multiplier=multiplier,
        final_premium=final_premium,
        risk_score=risk,
    )


class PredictFraudRequest(BaseModel):
    claimed_rain: float
    actual_rain: float
    gps_speed: float
    user_trust_score: float
    is_blacklisted_zone: int
    location: str = "Mumbai"
    historical_weather_risk: float = 0.5
    historical_claim_frequency: int = 0
    geographic_risk_rating: float = 0.5
    vehicle_type: int = 1


class PredictFraudResponse(BaseModel):
    is_fraud: bool
    fraud_probability: float
    is_anomaly: bool
    status: str
    reason: str


@app.post("/api/ml/predict-fraud", response_model=PredictFraudResponse)
def predict_fraud(req: PredictFraudRequest):
    features = build_fraud_features(
        np.array([req.claimed_rain], dtype=float),
        np.array([req.actual_rain], dtype=float),
        np.array([req.gps_speed], dtype=float),
        np.array([req.user_trust_score], dtype=float),
        np.array([float(req.is_blacklisted_zone)], dtype=float),
        np.array([req.historical_weather_risk], dtype=float),
        np.array([float(req.historical_claim_frequency)], dtype=float),
        np.array([req.geographic_risk_rating], dtype=float),
        np.array([float(req.vehicle_type)], dtype=float),
    )
    weather_diff = abs(req.claimed_rain - req.actual_rain)

    anomaly_prediction = iso_forest_model.predict(features)[0]
    is_anomaly = bool(anomaly_prediction == -1)

    classifier_probability = float(xgb_fraud_model.predict_proba(features)[0][1])
    anomaly_boost = 0.10 if is_anomaly else 0.0
    fraud_probability = clamp(classifier_probability + anomaly_boost, 0.0, 0.999)
    is_fraud = fraud_probability >= fraud_threshold or (is_anomaly and classifier_probability >= fraud_threshold - 0.06)

    reasons: list[str] = []
    if is_fraud:
        status = "REJECTED"
        if weather_diff > 18:
            reasons.append(f"High weather discrepancy ({req.claimed_rain}mm claimed vs {req.actual_rain}mm actual).")
        if req.gps_speed > 65:
            reasons.append(f"Impossible GPS movement detected ({req.gps_speed} km/h). Potential spoofing.")
        if req.user_trust_score < 30:
            reasons.append("Claim flagged due to critically low user trust score.")
        if req.is_blacklisted_zone:
            reasons.append("Claim originated from a previously flagged risk zone.")
        if is_anomaly:
            reasons.append("Submission pattern is an outlier compared to trained claim behaviour.")
        if not reasons:
            reasons.append("Claim flagged by the upgraded fraud ensemble.")
    else:
        status = "APPROVED"
        reasons.append("Claim verified successfully. Validation checks are within trained thresholds.")

    return PredictFraudResponse(
        is_fraud=is_fraud,
        fraud_probability=round(fraud_probability, 3),
        is_anomaly=is_anomaly,
        status=status,
        reason=" ".join(reasons),
    )
