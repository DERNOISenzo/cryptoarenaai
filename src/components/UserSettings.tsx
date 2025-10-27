import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";

interface UserSettingsProps {
  userId: string;
}

const UserSettings = ({ userId }: UserSettingsProps) => {
  const [capital, setCapital] = useState("1000");
  const [riskPercent, setRiskPercent] = useState("1");
  const [maxLossPerDay, setMaxLossPerDay] = useState("50");
  const [currentLossToday, setCurrentLossToday] = useState(0);
  const [tradeStyle, setTradeStyle] = useState("swing");
  const [exitStrategy, setExitStrategy] = useState("partial");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCapital(data.capital.toString());
        setRiskPercent(data.risk_percent_per_trade.toString());
        setMaxLossPerDay(data.max_loss_per_day.toString());
        setCurrentLossToday(parseFloat(data.current_loss_today.toString()));
        setTradeStyle(data.preferred_trade_style);
        setExitStrategy(data.exit_strategy);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          capital: parseFloat(capital),
          risk_percent_per_trade: parseFloat(riskPercent),
          max_loss_per_day: parseFloat(maxLossPerDay),
          preferred_trade_style: tradeStyle,
          exit_strategy: exitStrategy,
        });

      if (error) throw error;

      toast({
        title: "✅ Paramètres sauvegardés",
        description: "Vos préférences de trading ont été mises à jour",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de sauvegarder les paramètres",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const lossPercentage = currentLossToday > 0 
    ? (currentLossToday / parseFloat(maxLossPerDay)) * 100 
    : 0;

  const isBlocked = lossPercentage >= 100;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Paramètres de Trading</h2>
      </div>

      <div className="space-y-6">
        {/* Capital Management */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Gestion du Capital</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="capital">Capital Total ($)</Label>
              <Input
                id="capital"
                type="number"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                min="100"
                step="100"
              />
            </div>

            <div>
              <Label htmlFor="riskPercent">Risque par Trade (%)</Label>
              <Input
                id="riskPercent"
                type="number"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                min="0.1"
                max="10"
                step="0.1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Recommandé: 1-2%
              </p>
            </div>

            <div>
              <Label htmlFor="maxLoss">Perte Max / Jour ($)</Label>
              <Input
                id="maxLoss"
                type="number"
                value={maxLossPerDay}
                onChange={(e) => setMaxLossPerDay(e.target.value)}
                min="10"
                step="10"
              />
            </div>
          </div>
        </div>

        {/* Daily Loss Tracker */}
        {currentLossToday > 0 && (
          <Card className={`p-4 ${isBlocked ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/10'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${isBlocked ? 'text-destructive' : 'text-warning'}`} />
                <div>
                  <p className="font-semibold">Perte Aujourd'hui</p>
                  <p className="text-sm text-muted-foreground">
                    ${currentLossToday.toFixed(2)} / ${maxLossPerDay}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${isBlocked ? 'text-destructive' : 'text-warning'}`}>
                  {lossPercentage.toFixed(0)}%
                </p>
                {isBlocked && (
                  <p className="text-xs text-destructive font-semibold">
                    Trading bloqué
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Trading Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Préférences de Trading</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tradeStyle">Style de Trade Préféré</Label>
              <Select value={tradeStyle} onValueChange={setTradeStyle}>
                <SelectTrigger id="tradeStyle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scalp">🎯 Scalp (Court terme)</SelectItem>
                  <SelectItem value="swing">📊 Swing (Moyen terme)</SelectItem>
                  <SelectItem value="long">💎 Long Terme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="exitStrategy">Stratégie de Sortie</Label>
              <Select value={exitStrategy} onValueChange={setExitStrategy}>
                <SelectTrigger id="exitStrategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Sortie totale à TP2</SelectItem>
                  <SelectItem value="partial">Sortie partielle (50% TP1, 30% TP2, 20% TP3)</SelectItem>
                  <SelectItem value="conservative">Conservative (75% TP1, 25% TP2)</SelectItem>
                  <SelectItem value="aggressive">Aggressive (25% TP1, 50% TP2, 25% TP3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button 
          onClick={saveSettings} 
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? "Sauvegarde..." : "💾 Sauvegarder les Paramètres"}
        </Button>
      </div>
    </Card>
  );
};

export default UserSettings;