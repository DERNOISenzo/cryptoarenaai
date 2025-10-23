import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Trash2, Plus, TrendingUp, TrendingDown, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Alert {
  id: string;
  symbol: string;
  crypto_name: string;
  condition: 'above' | 'below';
  price: number;
  is_active: boolean;
  created_at: string;
}

interface AlertsManagerProps {
  symbol: string;
  cryptoName: string;
  currentPrice: number;
}

const AlertsManager = ({ symbol, cryptoName, currentPrice }: AlertsManagerProps) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [newAlert, setNewAlert] = useState({
    condition: 'above' as 'above' | 'below',
    price: currentPrice.toString()
  });
  const { toast } = useToast();

  useEffect(() => {
    loadAlerts();
    loadTelegramStatus();

    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.triggered_at && !payload.old.triggered_at) {
            toast({
              title: "🚨 Alerte déclenchée !",
              description: `${payload.new.crypto_name}: Prix ${payload.new.condition === 'above' ? 'au-dessus' : 'en-dessous'} de $${payload.new.price}`,
              duration: 5000
            });
          }
          loadAlerts();
        }
      )
      .subscribe();

    const checkInterval = setInterval(async () => {
      await supabase.functions.invoke('check-alerts');
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(checkInterval);
    };
  }, [symbol]);

  const loadTelegramStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (data?.telegram_chat_id) {
        setTelegramChatId(data.telegram_chat_id);
      }
    } catch (error) {
      console.error('Error loading Telegram status:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('symbol', symbol)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts((data || []) as Alert[]);
    } catch (error) {
      console.error('Load alerts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "⚠️ Authentification requise",
          description: "Connectez-vous pour créer des alertes",
          variant: "destructive"
        });
        return;
      }

      const price = parseFloat(newAlert.price);
      if (isNaN(price) || price <= 0) {
        toast({
          title: "❌ Prix invalide",
          description: "Veuillez entrer un prix valide",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('alerts')
        .insert({
          user_id: user.id,
          symbol,
          crypto_name: cryptoName,
          condition: newAlert.condition,
          price
        });

      if (error) throw error;

      toast({
        title: "✅ Alerte créée",
        description: `Vous serez notifié quand ${symbol} passe ${newAlert.condition === 'above' ? 'au-dessus' : 'en-dessous'} de $${price}`
      });

      setDialogOpen(false);
      setNewAlert({ condition: 'above', price: currentPrice.toString() });
      loadAlerts();
    } catch (error) {
      console.error('Create alert error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de créer l'alerte",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "✅ Alerte supprimée",
      });
      loadAlerts();
    } catch (error) {
      console.error('Delete alert error:', error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de supprimer l'alerte",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Alertes Prix</h3>
          {alerts.length > 0 && (
            <Badge variant="secondary">{alerts.length}</Badge>
          )}
          {telegramChatId && (
            <Badge variant="default" className="gap-1">
              <MessageCircle className="w-3 h-3" />
              Telegram actif
            </Badge>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Nouvelle Alerte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une alerte pour {symbol}</DialogTitle>
              <DialogDescription>
                Vous serez notifié quand le prix atteint votre objectif
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={newAlert.condition}
                  onValueChange={(value: 'above' | 'below') => 
                    setNewAlert({ ...newAlert, condition: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-success" />
                        Au-dessus de
                      </div>
                    </SelectItem>
                    <SelectItem value="below">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-danger" />
                        En-dessous de
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prix cible ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAlert.price}
                  onChange={(e) => setNewAlert({ ...newAlert, price: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Prix actuel: ${currentPrice.toFixed(currentPrice < 1 ? 6 : 2)}
                </p>
              </div>
            </div>

            <Button onClick={createAlert} className="w-full">
              Créer l'alerte
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucune alerte active</p>
          <p className="text-sm mt-1">Créez votre première alerte pour être notifié</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {alert.condition === 'above' ? (
                  <TrendingUp className="w-5 h-5 text-success" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-danger" />
                )}
                <div>
                  <p className="font-medium">
                    {alert.condition === 'above' ? 'Au-dessus' : 'En-dessous'} de ${alert.price}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Créée le {new Date(alert.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteAlert(alert.id)}
              >
                <Trash2 className="w-4 h-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default AlertsManager;
