import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, TrendingDown, Clock, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface IntradaySignal {
  symbol: string;
  cryptoName: string;
  signal: 'LONG' | 'SHORT';
  confidence: number;
  currentPrice: number;
  entryPrice: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  stopLoss: number;
  leverage: number;
  timeframe: string;
  patterns: string[];
  volumeSpike: boolean;
  orderBookImbalance: string;
}

const DayTradingScanner = () => {
  const [signals, setSignals] = useState<IntradaySignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m'>('5m');
  const { toast } = useToast();

  const scanMarket = async () => {
    setLoading(true);
    try {
      const topCoins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
      
      const results = await Promise.all(
        topCoins.map(async (symbol) => {
          try {
            const { data, error } = await supabase.functions.invoke('intraday-scanner', {
              body: { symbol, timeframe }
            });

            if (error) throw error;
            return data;
          } catch (error) {
            console.error(`Error scanning ${symbol}:`, error);
            return null;
          }
        })
      );

      const validSignals = results.filter(r => r !== null && r.signal !== 'NEUTRAL');
      setSignals(validSignals);

      toast({
        title: "✅ Scan terminé",
        description: `${validSignals.length} opportunités trouvées`
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de scanner le marché",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold">Scanner Day Trading</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="p-2 border border-border rounded-md bg-background text-sm"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as '1m' | '5m' | '15m')}
            >
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
            </select>
            <Button onClick={scanMarket} disabled={loading}>
              {loading ? 'Scan en cours...' : 'Scanner le marché'}
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          <p>⚡ Scanner ultra-rapide pour détecter les opportunités intraday</p>
          <p>📊 Analyse du carnet d'ordres, micro-patterns et volume</p>
        </div>
      </Card>

      {signals.length > 0 && (
        <div className="grid gap-4">
          {signals.map((signal, index) => (
            <Card key={index} className="p-4 hover:bg-secondary/30 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Crypto</p>
                  <p className="font-bold text-lg">{signal.cryptoName}</p>
                  <p className="text-xs text-muted-foreground">{signal.symbol}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Signal</p>
                  <div className="flex items-center gap-2">
                    {signal.signal === 'LONG' ? (
                      <TrendingUp className="w-5 h-5 text-success" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-danger" />
                    )}
                    <span className={`font-bold ${signal.signal === 'LONG' ? 'text-success' : 'text-danger'}`}>
                      {signal.signal}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={signal.confidence > 75 ? "default" : "secondary"}>
                      {signal.confidence}% confiance
                    </Badge>
                    <Badge variant="outline">{signal.leverage}x</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Prix & Targets</p>
                  <p className="text-sm">Entry: <span className="font-semibold">${signal.entryPrice.toFixed(2)}</span></p>
                  <div className="flex items-center gap-2 text-xs mt-1">
                    <Target className="w-3 h-3 text-success" />
                    <span>TP1: ${signal.takeProfit1.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-danger">SL: ${signal.stopLoss.toFixed(2)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Détails</p>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{signal.timeframe}</span>
                  </div>
                  {signal.volumeSpike && (
                    <Badge variant="secondary" className="mt-1">
                      📈 Volume Spike
                    </Badge>
                  )}
                  {signal.patterns.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {signal.patterns.join(', ')}
                    </p>
                  )}
                  <p className="text-xs mt-1">
                    Carnet: <span className="font-semibold">{signal.orderBookImbalance}</span>
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {signals.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Cliquez sur "Scanner le marché" pour détecter les opportunités day trading
          </p>
        </Card>
      )}
    </div>
  );
};

export default DayTradingScanner;
