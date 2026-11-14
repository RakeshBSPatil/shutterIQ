export const WEATHER_FACTORS = Object.freeze({
  clear: 1.0,
  cloudy: 1.03,
  rain: 1.2,
  heavy_rain: 1.45,
  fog: 1.25,
});

export const INCIDENT_FACTORS = Object.freeze({
  none: 1.0,
  minor_accident: 1.15,
  road_closure: 1.35,
});

// Illustrative 24-hour urban traffic congestion multipliers (00:00 .. 23:00),
// peaking during morning (08:00) and evening (18:00) commute windows.
export const HOURLY_CONGESTION = Object.freeze([
  1.0,  // 00:00
  1.0,  // 01:00
  1.0,  // 02:00
  1.0,  // 03:00
  1.02, // 04:00
  1.06, // 05:00
  1.18, // 06:00
  1.38, // 07:00
  1.55, // 08:00 (morning peak)
  1.42, // 09:00
  1.22, // 10:00
  1.18, // 11:00
  1.24, // 12:00
  1.2,  // 13:00
  1.18, // 14:00
  1.25, // 15:00
  1.36, // 16:00
  1.5,  // 17:00
  1.58, // 18:00 (evening peak)
  1.44, // 19:00
  1.25, // 20:00
  1.14, // 21:00
  1.06, // 22:00
  1.02, // 23:00
]);

/**
 * Linearly interpolates the congestion multiplier at an arbitrary minute of day.
 * Wraps cleanly across midnight.
 */
export function getCongestionMultiplier(minutesFromMidnight) {
  const normalized = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const hourFloat = normalized / 60;
  const h0 = Math.floor(hourFloat) % 24;
  const h1 = (h0 + 1) % 24;
  const frac = hourFloat - Math.floor(hourFloat);
  return HOURLY_CONGESTION[h0] * (1 - frac) + HOURLY_CONGESTION[h1] * frac;
}

/**
 * Standard normal cumulative distribution function Phi(z)
 * using Abramowitz & Stegun formula 7.1.26 (max error ~1.5e-7).
 */
export function normalCDF(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t);
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

// Inverse normal CDF quantiles used for p80 (~0.84162) and 15% risk threshold (~1.03643)
const Z_P80 = 0.8416212335729143;
const Z_P85 = 1.0364333894937898;

/**
 * Predicts arrival-lateness risk for a scheduled route.
 * Models trip duration ~ Normal(planned, sigma), where:
 *   sigma = duration * (0.10 + 0.5*(weather-1) + 0.6*(incident-1) + 0.12*(congestion-1))
 * Lateness probability = P(delay > bufferMin).
 */
export function predictRouteRisk({
  durationMin,
  bufferMin = 10,
  weather = 'clear',
  incident = 'none',
  avgCongestion = 1.0,
}) {
  const safeDuration = Math.max(0, Number(durationMin) || 0);
  const safeBuffer = Math.max(0, Number(bufferMin) || 0);
  const weatherFactor = WEATHER_FACTORS[weather] ?? 1.0;
  const incidentFactor = INCIDENT_FACTORS[incident] ?? 1.0;
  const congestionFactor = Math.max(1.0, Number(avgCongestion) || 1.0);

  if (safeDuration === 0) {
    return {
      score: 0,
      level: 'low',
      sigmaMin: 0,
      p80DelayMin: 0,
      suggestedExtraBufferMin: 0,
      factors: ['No active stops on this route'],
    };
  }

  const volatility =
    0.1 +
    0.5 * (weatherFactor - 1) +
    0.6 * (incidentFactor - 1) +
    0.12 * (congestionFactor - 1);

  const sigma = safeDuration * volatility;
  const probLate = sigma > 0 ? 1 - normalCDF(safeBuffer / sigma) : 0;
  const score = Number(Math.min(99.9, Math.max(0, probLate * 100)).toFixed(1));

  let level = 'low';
  if (score >= 35) {
    level = 'high';
  } else if (score >= 15) {
    level = 'medium';
  }

  const p80DelayMin = Number((Z_P80 * sigma).toFixed(1));
  const targetBufferForLowRisk = Z_P85 * sigma;
  const suggestedExtraBufferMin = Math.max(
    0,
    Math.ceil(targetBufferForLowRisk - safeBuffer)
  );

  const factors = [];
  if (weatherFactor > 1.05) {
    factors.push(
      `Weather (${weather.replace('_', ' ')}) adds ${Math.round((weatherFactor - 1) * 100)}% travel time and raises variance`
    );
  }
  if (incidentFactor > 1.0) {
    factors.push(
      `Traffic incident (${incident.replace('_', ' ')}) increases route volatility`
    );
  }
  if (congestionFactor >= 1.25) {
    factors.push(
      `Peak corridor congestion (${congestionFactor.toFixed(2)}x baseline delay)`
    );
  }
  if (safeDuration >= 40) {
    factors.push(
      `Longer route duration (${Math.round(safeDuration)} min) compounds delay spread`
    );
  }
  if (suggestedExtraBufferMin > 0) {
    factors.push(
      `Current ${safeBuffer} min buffer is tight against p80 delay (${p80DelayMin} min); +${suggestedExtraBufferMin} min recommended`
    );
  } else {
    factors.push(
      `${safeBuffer} min buffer covers 80th-percentile delay (${p80DelayMin} min)`
    );
  }

  return {
    score,
    level,
    sigmaMin: Number(sigma.toFixed(2)),
    p80DelayMin,
    suggestedExtraBufferMin,
    factors,
  };
}
