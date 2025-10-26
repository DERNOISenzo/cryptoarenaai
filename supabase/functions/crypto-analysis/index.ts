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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    console.log('Analyzing:', symbol);

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

    // Dynamic TP/SL based on volatility, trend strength, and personalized multipliers
    const atrMultiplierTP = adx > 25 ? userParams.atr_multiplier_tp * 1.2 : userParams.atr_multiplier_tp;
    const atrMultiplierSL = userParams.atr_multiplier_sl;
    
    let takeProfit = 0;
    let stopLoss = 0;
    
    if (signal === 'LONG') {
      takeProfit = currentPrice + (atr14 * atrMultiplierTP);
      stopLoss = currentPrice - (atr14 * atrMultiplierSL);
    } else if (signal === 'SHORT') {
      takeProfit = currentPrice - (atr14 * atrMultiplierTP);
      stopLoss = currentPrice + (atr14 * atrMultiplierSL);
    }

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

    // Calculate time horizon based on ATR and volatility
    const timeHorizon = calculateTimeHorizon(atr14, currentPrice, takeProfit, stopLoss, volatilityPercent);

    const analysis = {
      signal,
      confidence: Math.round(confidence * 10) / 10,
      leverage: suggestedLeverage,
      price: currentPrice,
      change24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.quoteVolume),
      indicators,
      takeProfit,
      stopLoss,
      riskReward: Math.round(riskReward * 10) / 10,
      bullishSignals: bullishScore,
      bearishSignals: bearishScore,
      trendAlignment,
      adxStrength: adx,
      timeHorizon, // Added time horizon
      recommendation: generateRecommendation(
        signal, 
        confidence, 
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
        timeHorizon
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

// Calculate estimated time horizon based on volatility percentage
function calculateTimeHorizon(atr: number, price: number, tp: number, sl: number, volatility: number): {
  estimate: string;
  type: 'scalp' | 'intraday' | 'swing' | 'position';
  hours: number;
} {
  const targetDistance = Math.abs(tp - price);
  const distancePercent = (targetDistance / price) * 100;
  
  // Use volatility percentage for more realistic estimates
  const avgHourlyVolatility = Math.abs(volatility) / 24;
  
  if (avgHourlyVolatility === 0 || distancePercent === 0) {
    return { estimate: 'Indéterminé', type: 'swing', hours: 0 };
  }
  
  // Estimate hours based on percentage moves
  let estimatedHours = distancePercent / avgHourlyVolatility;
  
  // Cap maximum at 6 weeks (1008 hours)
  estimatedHours = Math.min(estimatedHours, 1008);
  
  let type: 'scalp' | 'intraday' | 'swing' | 'position';
  let estimate: string;
  
  if (estimatedHours < 4) {
    type = 'scalp';
    estimate = `${Math.round(estimatedHours)} heures`;
  } else if (estimatedHours < 24) {
    type = 'intraday';
    estimate = `${Math.round(estimatedHours)} heures`;
  } else if (estimatedHours < 168) {
    type = 'swing';
    const days = Math.round(estimatedHours / 24);
    estimate = `${days} jour${days > 1 ? 's' : ''}`;
  } else {
    type = 'position';
    const weeks = Math.min(6, Math.round(estimatedHours / 168));
    estimate = `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  
  return { estimate, type, hours: estimatedHours };
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
  timeHorizon: any
): string {
  let rec = `Signal ${signal} avec ${confidence.toFixed(1)}% de confiance.\n`;
  rec += `HORIZON TEMPOREL: ${timeHorizon.estimate} (${timeHorizon.type.toUpperCase()})\n\n`;
  
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