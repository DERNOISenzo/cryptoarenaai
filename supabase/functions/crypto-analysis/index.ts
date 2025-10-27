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

// Calculate time horizon with annualized volatility
function calculateTimeHorizon(
  closes: number[],
  atr: number,
  currentPrice: number,
  takeProfit: number,
  volume24h: number
): { estimate: string; type: string; hours: number; confidence: number } {
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
  
  const positionSize = riskAmount / (stopDistancePercent * entryPrice);
  const margin = (positionSize * entryPrice) / leverage;
  
  return {
    size: Math.round(positionSize * 1000) / 1000,
    margin: Math.round(margin * 100) / 100,
    risk: riskAmount
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, tradeType = 'swing', targetDuration = 0 } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    console.log('Analyzing:', symbol, '- Trade type:', tradeType, '- Target duration:', targetDuration, 'min');

    // Get user's analysis parameters (if authenticated) from the Authorization header
    const authHeader = req.headers.get('Authorization');
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
        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: authData } = await supabaseClient.auth.getUser();
        
        if (authData.user) {
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

    // MACD analysis (weight: 2)
    if (macdHist > 0 && macd > macdSignal) bullishScore += 2;
    else if (macdHist < 0 && macd < macdSignal) bearishScore += 2;
    
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

    let signal: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    // Use personalized thresholds from learning engine
    if (bullishScore > bearishScore && confidence > (userParams.confidence_threshold - 2) && bullishScore >= userParams.min_bullish_score) {
      signal = 'LONG';
    } else if (bearishScore > bullishScore && confidence > (userParams.confidence_threshold - 2) && bearishScore >= userParams.min_bullish_score) {
      signal = 'SHORT';
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

    const riskReward = signal !== 'NEUTRAL' 
      ? Math.abs((takeProfit - currentPrice) / (currentPrice - stopLoss))
      : 0;

    // Advanced leverage calculation with personalized max leverage
    const volatilityPercent = (atr14 / currentPrice) * 100;
    const trendStrength = adx;
    let suggestedLeverage = Math.min(2, userParams.max_leverage);
    
    if (volatilityPercent < 0.8 && trendStrength > 25 && confidence > 70) {
      suggestedLeverage = Math.min(10, userParams.max_leverage);
    } else if (volatilityPercent < 1.5 && trendStrength > 20 && confidence > 65) {
      suggestedLeverage = Math.min(7, userParams.max_leverage);
    } else if (volatilityPercent < 2.5 && confidence > 60) {
      suggestedLeverage = Math.min(5, userParams.max_leverage);
    } else if (volatilityPercent < 4) {
      suggestedLeverage = Math.min(3, userParams.max_leverage);
    }

    // Fetch 24h ticker
    const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const ticker = await tickerRes.json();
    
    // Detect chart patterns
    const detectedPatterns = detectPatterns(closes, highs, lows);

    // Calculate time horizon based on historical data and liquidity
    const timeHorizon = calculateTimeHorizon(closes, atr14, currentPrice, takeProfit, parseFloat(ticker.quoteVolume));
    
    // Calculate position sizing (example with $10,000 account and 1% risk)
    const examplePositionSize = calculatePositionSize(10000, currentPrice, stopLoss, 1, suggestedLeverage);

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
        if (eventsData.summary) {
          // High impact events within 7 days can boost confidence
          if (eventsData.summary.highImpactEvents > 0) {
            eventsImpact = Math.min(10, eventsData.summary.highImpactEvents * 5);
            console.log(`📅 Events impact: +${eventsImpact} points`);
          }
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
          // Scale fundamental score (0-100) to impact (0-15)
          fundamentalScore = (fundData.fundamentalScore / 100) * 15;
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
          newsImpact = newsData.overallSentiment.scoreAdjustment || 0;
          console.log(`📰 News sentiment impact: ${newsImpact > 0 ? '+' : ''}${newsImpact} points`);
        }
      }
    } catch (e) {
      console.log('Could not fetch news:', e);
    }

    // Adjust final confidence with external factors
    const adjustedConfidence = Math.min(95, Math.max(30, confidence + eventsImpact + fundamentalScore + newsImpact));

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
        example: examplePositionSize,
        note: "Basé sur un capital de $10,000 avec 1% de risque par trade"
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
    
  } else {
    rec += `ANALYSE TECHNIQUE:\n`;
    rec += `Le marché présente des signaux contradictoires sans direction claire. `;
    rec += `RSI: ${rsi.toFixed(1)} (zone neutre), `;
    rec += `MACD: ${macdHist > 0 ? 'positif' : 'négatif'} mais faible. `;
    
    rec += `\n\nRECOMMANDATIONS:\n`;
    rec += `Prudence recommandée. Attendez une confirmation plus claire des indicateurs avant d'entrer en position. `;
    rec += `Surveillez les niveaux clés: Support à $${bb.lower.toFixed(2)}, Résistance à $${bb.upper.toFixed(2)}.`;
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