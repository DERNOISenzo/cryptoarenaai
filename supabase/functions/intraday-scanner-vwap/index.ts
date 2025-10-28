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
function calculateSupertrend(highs: number[], lows: number[], closes: number[], atr: number, multiplier = 3): { value: number; direction: 'BULLISH' | 'BEARISH' } {
  const len = closes.length;
  const hl2 = (highs[len - 1] + lows[len - 1]) / 2;
  
  const basicUpperBand = hl2 + (multiplier * atr);
  const basicLowerBand = hl2 - (multiplier * atr);
  
  const currentPrice = closes[len - 1];
  
  if (currentPrice > basicUpperBand) {
    return { value: basicLowerBand, direction: 'BULLISH' };
  } else if (currentPrice < basicLowerBand) {
    return { value: basicUpperBand, direction: 'BEARISH' };
  } else {
    return currentPrice > hl2 
      ? { value: basicLowerBand, direction: 'BULLISH' }
      : { value: basicUpperBand, direction: 'BEARISH' };
  }
}

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

function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

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

function detectAdvancedPattern(
  closes: number[], 
  vwap: number, 
  supertrend: { value: number; direction: 'BULLISH' | 'BEARISH' }
): string {
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  
  if (prevPrice < vwap && currentPrice > vwap) {
    return 'VWAP BOUNCE';
  }
  
  if (currentPrice > vwap * 1.005 && supertrend.direction === 'BULLISH') {
    return 'VWAP BREAKOUT';
  }
  
  if (supertrend.direction === 'BULLISH' && currentPrice > supertrend.value) {
    return 'ST REVERSAL BULL';
  }
  
  if (supertrend.direction === 'BEARISH' && currentPrice < supertrend.value) {
    return 'ST REVERSAL BEAR';
  }
  
  if (currentPrice < vwap * 0.995) {
    return 'VWAP REJECTION';
  }
  
  return 'CONSOLIDATION';
}

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

function detectVolumeSpike(volumes: number[]): boolean {
  if (volumes.length < 20) return false;
  
  const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19;
  const currentVolume = volumes[volumes.length - 1];
  
  return currentVolume > avgVolume * 2;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { timeframe = '5m', limit = 20 } = await req.json().catch(() => ({}));
    
    console.log(`📊 VWAP/Supertrend Scanner: ${timeframe}`);
    
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
            .maybeSingle();
          
          if (params) {
            userParams = {
              rsi_oversold_threshold: params.rsi_oversold_threshold,
              rsi_overbought_threshold: params.rsi_overbought_threshold,
              confidence_threshold: params.confidence_threshold,
              max_leverage: params.max_leverage
            };
          }
        }
      } catch (e) {
        console.log('Using defaults');
      }
    }

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
        
        const rsi = calculateRSI(closes, 14);
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        const atr = calculateATR(highs, lows, closes, 14);
        const vwap = calculateVWAP(highs, lows, closes, volumes);
        const supertrend = calculateSupertrend(highs, lows, closes, atr);
        const microPattern = detectAdvancedPattern(closes, vwap, supertrend);
        const orderBookImbalance = analyzeOrderBookImbalance(closes, volumes);
        const volumeSpike = detectVolumeSpike(volumes);
        const momentum = ((ema9 - ema21) / ema21) * 100;
        
        let signal: 'LONG' | 'SHORT' | null = null;
        let confidence = 0;
        
        if (
          currentPrice > vwap &&
          supertrend.direction === 'BULLISH' &&
          currentPrice > supertrend.value &&
          rsi < userParams.rsi_oversold_threshold + 10 &&
          ema9 > ema21 &&
          orderBookImbalance > 0.15
        ) {
          signal = 'LONG';
          confidence = 60;
          
          if (microPattern === 'VWAP BOUNCE' || microPattern === 'VWAP BREAKOUT') confidence += 15;
          if (volumeSpike) confidence += 10;
          if (orderBookImbalance > 0.4) confidence += 10;
          if (currentPrice > vwap * 1.01) confidence += 5;
        }
        
        if (
          currentPrice < vwap &&
          supertrend.direction === 'BEARISH' &&
          currentPrice < supertrend.value &&
          rsi > userParams.rsi_overbought_threshold - 10 &&
          ema9 < ema21 &&
          orderBookImbalance < -0.15
        ) {
          signal = 'SHORT';
          confidence = 60;
          
          if (microPattern === 'VWAP REJECTION' || microPattern === 'ST REVERSAL BEAR') confidence += 15;
          if (volumeSpike) confidence += 10;
          if (orderBookImbalance < -0.4) confidence += 10;
          if (currentPrice < vwap * 0.99) confidence += 5;
        }
        
        if (signal && confidence >= userParams.confidence_threshold) {
          const stopLoss = signal === 'LONG' 
            ? currentPrice - (atr * 0.6)
            : currentPrice + (atr * 0.6);
          
          const tp1 = signal === 'LONG'
            ? currentPrice + (atr * 1.0)
            : currentPrice - (atr * 1.0);
          
          const tp2 = signal === 'LONG'
            ? currentPrice + (atr * 1.8)
            : currentPrice - (atr * 1.8);
          
          const tp3 = signal === 'LONG'
            ? currentPrice + (atr * 3.0)
            : currentPrice - (atr * 3.0);
          
          const durationMap: { [key: string]: string } = {
            '1m': '3-10 min',
            '5m': '15-45 min',
            '15m': '45min-2h',
            '1h': '2-6 heures'
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
            expectedDuration: durationMap[timeframe] || '1-3h'
          });
        }
      } catch (error) {
        continue;
      }
    }

    signals.sort((a, b) => b.confidence - a.confidence);

    console.log(`✅ ${signals.length} signals found`);

    return new Response(
      JSON.stringify({
        signals,
        timeframe,
        analyzed: usdtPairs.length,
        count: signals.length,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Scanner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      signals: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
