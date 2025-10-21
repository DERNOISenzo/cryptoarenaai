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
  ema12: number;
  ema26: number;
}

// Calculate RSI
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  
  const changes = closes.slice(1).map((price, i) => price - closes[i]);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  
  const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    console.log('Analyzing:', symbol);

    // Fetch klines (candlestick data) - last 500 candles for 1h timeframe
    const klinesRes = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=500`
    );
    const klines = await klinesRes.json();

    if (!Array.isArray(klines) || klines.length === 0) {
      throw new Error('No kline data available');
    }

    // Extract OHLCV data
    const opens = klines.map((k: any) => parseFloat(k[1]));
    const highs = klines.map((k: any) => parseFloat(k[2]));
    const lows = klines.map((k: any) => parseFloat(k[3]));
    const closes = klines.map((k: any) => parseFloat(k[4]));
    const volumes = klines.map((k: any) => parseFloat(k[5]));

    const currentPrice = closes[closes.length - 1];

    // Calculate all indicators
    const rsi14 = calculateRSI(closes, 14);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const ema12 = calculateEMA(closes, 12);
    const ema26 = calculateEMA(closes, 26);
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
      ema12,
      ema26
    };

    // Generate signal based on multiple indicators
    let bullishSignals = 0;
    let bearishSignals = 0;

    // RSI analysis
    if (rsi14 < 30) bullishSignals += 2;
    else if (rsi14 < 40) bullishSignals += 1;
    else if (rsi14 > 70) bearishSignals += 2;
    else if (rsi14 > 60) bearishSignals += 1;

    // MACD analysis
    if (macdHist > 0 && macd > macdSignal) bullishSignals += 2;
    else if (macdHist < 0 && macd < macdSignal) bearishSignals += 2;

    // Bollinger Bands analysis
    if (currentPrice <= bb.lower * 1.01) bullishSignals += 2;
    else if (currentPrice >= bb.upper * 0.99) bearishSignals += 2;

    // Moving averages analysis
    if (currentPrice > sma20 && sma20 > sma50) bullishSignals += 1;
    else if (currentPrice < sma20 && sma20 < sma50) bearishSignals += 1;

    // EMA crossover
    if (ema12 > ema26) bullishSignals += 1;
    else bearishSignals += 1;

    const totalSignals = bullishSignals + bearishSignals;
    const confidence = totalSignals > 0 ? (Math.max(bullishSignals, bearishSignals) / totalSignals) * 100 : 50;

    let signal: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishSignals > bearishSignals && confidence > 55) {
      signal = 'LONG';
    } else if (bearishSignals > bullishSignals && confidence > 55) {
      signal = 'SHORT';
    }

    // Calculate TP/SL based on ATR
    const atrMultiplier = 1.5;
    let takeProfit = 0;
    let stopLoss = 0;
    
    if (signal === 'LONG') {
      takeProfit = currentPrice + (atr14 * atrMultiplier);
      stopLoss = currentPrice - (atr14 * 1.0);
    } else if (signal === 'SHORT') {
      takeProfit = currentPrice - (atr14 * atrMultiplier);
      stopLoss = currentPrice + (atr14 * 1.0);
    }

    const riskReward = signal !== 'NEUTRAL' 
      ? Math.abs((takeProfit - currentPrice) / (currentPrice - stopLoss))
      : 0;

    // Suggest leverage based on volatility (lower volatility = higher leverage possible)
    const volatilityPercent = (atr14 / currentPrice) * 100;
    let suggestedLeverage = 2;
    if (volatilityPercent < 1) suggestedLeverage = 10;
    else if (volatilityPercent < 2) suggestedLeverage = 7;
    else if (volatilityPercent < 3) suggestedLeverage = 5;
    else if (volatilityPercent < 5) suggestedLeverage = 3;

    // Fetch 24h ticker for additional info
    const tickerRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    const ticker = await tickerRes.json();

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
      bullishSignals,
      bearishSignals,
      recommendation: generateRecommendation(signal, confidence, rsi14, macdHist, currentPrice, bb, sma20)
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

function generateRecommendation(
  signal: string, 
  confidence: number, 
  rsi: number, 
  macdHist: number,
  price: number,
  bb: any,
  sma20: number
): string {
  let rec = `Position ${signal} suggérée avec une confiance de ${confidence.toFixed(1)}%. `;
  
  if (signal === 'LONG') {
    rec += `Les indicateurs montrent une tendance haussière. `;
    if (rsi < 40) rec += `RSI en zone de survente (${rsi.toFixed(1)}), potentiel de rebond. `;
    if (macdHist > 0) rec += `MACD positif confirme la tendance. `;
    if (price < bb.lower * 1.02) rec += `Prix proche de la bande de Bollinger inférieure, opportunité d'achat. `;
  } else if (signal === 'SHORT') {
    rec += `Les indicateurs montrent une tendance baissière. `;
    if (rsi > 60) rec += `RSI en zone de surachat (${rsi.toFixed(1)}), potentiel de correction. `;
    if (macdHist < 0) rec += `MACD négatif confirme la tendance. `;
    if (price > bb.upper * 0.98) rec += `Prix proche de la bande de Bollinger supérieure, opportunité de vente. `;
  } else {
    rec += `Le marché est actuellement neutre. Attendez un signal plus clair avant d'entrer en position. `;
  }
  
  if (price > sma20) {
    rec += `Prix au-dessus de la SMA20, support technique positif. `;
  } else {
    rec += `Prix en-dessous de la SMA20, prudence recommandée. `;
  }
  
  return rec;
}
