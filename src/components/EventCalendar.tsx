import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CryptoEvent {
  title: string;
  description: string;
  date: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  source: string;
  coins: string[];
  impactScore?: number;
  daysUntil?: number;
}

interface EventCalendarProps {
  symbols: string[];
}

const EventCalendar = ({ symbols }: EventCalendarProps) => {
  const [events, setEvents] = useState<CryptoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadEvents();
  }, [symbols]);

  const loadEvents = async () => {
    try {
      const baseSymbols = symbols.map(s => s.replace('USDT', ''));
      
      const { data, error } = await supabase.functions.invoke('calendar-events', {
        body: { symbols: baseSymbols }
      });

      if (error) throw error;

      setEvents(data?.events || []);
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        title: "⚠️ Erreur",
        description: "Impossible de charger le calendrier",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'listing': return '🚀';
      case 'upgrade': return '⚡';
      case 'fork': return '🔱';
      case 'airdrop': return '🎁';
      case 'partnership': return '🤝';
      case 'conference': return '🎤';
      default: return '📅';
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-20 bg-muted rounded"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold">Calendrier des Événements</h3>
        {events.length > 0 && (
          <Badge variant="outline">{events.length}</Badge>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun événement majeur à venir</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 5).map((event, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border bg-card hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getCategoryIcon(event.category)}</span>
                    <h4 className="font-semibold">{event.title}</h4>
                    <Badge variant={getImpactColor(event.impact)} className="text-xs">
                      {event.impact.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {event.description}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {event.daysUntil 
                          ? `Dans ${event.daysUntil} jour${event.daysUntil > 1 ? 's' : ''}`
                          : new Date(event.date).toLocaleDateString('fr-FR')
                        }
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {event.coins.map((coin, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {coin}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                {event.impactScore && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-bold">
                        {event.impactScore.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Impact</p>
                  </div>
                )}
              </div>

              {event.impact === 'high' && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2 text-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-xs font-medium">
                    Événement à fort impact - Ajustez votre stratégie en conséquence
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default EventCalendar;