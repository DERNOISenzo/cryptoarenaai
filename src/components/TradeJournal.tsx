import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TradeJournalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisData: {
    symbol: string;
    cryptoName: string;
    signal: string;
    entryPrice: number;
    takeProfit: number;
    stopLoss: number;
    leverage: number;
  };
}

const TradeJournal = ({ open, onOpenChange, analysisData }: TradeJournalProps) => {
  const [formData, setFormData] = useState({
    entryPrice: analysisData.entryPrice.toString(),
    exitPrice: '',
    resultPercent: '',
    resultAmount: ''
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const saveTrade = async () => {
    if (!formData.exitPrice) {
      toast({
        title: "⚠️ Prix de sortie requis",
        description: "Veuillez entrer le prix de sortie",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const exitPrice = parseFloat(formData.exitPrice);
      const entryPrice = parseFloat(formData.entryPrice);
      
      // Calculate result
      const isLong = analysisData.signal === 'LONG';
      const priceChange = isLong 
        ? ((exitPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - exitPrice) / entryPrice) * 100;
      
      const leveragedResult = priceChange * analysisData.leverage;

      const { error } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: analysisData.symbol,
          crypto_name: analysisData.cryptoName,
          signal: analysisData.signal,
          entry_price: entryPrice,
          exit_price: exitPrice,
          take_profit: analysisData.takeProfit,
          stop_loss: analysisData.stopLoss,
          leverage: analysisData.leverage,
          result_percent: leveragedResult,
          result_amount: parseFloat(formData.resultAmount || '0'),
          status: 'closed',
          closed_at: new Date().toISOString(),
          analysis_data: analysisData
        });

      if (error) throw error;

      toast({
        title: "✅ Trade enregistré",
        description: "Votre trade a été ajouté au journal"
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Save trade error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible d'enregistrer le trade",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Enregistrer le Trade
          </DialogTitle>
          <DialogDescription>
            Ajoutez ce trade à votre journal de performance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 bg-secondary/30">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Crypto:</span>
                <p className="font-semibold">{analysisData.cryptoName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Signal:</span>
                <p className="font-semibold">{analysisData.signal}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entry:</span>
                <p className="font-semibold">${analysisData.entryPrice.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Levier:</span>
                <p className="font-semibold">{analysisData.leverage}x</p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <div>
              <Label>Prix de sortie ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.exitPrice}
                onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                placeholder="Prix auquel vous avez vendu"
              />
            </div>

            <div>
              <Label>Montant gagné/perdu ($) (optionnel)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.resultAmount}
                onChange={(e) => setFormData({ ...formData, resultAmount: e.target.value })}
                placeholder="Entrez le montant en $ si connu"
              />
            </div>
          </div>

          <Button onClick={saveTrade} disabled={loading} className="w-full">
            {loading ? 'Enregistrement...' : 'Enregistrer dans le journal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeJournal;