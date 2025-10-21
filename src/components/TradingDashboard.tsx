import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowLeft, 
  Activity, 
  Target,
  AlertTriangle,
  Brain,
  Sparkles,
  Newspaper,
  Twitter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AlertsManager from "@/components/AlertsManager";
import TradingBotAI from "./TradingBotAI";

interface TradingDashboardProps {
  crypto: string;
  cryptoName: string;
  onBack: () => void;
}

interface Analysis {
  signal: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  leverage: number;
  price: number;
  change24h: number;
  indicators: {
    rsi: number;
    macd: string;
    bb: string;
    atr: number;
  };
  recommendation: string;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
}

const TradingDashboard = ({ crypto, cryptoName, onBack }: TradingDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [news, setNews] = useState<any[]>([]);
  const [tweets, setTweets] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadAnalysis();
  }, [crypto]);

  const loadAnalysis = async () => {
    setLoading(true);
    
    try {
      // Load analysis from edge function
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('crypto-analysis', {
        body: { symbol: crypto }
      });

      if (analysisError) throw analysisError;

      // Load news from edge function
      const baseAsset = crypto.replace('USDT', '').replace('USDC', '').replace('BTC', '').replace('ETH', '');
      const { data: newsData, error: newsError } = await supabase.functions.invoke('crypto-news', {
        body: { symbol: crypto, baseAsset }
      });

      if (newsError) {
        console.error('News error:', newsError);
      } else {
        setNews(newsData?.news || []);
        setTweets(newsData?.tweets || []);
      }

      // Transform the data to match our interface
      const transformedAnalysis: Analysis = {
        signal: analysisData.analysis.signal,
        confidence: analysisData.analysis.confidence,
        leverage: analysisData.analysis.leverage,
        price: analysisData.analysis.price,
        change24h: analysisData.analysis.change24h,
        indicators: {
          rsi: analysisData.analysis.indicators.rsi14,
          macd: analysisData.analysis.indicators.macdHist > 0 ? "Haussier" : "Baissier",
          bb: analysisData.analysis.price < analysisData.analysis.indicators.bbLower * 1.01 ? "Survente" : 
              analysisData.analysis.price > analysisData.analysis.indicators.bbUpper * 0.99 ? "Surachat" : "Neutre",
          atr: analysisData.analysis.indicators.atr14,
        },
        recommendation: analysisData.analysis.recommendation,
        takeProfit: analysisData.analysis.takeProfit,
        stopLoss: analysisData.analysis.stopLoss,
        riskReward: analysisData.analysis.riskReward,
      };
      
      setAnalysis(transformedAnalysis);
      setLoading(false);
      
      toast({
        title: "✅ Analyse terminée",
        description: `${crypto} analysé avec des données réelles`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      setLoading(false);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger l'analyse",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Brain className="w-16 h-16 text-primary mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold">Analyse en cours...</h2>
          <p className="text-muted-foreground">
            L'IA analyse {crypto} sur tous les indicateurs
          </p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const isLong = analysis.signal === "LONG";
  const isShort = analysis.signal === "SHORT";
  const signalColor = isLong ? "success" : isShort ? "danger" : "muted";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <Button onClick={loadAnalysis} className="gap-2 bg-primary">
            <Sparkles className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        {/* Main Signal Card */}
        <Card className="p-8 border-2 border-primary/50 bg-gradient-to-br from-card to-secondary/50 shadow-2xl">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-2">{crypto}</h1>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-bold">${analysis.price.toFixed(2)}</span>
                  <Badge variant={analysis.change24h >= 0 ? "default" : "destructive"} className="text-lg px-3 py-1">
                    {analysis.change24h >= 0 ? "+" : ""}{analysis.change24h.toFixed(2)}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${
                    isLong ? "bg-success" : isShort ? "bg-danger" : "bg-muted"
                  }`} style={{
                    boxShadow: isLong 
                      ? "0 0 20px hsl(var(--success))"
                      : isShort 
                      ? "0 0 20px hsl(var(--danger))"
                      : "none"
                  }} />
                  <span className="text-muted-foreground">Signal IA</span>
                </div>
                <div className="flex items-center gap-4">
                  {isLong ? (
                    <TrendingUp className="w-12 h-12 text-success" />
                  ) : isShort ? (
                    <TrendingDown className="w-12 h-12 text-danger" />
                  ) : (
                    <Activity className="w-12 h-12 text-muted" />
                  )}
                  <div>
                    <h2 className={`text-4xl font-bold text-${signalColor}`}>
                      {analysis.signal}
                    </h2>
                    <p className="text-muted-foreground">Position recommandée</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="p-6 bg-secondary/30 border-border">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Niveau de confiance</span>
                      <span className="font-semibold">{analysis.confidence.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${
                          isLong ? "from-success to-primary" : "from-danger to-destructive"
                        } transition-all duration-1000`}
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Levier suggéré</p>
                      <p className="text-2xl font-bold">{analysis.leverage}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Risk/Reward</p>
                      <p className="text-2xl font-bold">1:{analysis.riskReward.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-secondary/30 border-border">
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Take Profit:</span>
                      <span className="font-semibold text-success">${analysis.takeProfit.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stop Loss:</span>
                      <span className="font-semibold text-danger">${analysis.stopLoss.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Card>

        {/* Indicators Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-6 bg-card border-border">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">RSI (14)</p>
              <p className="text-3xl font-bold">{analysis.indicators.rsi.toFixed(1)}</p>
              <Badge variant={analysis.indicators.rsi < 30 ? "default" : analysis.indicators.rsi > 70 ? "destructive" : "secondary"}>
                {analysis.indicators.rsi < 30 ? "Survente" : analysis.indicators.rsi > 70 ? "Surachat" : "Neutre"}
              </Badge>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">MACD</p>
              <p className="text-2xl font-bold">{analysis.indicators.macd}</p>
              <Badge variant={analysis.indicators.macd === "Haussier" ? "default" : "destructive"}>
                {analysis.indicators.macd}
              </Badge>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Bollinger Bands</p>
              <p className="text-2xl font-bold">{analysis.indicators.bb}</p>
              <Badge variant="secondary">{analysis.indicators.bb}</Badge>
            </div>
          </Card>

          <Card className="p-6 bg-card border-border">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">ATR (14)</p>
              <p className="text-3xl font-bold">{analysis.indicators.atr.toFixed(0)}</p>
              <Badge variant="outline">Volatilité</Badge>
            </div>
          </Card>
        </div>

        {/* AI Trading Bot */}
        <TradingBotAI symbol={crypto} cryptoName={cryptoName} />

        {/* Alerts Manager */}
        <AlertsManager 
          symbol={crypto} 
          cryptoName={cryptoName}
          currentPrice={analysis.price} 
        />

        {/* News Section */}
        {news.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Actualités Crypto</h3>
              <Badge variant="secondary">{news.length}</Badge>
            </div>
            <div className="space-y-3">
              {news.slice(0, 5).map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Badge 
                      variant={item.sentiment === 'positive' ? 'default' : item.sentiment === 'negative' ? 'destructive' : 'outline'}
                      className="mt-1"
                    >
                      {item.sentiment === 'positive' ? '🟢' : item.sentiment === 'negative' ? '🔴' : '⚪'}
                    </Badge>
                    <div className="flex-1">
                      <h4 className="font-medium leading-tight mb-1">{item.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{item.source}</span>
                        <span>•</span>
                        <span>{new Date(item.published).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Tweets Section */}
        {tweets.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Twitter className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Tweets Récents</h3>
              <Badge variant="secondary">{tweets.length}</Badge>
            </div>
            <div className="space-y-3">
              {tweets.slice(0, 5).map((tweet, idx) => (
                <div key={idx} className="p-4 bg-secondary/30 rounded-lg">
                  <p className="text-sm leading-relaxed mb-2">{tweet.text}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{new Date(tweet.created).toLocaleDateString('fr-FR')}</span>
                    <span>❤️ {tweet.likes}</span>
                    <span>🔄 {tweet.retweets}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recommendation */}
        <Card className="p-6 bg-card border-l-4 border-l-primary">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Recommandation de l'IA</h3>
              <p className="text-muted-foreground leading-relaxed">
                {analysis.recommendation}. L'analyse multi-timeframes (1h, 4h, 1j) suggère une position{" "}
                <span className={`font-bold text-${signalColor}`}>{analysis.signal}</span>{" "}
                avec un niveau de confiance de {analysis.confidence.toFixed(1)}%.
                Le levier recommandé de {analysis.leverage}x est calculé en fonction de la volatilité actuelle (ATR).
              </p>
              <p className="text-sm text-muted-foreground italic">
                ⚠️ Cette analyse est fournie à titre informatif. Toujours faire ses propres recherches et utiliser une gestion de risque appropriée.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TradingDashboard;
