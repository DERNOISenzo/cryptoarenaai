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
  const [activeButton, setActiveButton] = useState<string>("");
  const { toast } = useToast();

  const getAIRecommendation = async (action: string) => {
    setLoading(true);
    setActiveButton(action);
    try {
      const { data, error } = await supabase.functions.invoke('trading-bot-ai', {
        body: { symbol, action }
      });

      if (error) throw error;

      setRecommendation(data.recommendation);
      toast({
        title: "✅ Analyse IA terminée",
        description: "Le bot a analysé le marché",
        duration: 3000
      });
    } catch (error) {
      console.error('AI Bot error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible d'obtenir l'analyse IA",
        variant: "destructive",
        duration: 3000
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
          variant={activeButton === "analyse complète" ? "default" : "outline"}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Analyse Complète
        </Button>
        <Button 
          onClick={() => getAIRecommendation("opportunité d'achat")}
          disabled={loading}
          variant={activeButton === "opportunité d'achat" ? "default" : "outline"}
        >
          Opportunité d'Achat
        </Button>
        <Button 
          onClick={() => getAIRecommendation("gestion des risques")}
          disabled={loading}
          variant={activeButton === "gestion des risques" ? "default" : "outline"}
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
          <h4 className="font-bold mb-2 text-lg">Recommandation du Bot IA:</h4>
          <div className="prose prose-sm max-w-none">
            {recommendation.split('\n').map((line, idx) => {
              if (line.trim().startsWith('##')) {
                return <h3 key={idx} className="font-bold text-base mt-4 mb-2">{line.replace(/^##\s*/, '')}</h3>;
              }
              if (line.trim().startsWith('#')) {
                return <h2 key={idx} className="font-bold text-lg mt-4 mb-2">{line.replace(/^#\s*/, '')}</h2>;
              }
              if (line.trim().startsWith('-')) {
                return <li key={idx} className="ml-4">{line.replace(/^-\s*/, '')}</li>;
              }
              if (line.trim()) {
                return <p key={idx} className="mb-2">{line}</p>;
              }
              return <br key={idx} />;
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default TradingBotAI;
