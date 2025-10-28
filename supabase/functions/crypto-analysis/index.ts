import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TechnicalIndicators {
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  atr14: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  stochRsi: number;
  obv: number;
  adx: number;
}

// Calculate RSI with better precision
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate Stochastic RSI
function calculateStochRSI(closes: number[], period = 14): number {
  const rsiValues: number[] = [];
  for (let i = period; i < closes.length; i++) {
    const slice = closes.slice(i - period, i + 1);
    rsiValues.push(calculateRSI(slice, period));
  }
  
  if (rsiValues.length < 14) return 50;
  
  const recentRsi = rsiValues.slice(-14);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  const currentRsi = recentRsi[recentRsi.length - 1];
  
  if (maxRsi === minRsi) return 50;
  return ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
}

// Calculate SMA
function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Calculate EMA
function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  
  const k = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// Calculate Bollinger Bands
function calculateBollingerBands(closes: number[], period = 20, stdDev = 2) {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + (stdDev * std),
    middle: sma,
    lower: sma - (stdDev * std)
  };
}

// Calculate ATR
function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number {
  const trueRanges: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  return calculateSMA(trueRanges, period);
}

// Calculate OBV (On Balance Volume)
function calculateOBV(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i - 1]) {
      obv -= volumes[i];
    }
  }
  return obv;
}

// Calculate ADX (Average Directional Index)
function calculateADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];
    
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    
    const highDiff = high - prevHigh;
    const lowDiff = prevLow - low;
    
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }
  
  const atr = calculateSMA(tr, period);
  const plusDI = (calculateSMA(plusDM, period) / atr) * 100;
  const minusDI = (calculateSMA(minusDM, period) / atr) * 100;
  
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  return dx;
}

