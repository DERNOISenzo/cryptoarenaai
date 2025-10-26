import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Sparkles, Brain, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import LearningEnginePanel from "@/components/LearningEnginePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Opportunity {
  symbol: string;
  name: string;
  score: number;
  price: number;
  change24h: number;
  drawdownFromATH: number;
  rsi: number;
  momentum: number;
  volumeIncrease: number;
  strategy: string;
  thesis: string;
}

const MarketAnalysis = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        navigate("/auth");
      }
    };
    loadUser();
  }, [navigate]);

  useEffect(() => {
    loadMarketAnalysis();
  }, []);

  const loadMarketAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('market-analysis');

      if (error) throw error;

      setOpportunities(data.opportunities);
      
      toast({
        title: "✅ Analyse terminée",
        description: `${data.opportunities.length} opportunités détectées`,
        duration: 3000
      });
    } catch (error) {
      console.error('Market analysis error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger l'analyse du marché",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Brain className="w-16 h-16 text-primary mx-auto animate-pulse" />
          <h2 className="text-2xl font-bold">Analyse du marché en cours...</h2>
          <p className="text-muted-foreground">
            Scan de 50+ cryptomonnaies pour trouver les meilleures opportunités
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {userId && <Header userId={userId} />}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <Button onClick={loadMarketAnalysis} className="gap-2 bg-primary">
              <Sparkles className="w-4 h-4" />
              Actualiser
            </Button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold">Analyse Globale du Marché</h1>
            <p className="text-muted-foreground text-lg">
              Les meilleures opportunités du moment basées sur une analyse multi-facteurs
            </p>
          </div>

          <Tabs defaultValue="opportunities" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="opportunities">Opportunités</TabsTrigger>
              <TabsTrigger value="learning">
                <Settings className="w-4 h-4 mr-2" />
                Optimisation IA
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities" className="space-y-6 mt-6">
              <div className="grid gap-6">
            {opportunities.map((opp, idx) => (
              <Card key={idx} className="p-6 hover:shadow-xl transition-shadow">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Left: Basic Info */}
                  <div className="space-y-3">
                      <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold">{opp.name}</h3>
                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-primary">{opp.score.toFixed(0)}</span>
                          <span className="text-lg text-muted-foreground">/100</span>
                        </div>
                        <Badge className={
                          opp.score >= 80 ? "bg-success" :
                          opp.score >= 65 ? "bg-primary" :
                          "bg-warning"
                        }>
                          {opp.score >= 80 ? "Excellent" : opp.score >= 65 ? "Bon" : "Correct"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-4">
                      <span className="text-2xl font-bold">${opp.price.toFixed(opp.price < 1 ? 6 : 2)}</span>
                      <Badge variant={opp.change24h >= 0 ? "default" : "destructive"}>
                        {opp.change24h >= 0 ? "+" : ""}{opp.change24h.toFixed(2)}%
                      </Badge>
                    </div>

                    <Badge className="bg-primary">{opp.strategy}</Badge>
                  </div>

                  {/* Middle: Indicators */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-3 bg-secondary/30">
                      <p className="text-xs text-muted-foreground mb-1">Drawdown ATH</p>
                      <p className="text-lg font-bold text-danger">{opp.drawdownFromATH.toFixed(1)}%</p>
                    </Card>
                    <Card className="p-3 bg-secondary/30">
                      <p className="text-xs text-muted-foreground mb-1">RSI</p>
                      <p className="text-lg font-bold">{opp.rsi.toFixed(1)}</p>
                    </Card>
                    <Card className="p-3 bg-secondary/30">
                      <p className="text-xs text-muted-foreground mb-1">Momentum</p>
                      <p className="text-lg font-bold text-success">+{opp.momentum.toFixed(1)}%</p>
                    </Card>
                    <Card className="p-3 bg-secondary/30">
                      <p className="text-xs text-muted-foreground mb-1">Volume</p>
                      <p className="text-lg font-bold text-primary">+{opp.volumeIncrease.toFixed(0)}%</p>
                    </Card>
                  </div>

                  {/* Right: Thesis */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">Thèse d'investissement</h4>
                    </div>
                    {opp.thesis.includes('•') || opp.thesis.includes('-') ? (
                      <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                        {opp.thesis.split(/[•-]/).filter(t => t.trim()).map((point, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{point.trim()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {opp.thesis}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
              </div>

              {opportunities.length === 0 && (
                <Card className="p-12 text-center">
                  <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Aucune opportunité détectée</h3>
                  <p className="text-muted-foreground">
                    Le marché ne présente pas d'opportunités majeures actuellement.
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="learning" className="mt-6">
              <LearningEnginePanel />
            </TabsContent>
          </Tabs>
          

        </div>
      </div>
    </div>
  );
};

export default MarketAnalysis;