import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntradaySignal {
  symbol: string;
  name: string;
  timeframe: '1m' | '5m' | '15m' | '1h';
  signal: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number;
  microPattern: string;
  vwap: number;
  supertrend: number;
  supertrendDirection: 'BULLISH' | 'BEARISH';
  orderBookImbalance: number;
  volumeSpike: boolean;
  momentum: number;
  expectedDuration: string;
}

// Calculate VWAP (Volume Weighted Average Price)
function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  
  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
  }
  
  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1];
}

// Calculate Supertrend indicator
function calculateSupertrend(
  highs: number[], 
  lows: number[], 
  closes: number[], 
  atr: number, 
  multiplier: number = 3
): { value: number; direction: 'BULLISH' | 'BEARISH' } {
  const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const basicUpperBand = hl2 + (multiplier * atr);
  const basicLowerBand = hl2 - (multiplier * atr);
  const currentPrice = closes[closes.length - 1];
  
  // Supertrend direction based on price relative to bands
  const direction = currentPrice > basicUpperBand ? 'BULLISH' : 
                    currentPrice < basicLowerBand ? 'BEARISH' : 'BULLISH';
  
  const supertrendValue = direction === 'BULLISH' ? basicLowerBand : basicUpperBand;
  
  return { value: supertrendValue, direction };
}

// Calculate RSI
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

// Calculate EMA
function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// Detect advanced micro patterns
function detectMicroPattern(closes: number[], highs: number[], lows: number[], vwap: number): string {
  if (closes.length < 20) return 'NONE';
  
  const currentPrice = closes[closes.length - 1];
  const recentCloses = closes.slice(-20);
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  
  // VWAP bounce
  if (Math.abs(currentPrice - vwap) / vwap < 0.001 && currentPrice > closes[closes.length - 2]) {
    return 'VWAP BOUNCE';
  }
  
  // VWAP breakout
  if (currentPrice > vwap * 1.005 && closes[closes.length - 2] < vwap) {
    return 'VWAP BREAKOUT';
  }
  
  // Flag pattern
  const isUptrend = closes[closes.length - 1] > closes[closes.length - 10];
  const consolidationRange = Math.max(...recentHighs.slice(-5)) - Math.min(...recentLows.slice(-5));
  const avgRange = (Math.max(...recentHighs) - Math.min(...recentLows)) / 2;
  
  if (consolidationRange < avgRange * 0.3 && isUptrend) {
    return 'BULL FLAG';
  }
  
  // Pennant pattern
  const higherLows = recentLows[recentLows.length - 1] > recentLows[recentLows.length - 5];
  const lowerHighs = recentHighs[recentHighs.length - 1] < recentHighs[recentHighs.length - 5];
  
  if (higherLows && lowerHighs) {
    return 'PENNANT';
  }
  
  // Price action breakout
  const recentHigh = Math.max(...recentHighs.slice(0, -2));
  if (currentPrice > recentHigh * 1.01) {
    return 'BREAKOUT';
  }
  
  // Support bounce
  const recentLow = Math.min(...recentLows.slice(0, -2));
  if (currentPrice > recentLow && currentPrice < recentLow * 1.005) {
    return 'SUPPORT BOUNCE';
  }
  
  return 'CONSOLIDATION';
}

// Analyze order book imbalance
function analyzeOrderBookImbalance(closes: number[], volumes: number[]): number {
  if (closes.length < 10) return 0;
  
  const recentCloses = closes.slice(-10);
  const recentVolumes = volumes.slice(-10);
  
  let buyVolume = 0;
  let sellVolume = 0;
  
  for (let i = 1; i < recentCloses.length; i++) {
    if (recentCloses[i] > recentCloses[i - 1]) {
      buyVolume += recentVolumes[i];
    } else {
      sellVolume += recentVolumes[i];
    }
  }
  
  const totalVolume = buyVolume + sellVolume;
  if (totalVolume === 0) return 0;
  
  return (buyVolume - sellVolume) / totalVolume;
}