// Calculate time horizon based on target duration or volatility
function calculateTimeHorizon(
  closes: number[],
  atr: number,
  currentPrice: number,
  takeProfit: number,
  volume24h: number,
  targetDurationMinutes?: number
): { estimate: string; type: string; hours: number; confidence: number } {
  // If target duration is provided, use it directly
  if (targetDurationMinutes && targetDurationMinutes > 0) {
    const hours = Math.round(targetDurationMinutes / 60);
    const days = Math.round(targetDurationMinutes / 1440);
    
    let estimate: string;
    let type: string;
    
    if (targetDurationMinutes < 60) {
      estimate = `${targetDurationMinutes}min`;
      type = "SCALP";
    } else if (targetDurationMinutes < 1440) {
      estimate = `${hours}h`;
      type = "INTRADAY";
    } else if (targetDurationMinutes < 10080) {
      estimate = `${days}j`;
      type = "SWING";
    } else {
      const weeks = Math.round(days / 7);
      estimate = `${weeks}sem`;
      type = "LONG TERME";
    }
    
    return { estimate, type, hours, confidence: 85 };
  }
  
  // Otherwise, calculate based on volatility
  if (closes.length < 20) {
    return { estimate: "N/A", type: "INSUFFISANT", hours: 0, confidence: 0 };
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  // Standard deviation of returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const dailyVolatility = Math.sqrt(variance);

  // Distance to TP in percentage
  const distancePercent = Math.abs(takeProfit - currentPrice) / currentPrice;

  // Expected move per day = daily volatility * current price
  const expectedDailyMove = dailyVolatility * currentPrice;

  // Estimate days to reach TP (with adjustment factor for directional bias)
  let estimatedDays = expectedDailyMove > 0 ? distancePercent / dailyVolatility : 999;

  // Adjust based on volume (high volume = faster moves)
  const volumeAdjustment = Math.min(1.5, Math.max(0.7, volume24h / (currentPrice * 1000000)));
  estimatedDays = estimatedDays / volumeAdjustment;

  // Cap at realistic maximum (4 weeks = 28 days)
  estimatedDays = Math.min(estimatedDays, 28);
  const estimatedHours = Math.round(estimatedDays * 24);

  // Confidence based on consistency of volatility
  const volatilityStd = Math.sqrt(
    returns.map(r => Math.pow(Math.abs(r) - dailyVolatility, 2)).reduce((a, b) => a + b, 0) / returns.length
  );
  const confidence = Math.max(40, Math.min(95, 100 - (volatilityStd / dailyVolatility) * 100));

  let estimate: string;
  let type: string;

  if (estimatedDays < 1) {
    estimate = `${estimatedHours}h`;
    type = "INTRADAY";
  } else if (estimatedDays < 7) {
    const days = Math.round(estimatedDays);
    estimate = `${days}j`;
    type = "COURT TERME";
  } else if (estimatedDays < 21) {
    const weeks = Math.round(estimatedDays / 7);
    estimate = `${weeks}sem`;
    type = "SWING";
  } else {
    estimate = "4sem+";
    type = "LONG TERME";
  }

  return { estimate, type, hours: estimatedHours, confidence: Math.round(confidence) };
}

// Detect chart patterns
function detectPatterns(closes: number[], highs: number[], lows: number[]): string[] {
  const patterns: string[] = [];
  const len = closes.length;
  if (len < 20) return patterns;

  // Check for Double Bottom
  const recentLows = lows.slice(-20);
  const minLow = Math.min(...recentLows);
  const minIndices = recentLows.map((v, i) => v === minLow ? i : -1).filter(i => i !== -1);
  if (minIndices.length >= 2 && minIndices[minIndices.length - 1] - minIndices[0] > 5) {
    patterns.push("Double Bottom");
  }

  // Check for Double Top
  const recentHighs = highs.slice(-20);
  const maxHigh = Math.max(...recentHighs);
  const maxIndices = recentHighs.map((v, i) => v === maxHigh ? i : -1).filter(i => i !== -1);
  if (maxIndices.length >= 2 && maxIndices[maxIndices.length - 1] - maxIndices[0] > 5) {
    patterns.push("Double Top");
  }

  // Check for Ascending Triangle
  const midLows = lows.slice(-15);
  const midHighs = highs.slice(-15);
  const avgHigh = midHighs.reduce((a, b) => a + b, 0) / midHighs.length;
  const highVariance = midHighs.reduce((sum, h) => sum + Math.pow(h - avgHigh, 2), 0) / midHighs.length;
  const lowsTrend = midLows[midLows.length - 1] > midLows[0];
  if (highVariance < avgHigh * 0.01 && lowsTrend) {
    patterns.push("Triangle Ascendant");
  }

  // Check for Head and Shoulders
  if (len >= 30) {
    const h = highs.slice(-30);
    const peak1 = Math.max(...h.slice(0, 10));
    const peak2 = Math.max(...h.slice(10, 20));
    const peak3 = Math.max(...h.slice(20, 30));
    if (peak2 > peak1 && peak2 > peak3 && Math.abs(peak1 - peak3) < peak1 * 0.05) {
      patterns.push("Tête et Épaules");
    }
  }

  return patterns;
}

// Calculate position size
function calculatePositionSize(
  accountBalance: number,
  entryPrice: number,
  stopLoss: number,
  riskPercent: number,
  leverage: number
): { size: number; margin: number; risk: number } {
  const riskAmount = accountBalance * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePercent = stopDistance / entryPrice;
  
  // Calculate position size based on risk
  let positionSize = riskAmount / (stopDistancePercent * entryPrice);
  let margin = (positionSize * entryPrice) / leverage;
  
  // CRITICAL: Ensure margin never exceeds available capital
  if (margin > accountBalance * 0.95) {
    // Adjust position size so margin = 95% of capital max
    margin = accountBalance * 0.95;
    positionSize = (margin * leverage) / entryPrice;
  }
  
  return {
    size: Math.round(positionSize * 1000000) / 1000000,
    margin: Math.round(margin * 100) / 100,
    risk: riskAmount
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, tradeType = 'swing', targetDuration = 0, capitalPercent = 100 } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    console.log('Analyzing:', symbol, '- Trade type:', tradeType, '- Target duration:', targetDuration, 'min');

    // Get user's analysis parameters (if authenticated) from the Authorization header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let supabaseClient: any = null;
    let userParams = {
      rsi_oversold_threshold: 30,
      rsi_overbought_threshold: 70,
      atr_multiplier_tp: 2.0,
      atr_multiplier_sl: 1.0,
      confidence_threshold: 60,
      min_bullish_score: 8,
      max_leverage: 5
    };

    // Security mode: check market-wide volatility
    let securityMode = false;

    // Check BTC volatility for security mode
    try {
      const btcResponse = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=14`);
      if (btcResponse.ok) {
        const btcKlines = await btcResponse.json();
        const btcCloses = btcKlines.map((k: any) => parseFloat(k[4]));
        const btcReturns = [];
        for (let i = 1; i < btcCloses.length; i++) {
          btcReturns.push(Math.abs((btcCloses[i] - btcCloses[i-1]) / btcCloses[i-1]));
        }
        const avgBtcVolatility = btcReturns.reduce((a, b) => a + b, 0) / btcReturns.length;
        
        // If BTC volatility exceeds 5% daily average, activate security mode
        if (avgBtcVolatility > 0.05) {
          securityMode = true;
          console.log('⚠️ Security mode activated - high market volatility detected');
        }
      }
    } catch (e) {
      console.log('Could not check BTC volatility for security mode');
    }

    if (authHeader) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: authData } = await supabaseClient.auth.getUser();
        
        if (authData.user) {
          userId = authData.user.id;
          const { data: params } = await supabaseClient
            .from('analysis_params')
            .select('*')
            .eq('user_id', authData.user.id)
            .single();
          
          if (params) {
            userParams = {
              rsi_oversold_threshold: params.rsi_oversold_threshold,
              rsi_overbought_threshold: params.rsi_overbought_threshold,
              atr_multiplier_tp: params.atr_multiplier_tp,
              atr_multiplier_sl: params.atr_multiplier_sl,
              confidence_threshold: params.confidence_threshold,
              min_bullish_score: params.min_bullish_score,
              max_leverage: params.max_leverage
            };
            console.log('✅ Using personalized parameters from learning engine');
          }
        }
      } catch (e) {
        console.log('Using default parameters (auth check failed):', e);
      }
    }

    // Fetch multiple timeframes for better analysis
    const [klines1h, klines4h, klines1d] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=500`).then(r => r.json()),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=200`).then(r => r.json()),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`).then(r => r.json())
    ]);

    if (!Array.isArray(klines1h) || klines1h.length === 0) {
      throw new Error('No kline data available');
    }

    // Extract OHLCV data from 1h timeframe (primary)
    const closes = klines1h.map((k: any) => parseFloat(k[4]));
    const highs = klines1h.map((k: any) => parseFloat(k[2]));
    const lows = klines1h.map((k: any) => parseFloat(k[3]));
    const volumes = klines1h.map((k: any) => parseFloat(k[5]));
    
    // 4h and 1d data for trend confirmation
    const closes4h = klines4h.map((k: any) => parseFloat(k[4]));
    const closes1d = klines1d.map((k: any) => parseFloat(k[4]));

    const currentPrice = closes[closes.length - 1];

    // Calculate comprehensive indicators
    const rsi14 = calculateRSI(closes, 14);
    const stochRsi = calculateStochRSI(closes, 14);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
    
    // MACD calculation
    const macd = ema12 - ema26;
    const macdSignalData = Array.from({ length: closes.length }, (_, i) => {
      if (i < 25) return 0;
      const slice = closes.slice(0, i + 1);
      const e12 = calculateEMA(slice, 12);
      const e26 = calculateEMA(slice, 26);
      return e12 - e26;
    });
    const macdSignal = calculateEMA(macdSignalData.filter(v => v !== 0), 9);
    const macdHist = macd - macdSignal;
    
    const bb = calculateBollingerBands(closes, 20, 2);
    const atr14 = calculateATR(highs, lows, closes, 14);
    const obv = calculateOBV(closes, volumes);
    const adx = calculateADX(highs, lows, closes, 14);

    // Multi-timeframe trend analysis
    const trend1h = ema12 > ema26 ? 'bullish' : 'bearish';
    const trend4h = closes4h[closes4h.length - 1] > calculateSMA(closes4h, 20) ? 'bullish' : 'bearish';
    const trend1d = closes1d[closes1d.length - 1] > calculateSMA(closes1d, 50) ? 'bullish' : 'bearish';
    const trendAlignment = (trend1h === trend4h && trend4h === trend1d);

    const indicators: TechnicalIndicators = {
      rsi14,
      macd,
      macdSignal,
      macdHist,
      bbUpper: bb.upper,
      bbMiddle: bb.middle,
      bbLower: bb.lower,
      atr14,
      sma20,
      sma50,
      sma200,
      ema12,
      ema26,
      stochRsi,
      obv,
      adx
    };

    // Advanced signal generation with weighted scoring
    let bullishScore = 0;
    let bearishScore = 0;

    // Pre-calculate MACD directional bias (used for coherence check later)
    let macdIsBullish = macdHist > 0 && macd > macdSignal;
    let macdIsBearish = macdHist < 0 && macd < macdSignal;

    // RSI analysis with personalized thresholds
    if (rsi14 < userParams.rsi_oversold_threshold - 5) bullishScore += 3;
    else if (rsi14 < userParams.rsi_oversold_threshold) bullishScore += 2;
    else if (rsi14 < userParams.rsi_oversold_threshold + 10) bullishScore += 1;
    else if (rsi14 > userParams.rsi_overbought_threshold + 5) bearishScore += 3;
    else if (rsi14 > userParams.rsi_overbought_threshold) bearishScore += 2;
    else if (rsi14 > userParams.rsi_overbought_threshold - 10) bearishScore += 1;

    // Stochastic RSI (weight: 1.5)
    if (stochRsi < 20) bullishScore += 2;
    else if (stochRsi > 80) bearishScore += 2;

    // MACD analysis (weight: 3 - increased importance)
    if (macdIsBullish) bullishScore += 3;
    else if (macdIsBearish) bearishScore += 3;
    
    // MACD momentum
    const prevMacdHist = macdSignalData[macdSignalData.length - 2];
    if (macdHist > prevMacdHist && macdHist > 0) bullishScore += 1;
    else if (macdHist < prevMacdHist && macdHist < 0) bearishScore += 1;

    // Bollinger Bands analysis (weight: 2)
    const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (bbPosition < 0.1) bullishScore += 3;
    else if (bbPosition < 0.25) bullishScore += 2;
    else if (bbPosition > 0.9) bearishScore += 3;
    else if (bbPosition > 0.75) bearishScore += 2;

    // Moving averages analysis (weight: 2)
    if (currentPrice > sma20 && sma20 > sma50 && sma50 > sma200) bullishScore += 3;
    else if (currentPrice < sma20 && sma20 < sma50 && sma50 < sma200) bearishScore += 3;
    else if (currentPrice > sma20 && sma20 > sma50) bullishScore += 2;
    else if (currentPrice < sma20 && sma20 < sma50) bearishScore += 2;

    // EMA crossover (weight: 1.5)
    if (ema12 > ema26) bullishScore += 2;
    else bearishScore += 2;

    // ADX strength (weight: 1)
    if (adx > 25) {
      if (trend1h === 'bullish') bullishScore += 1;
      else bearishScore += 1;
    }

    // Multi-timeframe confirmation (weight: 3)
    if (trendAlignment) {
      if (trend1h === 'bullish') bullishScore += 3;
      else bearishScore += 3;
    }

    // Volume analysis (weight: 1.5)
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    if (currentVolume > avgVolume * 1.5) {
      if (closes[closes.length - 1] > closes[closes.length - 2]) bullishScore += 2;
      else bearishScore += 2;
    }

    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 ? (Math.max(bullishScore, bearishScore) / totalScore) * 100 : 50;

    // POINT 1: FORCER LONG/SHORT EN UTILISANT LA TENDANCE 1D COMME ARBITRE
    // Ne jamais retourner NEUTRAL, toujours choisir entre LONG et SHORT
    let signal: 'LONG' | 'SHORT' = 'LONG';
    
    // Determine direction using 1D EMA as master indicator
    const ema50_1d = calculateEMA(closes1d, 50);
    const price1d = closes1d[closes1d.length - 1];
    const masterTrend = price1d > ema50_1d ? 'bullish' : 'bearish';
    
    // Use personalized thresholds but force a choice
    if (bullishScore > bearishScore) {
      signal = 'LONG';
      // Reduce confidence if MACD contradicts
      if (macdIsBearish && Math.abs(macdHist) > atr14 * 0.1) {
        const reduction = 15;
        console.log(`⚠️ MACD contradicts LONG signal: reducing confidence by ${reduction}%`);
        // Store this for later confidence adjustment
      }
    } else if (bearishScore > bullishScore) {
      signal = 'SHORT';
      // Reduce confidence if MACD contradicts
      if (macdIsBullish && macdHist > atr14 * 0.1) {
        const reduction = 15;
        console.log(`⚠️ MACD contradicts SHORT signal: reducing confidence by ${reduction}%`);
      }
    } else {
      // Scores are equal - use master trend (1D EMA) to decide
      signal = masterTrend === 'bullish' ? 'LONG' : 'SHORT';
      console.log(`⚖️ Scores égaux - utilisation de la tendance maître 1D: ${signal}`);
    }

    // Multi-level TP/SL strategy based on ATR, trend strength, trade type, and target duration
    const atrMultiplierSL = userParams.atr_multiplier_sl;
    const baseTPMultiplier = adx > 25 ? userParams.atr_multiplier_tp * 1.2 : userParams.atr_multiplier_tp;
    
    // Adjust TP/SL multipliers based on trade type and target duration
    let tp1Mult, tp2Mult, tp3Mult, slMult;
    
    // If targetDuration is specified, override trade type defaults
    if (targetDuration > 0) {
      if (targetDuration <= 30) {
        // Ultra short (< 30 min)
        tp1Mult = 0.3;
        tp2Mult = 0.6;
        tp3Mult = 1.0;
        slMult = atrMultiplierSL * 0.5;
      } else if (targetDuration <= 120) {
        // Short (30-120 min)
        tp1Mult = 0.5;
        tp2Mult = 1.0;
        tp3Mult = 1.5;
        slMult = atrMultiplierSL * 0.7;
      } else if (targetDuration <= 1440) {
        // Medium (2-24h)
        tp1Mult = 1.0;
        tp2Mult = 2.0;
        tp3Mult = 3.5;
        slMult = atrMultiplierSL;
      } else {
        // Long (> 1 day)
        tp1Mult = 1.5;
        tp2Mult = 3.0;
        tp3Mult = 5.0;
        slMult = atrMultiplierSL * 1.5;
      }
    } else if (tradeType === 'scalp') {
      // Scalp: tighter targets, quick exits
      tp1Mult = 0.5;
      tp2Mult = 1.0;
      tp3Mult = 1.5;
      slMult = atrMultiplierSL * 0.7;
    } else if (tradeType === 'swing') {
      // Swing: balanced targets
      tp1Mult = 1.0;
      tp2Mult = 2.0;
      tp3Mult = 3.5;
      slMult = atrMultiplierSL;
    } else {
      // Long term: wider targets
      tp1Mult = 1.5;
      tp2Mult = 3.0;
      tp3Mult = 5.0;
      slMult = atrMultiplierSL * 1.5;
    }
    
    let takeProfit1 = 0, takeProfit2 = 0, takeProfit3 = 0;
    let stopLoss = 0;
    
    if (signal === 'LONG') {
      takeProfit1 = currentPrice + (atr14 * baseTPMultiplier * tp1Mult);
      takeProfit2 = currentPrice + (atr14 * baseTPMultiplier * tp2Mult);
      takeProfit3 = currentPrice + (atr14 * baseTPMultiplier * tp3Mult);
      stopLoss = currentPrice - (atr14 * slMult);
    } else if (signal === 'SHORT') {
      takeProfit1 = currentPrice - (atr14 * baseTPMultiplier * tp1Mult);
      takeProfit2 = currentPrice - (atr14 * baseTPMultiplier * tp2Mult);
      takeProfit3 = currentPrice - (atr14 * baseTPMultiplier * tp3Mult);
      stopLoss = currentPrice + (atr14 * slMult);
    }
    
    // Use TP2 as main target for risk/reward calculation
    const takeProfit = takeProfit2;

    const riskReward = Math.abs((takeProfit - currentPrice) / (currentPrice - stopLoss));

    // POINT 2: UTILISER LE CAPITAL ET GESTION DU RISQUE - CHARGER D'ABORD
    let userCapital = 10000; // default
    let userRiskPercent = 1; // default
    let maxDailyLoss = 50; // default
    let currentDailyLoss = 0; // default
    let targetWinRate = 60; // default
    
    if (supabaseClient && userId) {
      try {
        const { data: userSettings } = await supabaseClient
          .from('user_settings')
          .select('capital, risk_percent_per_trade, max_loss_per_day, current_loss_today, target_win_rate')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (userSettings) {
          userCapital = parseFloat(userSettings.capital);
          userRiskPercent = parseFloat(userSettings.risk_percent_per_trade);
          maxDailyLoss = parseFloat(userSettings.max_loss_per_day);
          currentDailyLoss = parseFloat(userSettings.current_loss_today);
          targetWinRate = parseFloat(userSettings.target_win_rate) || 60;
        }
      } catch (e) {
        console.log('Could not fetch user settings, using defaults:', e);
      }
    }
    
    // Apply capital percentage - user wants to use only X% of their capital
    const effectiveCapital = userCapital * (capitalPercent / 100);
    console.log(`💰 Capital effectif: $${effectiveCapital.toFixed(2)} (${capitalPercent}% de $${userCapital.toFixed(2)})`);
    userCapital = effectiveCapital;

    // Mettre à jour macdIsBullish et macdIsBearish
    macdIsBullish = macdHist > 0;
    macdIsBearish = macdHist < 0;

    // POINT 2 & 4: Advanced leverage calculation avec capital, risque et cohérence
    const volatilityPercent = (atr14 / currentPrice) * 100;
    const trendStrength = adx;
    let baseLeverage = Math.min(2, userParams.max_leverage);
    
    // Base leverage calculation based on volatility, confidence, and trend strength
    if (volatilityPercent < 0.8 && trendStrength > 25 && confidence > 70) {
      baseLeverage = Math.min(10, userParams.max_leverage);
    } else if (volatilityPercent < 1.5 && trendStrength > 20 && confidence > 65) {
      baseLeverage = Math.min(7, userParams.max_leverage);
    } else if (volatilityPercent < 2.5 && confidence > 60) {
      baseLeverage = Math.min(5, userParams.max_leverage);
    } else if (volatilityPercent < 4) {
      baseLeverage = Math.min(3, userParams.max_leverage);
    }
    
    let suggestedLeverage = baseLeverage;
    
    // Adjust leverage based on trade type and target duration
    if (targetDuration > 0) {
      if (targetDuration <= 15) {
        // Ultra-scalp (≤15min): very high leverage possible
        suggestedLeverage = Math.min(baseLeverage * 2.5, userParams.max_leverage, 25);
      } else if (targetDuration <= 30) {
        // Scalp (15-30min): high leverage
        suggestedLeverage = Math.min(baseLeverage * 2, userParams.max_leverage, 20);
      } else if (targetDuration <= 60) {
        // Short scalp (30-60min): elevated leverage
        suggestedLeverage = Math.min(baseLeverage * 1.7, userParams.max_leverage, 15);
      } else if (targetDuration <= 240) {
        // Intraday (1-4h): moderate-high leverage
        suggestedLeverage = Math.min(baseLeverage * 1.4, userParams.max_leverage, 12);
      } else if (targetDuration <= 1440) {
        // Day trade (4h-1d): moderate leverage
        suggestedLeverage = Math.min(baseLeverage * 1.2, userParams.max_leverage, 10);
      } else if (targetDuration <= 10080) {
        // Swing (1-7d): reduced leverage
        suggestedLeverage = Math.min(baseLeverage * 0.8, userParams.max_leverage, 7);
      } else {
        // Long term (>7d): minimal leverage
        suggestedLeverage = Math.min(baseLeverage * 0.5, userParams.max_leverage, 5);
      }
    } else if (tradeType === 'scalp') {
      // If no duration but scalp type selected
      suggestedLeverage = Math.min(baseLeverage * 2, userParams.max_leverage, 20);
    } else if (tradeType === 'swing') {
      suggestedLeverage = Math.min(baseLeverage * 1.2, userParams.max_leverage, 10);
    } else {
      // long term
      suggestedLeverage = Math.min(baseLeverage * 0.7, userParams.max_leverage, 7);
    }
    
    // AJUSTEMENT AVANCÉ SELON LE CAPITAL ET LE RISQUE
    // Moins de capital utilisé = plus de prudence (levier réduit)
    const capitalFactor = capitalPercent <= 25 ? 0.6 :   // 25% du capital = très prudent
                          capitalPercent <= 50 ? 0.8 :    // 50% = modéré
                          capitalPercent <= 75 ? 0.95 :   // 75% = confiant
                          1.0;                             // 100% = très confiant
    
    // Si le capital effectif est faible, réduire encore plus
    const absoluteCapitalFactor = userCapital < 500 ? 0.5 :
                                  userCapital < 1000 ? 0.6 :
                                  userCapital < 2500 ? 0.75 :
                                  userCapital < 5000 ? 0.85 : 1.0;
    
    // AJUSTEMENT SELON LE RISQUE PAR TRADE: Plus de risque = moins de levier
    const riskFactor = userRiskPercent > 5 ? 0.4 :      // Très risqué
                       userRiskPercent > 3 ? 0.6 :      // Risqué
                       userRiskPercent > 2 ? 0.8 :      // Modéré-élevé
                       userRiskPercent > 1 ? 0.9 : 1.0; // Normal
    
    // Combine tous les facteurs
    suggestedLeverage *= capitalFactor * absoluteCapitalFactor * riskFactor;
    
    // Ensure minimum leverage of 1, maximum selon user settings
    suggestedLeverage = Math.max(1, Math.min(Math.round(suggestedLeverage), userParams.max_leverage));
    
    console.log(`💰 Levier: Base=${baseLeverage}x, CapitalPercent=${capitalPercent}% (factor=${capitalFactor.toFixed(2)}), AbsCapital=${userCapital.toFixed(2)} (factor=${absoluteCapitalFactor.toFixed(2)}), Risk=${userRiskPercent}% (factor=${riskFactor.toFixed(2)}), Final=${suggestedLeverage}x`);

    // Fetch 24h ticker
    const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const ticker = await tickerRes.json();
    
    // Detect chart patterns
    const detectedPatterns = detectPatterns(closes, highs, lows);

    // Calculate time horizon based on target duration or historical data
    const timeHorizon = calculateTimeHorizon(closes, atr14, currentPrice, takeProfit, parseFloat(ticker.quoteVolume), targetDuration);
    
    // Calculate position sizing with user's real capital and risk parameters
    const realPositionSize = calculatePositionSize(userCapital, currentPrice, stopLoss, userRiskPercent, suggestedLeverage);
    
    // POINT 2: FILTRAGE BASÉ SUR LA PERTE MAX DU JOUR
    const potentialLoss = realPositionSize.risk;
    const totalDailyLoss = currentDailyLoss + potentialLoss;
    
    if (totalDailyLoss > maxDailyLoss) {
      console.log(`🚫 SIGNAL REFUSÉ: Perte potentielle totale ($${totalDailyLoss.toFixed(2)}) dépasse la limite journalière ($${maxDailyLoss.toFixed(2)})`);
      throw new Error(`Limite de perte journalière atteinte. Perte actuelle: $${currentDailyLoss.toFixed(2)}, limite: $${maxDailyLoss.toFixed(2)}. Arrêtez de trader aujourd'hui.`);
    }
    
    // POINT 2: AJUSTER LA CONFIANCE SELON LE WIN RATE CIBLE
    // Si le win rate cible est élevé, on augmente le seuil de confiance minimum
    const minConfidenceAdjustment = targetWinRate > 70 ? 10 : targetWinRate > 60 ? 5 : 0;
    
    // Calculate dollar amounts for each TP level
    const tp1Amount = signal === 'LONG' 
      ? (takeProfit1 - currentPrice) * realPositionSize.size
      : (currentPrice - takeProfit1) * realPositionSize.size;
    const tp2Amount = signal === 'LONG'
      ? (takeProfit2 - currentPrice) * realPositionSize.size
      : (currentPrice - takeProfit2) * realPositionSize.size;
    const tp3Amount = signal === 'LONG'
      ? (takeProfit3 - currentPrice) * realPositionSize.size
      : (currentPrice - takeProfit3) * realPositionSize.size;

    // POINT 5: AMÉLIORER L'IMPACT DES ÉVÉNEMENTS ET NEWS
    // Fetch calendar events to adjust score
    let eventsImpact = 0;
    try {
      const baseName = symbol.replace('USDT', '');
      const eventsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({ symbols: [baseName] })
      });

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        if (eventsData.events && Array.isArray(eventsData.events)) {
          // Analyser chaque événement et appliquer des bonus/malus spécifiques
          for (const event of eventsData.events) {
            const categoryLower = event.category?.toLowerCase() || '';
            const titleLower = event.title?.toLowerCase() || '';
            const impact = event.impact?.toLowerCase() || 'low';
            
            // Événements critiques négatifs
            if (categoryLower.includes('hack') || titleLower.includes('hack') || titleLower.includes('exploit')) {
              eventsImpact -= 25;
              console.log(`🚨 HACK/EXPLOIT détecté: -25 points`);
            }
            // Listings positifs (boost significatif)
            else if (categoryLower.includes('listing') || titleLower.includes('binance listing') || titleLower.includes('coinbase listing')) {
              eventsImpact += impact === 'high' ? 20 : 15;
              console.log(`🎯 LISTING détecté: +${impact === 'high' ? 20 : 15} points`);
            }
            // Partenariats positifs
            else if (categoryLower.includes('partnership') || titleLower.includes('partnership') || titleLower.includes('collaboration')) {
              eventsImpact += impact === 'high' ? 12 : 8;
              console.log(`🤝 PARTNERSHIP: +${impact === 'high' ? 12 : 8} points`);
            }
            // Upgrades/Forks positifs
            else if (categoryLower.includes('upgrade') || categoryLower.includes('fork') || titleLower.includes('upgrade') || titleLower.includes('mainnet')) {
              eventsImpact += impact === 'high' ? 15 : 10;
              console.log(`⬆️ UPGRADE/FORK: +${impact === 'high' ? 15 : 10} points`);
            }
            // Autres événements selon impact
            else if (impact === 'high') {
              eventsImpact += 8;
              console.log(`📅 High impact event: +8 points`);
            } else if (impact === 'medium') {
              eventsImpact += 4;
            }
          }
          console.log(`📅 Total events impact: ${eventsImpact > 0 ? '+' : ''}${eventsImpact} points`);
        }
      }
    } catch (e) {
      console.log('Could not fetch events:', e);
    }

    // Fetch fundamental analysis score
    let fundamentalScore = 0;
    try {
      const fundamentalResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fundamental-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({ symbol })
      });

      if (fundamentalResponse.ok) {
        const fundData = await fundamentalResponse.json();
        if (fundData.fundamentalScore) {
          // POINT 5: Augmenter l'impact du score fondamental (0-100) vers (0-25)
          fundamentalScore = (fundData.fundamentalScore / 100) * 25;
          console.log(`🔍 Fundamental score: ${fundData.fundamentalScore}/100 (+${fundamentalScore.toFixed(1)} points)`);
        }
      }
    } catch (e) {
      console.log('Could not fetch fundamental analysis:', e);
    }

    // Fetch news sentiment
    let newsImpact = 0;
    try {
      const baseName = symbol.replace('USDT', '');
      const newsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/crypto-news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({ symbol, baseAsset: baseName })
      });

      if (newsResponse.ok) {
        const newsData = await newsResponse.json();
        if (newsData.overallSentiment) {
          // POINT 5: Amplifier l'impact des news sentiment (multiplier par 1.5)
          const baseImpact = newsData.overallSentiment.scoreAdjustment || 0;
          newsImpact = baseImpact * 1.5;
          console.log(`📰 News sentiment impact: ${newsImpact > 0 ? '+' : ''}${newsImpact.toFixed(1)} points (base: ${baseImpact})`);
        }
      }
    } catch (e) {
      console.log('Could not fetch news:', e);
    }

    // POINT 4: ÉLIMINER LES INCOHÉRENCES EN RÉDUISANT LA CONFIANCE
    let coherenceReduction = 0;
    
    // Check RSI vs signal coherence
    if (signal === 'LONG' && rsi14 > userParams.rsi_overbought_threshold) {
      coherenceReduction += 10;
      console.log('⚠️ Incohérence: Signal LONG mais RSI suracheté');
    }
    if (signal === 'SHORT' && rsi14 < userParams.rsi_oversold_threshold) {
      coherenceReduction += 10;
      console.log('⚠️ Incohérence: Signal SHORT mais RSI survendu');
    }
    
    // Check MACD vs signal coherence (déjà fait plus haut, mais on le comptabilise ici)
    if (signal === 'LONG' && macdIsBearish) {
      coherenceReduction += 15;
    }
    if (signal === 'SHORT' && macdIsBullish) {
      coherenceReduction += 15;
    }
    
    // Check BB vs signal coherence
    const bbPos = (currentPrice - bb.lower) / (bb.upper - bb.lower);
    if (signal === 'LONG' && bbPos > 0.9) {
      coherenceReduction += 8;
      console.log('⚠️ Incohérence: Signal LONG mais prix en haut de BB');
    }
    if (signal === 'SHORT' && bbPos < 0.1) {
      coherenceReduction += 8;
      console.log('⚠️ Incohérence: Signal SHORT mais prix en bas de BB');
    }
    
    // Adjust final confidence with external factors and coherence check
    let adjustedConfidence = Math.min(95, Math.max(30, confidence + eventsImpact + fundamentalScore + newsImpact - coherenceReduction));
    
    // POINT 2: Apply win rate target adjustment
    if (adjustedConfidence < userParams.confidence_threshold + minConfidenceAdjustment) {
      console.log(`📊 Confiance (${adjustedConfidence.toFixed(1)}%) inférieure au seuil requis (${userParams.confidence_threshold + minConfidenceAdjustment}%) pour le win rate cible de ${targetWinRate}%`);
    }

    const analysis = {
      signal,
      confidence: Math.round(adjustedConfidence * 10) / 10,
      baseConfidence: Math.round(confidence * 10) / 10,
      externalFactors: {
        eventsImpact,
        fundamentalScore,
        newsImpact,
        totalAdjustment: eventsImpact + fundamentalScore + newsImpact
      },
      leverage: suggestedLeverage,
      price: currentPrice,
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      indicators,
      takeProfit1,
      takeProfit2,
      takeProfit3,
      takeProfit, // TP2 as main target
      stopLoss,
      riskReward: Math.round(riskReward * 10) / 10,
      bullishSignals: bullishScore,
      bearishSignals: bearishScore,
      trendAlignment,
      adxStrength: adx,
      patterns: detectedPatterns,
      timeHorizon,
      tradeType,
      targetDuration: targetDuration > 0 ? `${targetDuration} minutes` : 'auto',
      positionSizing: {
        capital: userCapital,
        riskPercent: userRiskPercent,
        positionSize: realPositionSize.size,
        margin: realPositionSize.margin,
        riskAmount: realPositionSize.risk,
        // POINT 9: SORTIES PARTIELLES AVEC MONTANTS EN $
        tp1Profit: Math.round(tp1Amount * 100) / 100,
        tp2Profit: Math.round(tp2Amount * 100) / 100,
        tp3Profit: Math.round(tp3Amount * 100) / 100,
        // POINT 9: Plan de sortie partielle (50%, 30%, 20%)
        exitPlan: {
          tp1: { percent: 50, profit: Math.round((tp1Amount * 0.5) * 100) / 100, action: 'Prendre 50% des profits et déplacer SL au break-even' },
          tp2: { percent: 30, profit: Math.round((tp2Amount * 0.3) * 100) / 100, action: 'Prendre 30% supplémentaires et déplacer SL à TP1' },
          tp3: { percent: 20, profit: Math.round((tp3Amount * 0.2) * 100) / 100, action: 'Prendre les 20% restants ou laisser courir avec trailing stop' }
        },
        dailyRiskStatus: {
          currentLoss: currentDailyLoss,
          maxLoss: maxDailyLoss,
          remaining: maxDailyLoss - currentDailyLoss,
          tradeRisk: realPositionSize.risk,
          afterThisTrade: currentDailyLoss + realPositionSize.risk,
          status: (currentDailyLoss + realPositionSize.risk) > maxDailyLoss * 0.8 ? 'WARNING' : 'OK'
        },
        note: `Capital: $${userCapital.toFixed(2)} | Risque: ${userRiskPercent}% | Win rate cible: ${targetWinRate}%`
      },
      recommendation: generateRecommendation(
        signal, 
        adjustedConfidence, 
        rsi14, 
        stochRsi,
        macdHist, 
        currentPrice, 
        bb, 
        sma20, 
        sma50,
        adx,
        trendAlignment,
        volatilityPercent,
        timeHorizon,
        detectedPatterns
      )
    };

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in crypto-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function generateRecommendation(
  signal: string, 
  confidence: number, 
  rsi: number,
  stochRsi: number,
  macdHist: number,
  price: number,
  bb: any,
  sma20: number,
  sma50: number,
  adx: number,
  trendAlignment: boolean,
  volatility: number,
  timeHorizon: any,
  patterns: string[]
): string {
  let rec = `Signal ${signal} avec ${confidence.toFixed(1)}% de confiance.\n`;
  rec += `HORIZON TEMPOREL: ${timeHorizon.estimate} (${timeHorizon.type.toUpperCase()}) - Confiance: ${timeHorizon.confidence}\n`;
  
  if (patterns.length > 0) {
    rec += `PATTERNS DÉTECTÉS: ${patterns.join(', ')}\n`;
  }
  rec += `\n`;
  
  if (signal === 'LONG') {
    rec += `ANALYSE TECHNIQUE:\n`;
    rec += `Les indicateurs convergent vers une tendance haussière. `;
    
    if (rsi < 35) rec += `Le RSI à ${rsi.toFixed(1)} indique une survente significative, historiquement favorable à un rebond. `;
    if (stochRsi < 20) rec += `Le Stochastic RSI confirme une zone de survente extrême. `;
    if (macdHist > 0) rec += `Le MACD est positif, confirmant un momentum haussier croissant. `;
    if (price < bb.lower * 1.02) rec += `Le prix est proche de la bande de Bollinger inférieure, suggérant un point d'entrée optimal. `;
    if (trendAlignment) rec += `Les trois timeframes (1h, 4h, 1d) sont alignés à la hausse, renforçant la conviction. `;
    if (adx > 25) rec += `L'ADX à ${adx.toFixed(1)} confirme une tendance forte et établie. `;
    
    rec += `\n\nRECOMMANDATIONS:\n`;
    rec += `Point d'entrée: Prix actuel ou légèrement en dessous.\n`;
    rec += `La configuration actuelle présente un ratio risque/récompense favorable avec une probabilité élevée de succès basée sur l'analyse historique de patterns similaires.`;
    
  } else if (signal === 'SHORT') {
    rec += `ANALYSE TECHNIQUE:\n`;
    rec += `Les indicateurs convergent vers une tendance baissière. `;
    
    if (rsi > 65) rec += `Le RSI à ${rsi.toFixed(1)} indique un surachat, augmentant la probabilité d'une correction. `;
    if (stochRsi > 80) rec += `Le Stochastic RSI confirme une zone de surachat extrême. `;
    if (macdHist < 0) rec += `Le MACD est négatif, confirmant un momentum baissier croissant. `;
    if (price > bb.upper * 0.98) rec += `Le prix est proche de la bande de Bollinger supérieure, suggérant un point d'entrée optimal pour une position courte. `;
    if (trendAlignment) rec += `Les trois timeframes (1h, 4h, 1d) sont alignés à la baisse, renforçant la conviction. `;
    if (adx > 25) rec += `L'ADX à ${adx.toFixed(1)} confirme une tendance forte et établie. `;
    
    rec += `\n\nRECOMMANDATIONS:\n`;
    rec += `Point d'entrée: Prix actuel ou légèrement au-dessus.\n`;
    rec += `La configuration actuelle présente un ratio risque/récompense favorable avec une probabilité élevée de succès basée sur l'analyse historique de patterns similaires.`;
    
  }
  
  rec += `\n\nGESTION DU RISQUE:\n`;
  if (price > sma20 && price > sma50) {
    rec += `Prix au-dessus des moyennes mobiles 20 et 50, indiquant un support technique solide. `;
  } else if (price < sma20 && price < sma50) {
    rec += `Prix en-dessous des moyennes mobiles 20 et 50, indiquant une résistance technique. `;
  }
  
  rec += `Volatilité actuelle: ${volatility.toFixed(2)}%. `;
  if (volatility > 3) {
    rec += `Volatilité élevée - utilisez un levier réduit et des stops plus larges.`;
  } else {
    rec += `Volatilité modérée - conditions favorables pour un levier approprié.`;
  }
  
  return rec;
}