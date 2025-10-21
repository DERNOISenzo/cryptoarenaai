import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp } from "lucide-react";

interface TradingBotAIProps {
  symbol: string;
  cryptoName: string;
}

const TradingBotAI = ({ symbol, cryptoName }: TradingBotAIProps) => {
  const [recommendation, setRecommendation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getAIRecommendation = async (action: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trading-bot-ai', {
        body: { symbol, action }
      });

      if (error) throw error;

      setRecommendation(data.recommendation);
      toast({
        title: "✅ Analyse IA terminée",
        description: "Le bot a analysé le marché",
      });
    } catch (error) {
      console.error('AI Bot error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible d'obtenir l'analyse IA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold">Bot de Trading IA - {cryptoName}</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Bot intelligent avec apprentissage continu du marché
      </p>

      <div className="flex gap-2 flex-wrap">
        <Button 
          onClick={() => getAIRecommendation("analyse complète")}
          disabled={loading}
          variant="default"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Analyse Complète
        </Button>
        <Button 
          onClick={() => getAIRecommendation("opportunité d'achat")}
          disabled={loading}
          variant="outline"
        >
          Opportunité d'Achat
        </Button>
        <Button 
          onClick={() => getAIRecommendation("gestion des risques")}
          disabled={loading}
          variant="outline"
        >
          Gestion des Risques
        </Button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Analyse en cours...</p>
        </div>
      )}

      {recommendation && !loading && (
        <div className="bg-secondary/50 p-4 rounded-lg">
          <h4 className="font-bold mb-2">Recommandation du Bot IA:</h4>
          <div className="whitespace-pre-wrap text-sm">{recommendation}</div>
        </div>
      )}
    </Card>
  );
};

export default TradingBotAI;
