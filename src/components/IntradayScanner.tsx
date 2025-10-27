import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './ui/use-toast';
import { Clock, TrendingUp, TrendingDown, Zap } from 'lucide-react';

export const IntradayScanner = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '1h'>('5m');
  const { toast } = useToast();

  const scanMarket = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('intraday-scanner', {
        body: { timeframe, limit: 50 }
      });

      if (error) throw error;

      setSignals(data.signals || []);
      toast({
        title: "Scan terminé",
        description: `${data.count} signaux trouvés sur ${timeframe}`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['5m', '15m', '1h'].map((tf) => (
          <Button
            key={tf}
            variant={timeframe === tf ? 'default' : 'outline'}
            onClick={() => setTimeframe(tf as any)}
          >
            {tf}
          </Button>
        ))}
        <Button onClick={scanMarket} disabled={loading}>
          <Zap className="w-4 h-4 mr-2" />
          Scanner
        </Button>
      </div>

      <div className="grid gap-4">
        {signals.map((signal) => (
          <Card key={signal.symbol} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{signal.name}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge variant={signal.signal === 'LONG' ? 'default' : 'destructive'}>
                    {signal.signal === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {signal.signal}
                  </Badge>
                  <Badge variant="outline">{signal.microPattern}</Badge>
                  {signal.volumeSpike && <Badge>📊 Volume Spike</Badge>}
                </div>
              </div>
              <Badge variant="secondary">{signal.confidence}%</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
              <div>
                <p className="text-muted-foreground">Entrée</p>
                <p className="font-mono">${signal.entry.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">TP1/TP2/TP3</p>
                <p className="font-mono text-xs">
                  ${signal.takeProfit1.toFixed(4)}<br/>
                  ${signal.takeProfit2.toFixed(4)}<br/>
                  ${signal.takeProfit3.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">SL</p>
                <p className="font-mono">${signal.stopLoss.toFixed(4)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {signal.expectedDuration}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