// Detect volume spike
function detectVolumeSpike(volumes: number[]): boolean {
  if (volumes.length < 20) return false;
  
  const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
  const currentVolume = volumes[volumes.length - 1];
  
  return currentVolume > avgVolume * 2;
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
  
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeframe = '5m', limit = 50 } = await req.json().catch(() => ({}));
    
    console.log(`📊 Enhanced Intraday Scanner (VWAP + Supertrend): ${timeframe}`);
    
    // Get user parameters if authenticated
    const authHeader = req.headers.get('Authorization');
    let userParams = {
      rsi_oversold_threshold: 30,
      rsi_overbought_threshold: 70,
      confidence_threshold: 60,
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
              confidence_threshold: params.confidence_threshold,
              max_leverage: params.max_leverage
            };
            console.log('✅ Using personalized parameters');
          }
        }
      } catch (e) {
        console.log('Using default parameters');
      }
    }

    // Fetch top liquid pairs
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const tickers = await response.json();
    
    const usdtPairs = tickers
      .filter((t: any) => 
        t.symbol.endsWith('USDT') && 
        !t.symbol.includes('DOWN') && 
        !t.symbol.includes('UP') &&
        parseFloat(t.quoteVolume) > 50000000
      )
      .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, limit);

    const signals: IntradaySignal[] = [];

    for (const ticker of usdtPairs) {
      try {
        const klinesRes = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${ticker.symbol}&interval=${timeframe}&limit=200`
        );
        const klines = await klinesRes.json();

        if (!Array.isArray(klines) || klines.length < 50) continue;

        const closes = klines.map((k: any) => parseFloat(k[4]));
        const highs = klines.map((k: any) => parseFloat(k[2]));
        const lows = klines.map((k: any) => parseFloat(k[3]));
        const volumes = klines.map((k: any) => parseFloat(k[5]));

        const currentPrice = closes[closes.length - 1];
        
        // Calculate indicators
        const rsi = calculateRSI(closes, 14);
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(highs, lows, closes, 14);
        
        // NEW: Calculate VWAP and Supertrend
        const vwap = calculateVWAP(highs, lows, closes, volumes);
        const supertrend = calculateSupertrend(highs, lows, closes, atr, 3);
        
        // Detect patterns with VWAP context
        const microPattern = detectMicroPattern(closes, highs, lows, vwap);
        const orderBookImbalance = analyzeOrderBookImbalance(closes, volumes);
        const volumeSpike = detectVolumeSpike(volumes);
        const momentum = ((ema9 - ema21) / ema21) * 100;
        
        // Enhanced signal detection with VWAP and Supertrend
        let signal: 'LONG' | 'SHORT' | null = null;
        let confidence = 0;
        
        // LONG conditions (enhanced with VWAP and Supertrend)
        if (
          rsi < userParams.rsi_oversold_threshold + 5 &&
          ema9 > ema21 &&
          currentPrice > vwap * 0.998 && // Near or above VWAP
          supertrend.direction === 'BULLISH' &&
          orderBookImbalance > 0.2 &&
          (microPattern === 'BULL FLAG' || microPattern === 'VWAP BOUNCE' || 
           microPattern === 'VWAP BREAKOUT' || microPattern === 'BREAKOUT')
        ) {
          signal = 'LONG';
          confidence = 65;
          
          if (volumeSpike) confidence += 12;
          if (orderBookImbalance > 0.4) confidence += 8;
          if (microPattern === 'VWAP BREAKOUT' || microPattern === 'BREAKOUT') confidence += 10;
          if (currentPrice > vwap * 1.002) confidence += 5;
          if (rsi < 30) confidence += 5;
        }
        
        // SHORT conditions (enhanced with VWAP and Supertrend)
        if (
          rsi > userParams.rsi_overbought_threshold - 5 &&
          ema9 < ema21 &&
          currentPrice < vwap * 1.002 && // Near or below VWAP
          supertrend.direction === 'BEARISH' &&
          orderBookImbalance < -0.2
        ) {
          signal = 'SHORT';
          confidence = 65;
          
          if (volumeSpike) confidence += 12;
          if (orderBookImbalance < -0.4) confidence += 8;
          if (currentPrice < vwap * 0.998) confidence += 5;
          if (rsi > 70) confidence += 5;
        }
        
        // Only add signals with sufficient confidence
        if (signal && confidence >= userParams.confidence_threshold) {
          const stopLoss = signal === 'LONG' 
            ? currentPrice - (atr * 0.5)
            : currentPrice + (atr * 0.5);
          
          const tp1 = signal === 'LONG'
            ? currentPrice + (atr * 0.8)
            : currentPrice - (atr * 0.8);
          
          const tp2 = signal === 'LONG'
            ? currentPrice + (atr * 1.5)
            : currentPrice - (atr * 1.5);
          
          const tp3 = signal === 'LONG'
            ? currentPrice + (atr * 2.5)
            : currentPrice - (atr * 2.5);
          
          const durationMap: { [key: string]: string } = {
            '1m': '5-15 min',
            '5m': '15-45 min',
            '15m': '1-3 heures',
            '1h': '3-8 heures'
          };
          
          signals.push({
            symbol: ticker.symbol,
            name: ticker.symbol.replace('USDT', ''),
            timeframe: timeframe as '1m' | '5m' | '15m' | '1h',
            signal,
            entry: currentPrice,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2,
            takeProfit3: tp3,
            confidence,
            microPattern,
            vwap,
            supertrend: supertrend.value,
            supertrendDirection: supertrend.direction,
            orderBookImbalance: Math.round(orderBookImbalance * 100),
            volumeSpike,
            momentum: Math.round(momentum * 100) / 100,
            expectedDuration: durationMap[timeframe] || '1-3 heures'
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${ticker.symbol}:`, error);
        continue;
      }
    }

    signals.sort((a, b) => b.confidence - a.confidence);

    console.log(`✅ Found ${signals.length} enhanced signals on ${timeframe}`);

    return new Response(
      JSON.stringify({
        signals,
        timeframe,
        analyzed: usdtPairs.length,
        count: signals.length,
        timestamp: new Date().toISOString(),
        features: ['VWAP', 'Supertrend', 'Enhanced Patterns']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Enhanced intraday scanner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      signals: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});