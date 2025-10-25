import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Calendar } from "lucide-react";
import Header from "@/components/Header";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [userId, setUserId] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setEmail(session.user.email || "");
      setUserId(session.user.id);
      setCreatedAt(new Date(session.user.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username, telegram_chat_id")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setUsername(profileData.username);
        setTelegramChatId(profileData.telegram_chat_id || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "❌ Erreur",
        description: "Impossible de charger le profil",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!username.trim()) {
      toast({
        title: "❌ Erreur",
        description: "Le pseudo ne peut pas être vide",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim() })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "✅ Profil mis à jour",
        description: "Votre pseudo a été modifié avec succès",
        duration: 3000
      });
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const handleConnectTelegram = () => {
    const botUsername = "CryptoArenaIAbot";
    const telegramUrl = `https://t.me/${botUsername}?start=${userId}`;
    window.open(telegramUrl, '_blank');
    
    toast({
      title: "🤖 Connexion Telegram",
      description: "Envoyez /start au bot pour lier votre compte",
      duration: 5000
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header userId={userId} />
      <div className="p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>

          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <User className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Mon Profil</h1>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Pseudo
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Votre pseudo"
                    />
                    <Button onClick={handleUpdateUsername}>
                      Modifier
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    L'email ne peut pas être modifié
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Membre depuis
                  </Label>
                  <Input
                    value={createdAt}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <h2 className="text-2xl font-bold">Notifications Telegram</h2>
              </div>
              
              <p className="text-muted-foreground">
                Recevez vos alertes de prix directement sur Telegram en temps réel
              </p>

              {telegramChatId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-4 bg-success/10 rounded-lg border border-success/20">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-semibold text-success">Telegram connecté</p>
                      <p className="text-sm text-muted-foreground">
                        Vous recevrez les notifications sur Telegram
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleConnectTelegram}
                    variant="outline"
                    className="w-full"
                  >
                    Reconnecter Telegram
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                    <p className="text-sm text-muted-foreground">
                      Pour activer les notifications Telegram :
                    </p>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Cliquez sur "Connecter Telegram"</li>
                      <li>Envoyez /start au bot</li>
                      <li>Vos alertes seront automatiquement envoyées</li>
                    </ol>
                  </div>
                  <Button 
                    onClick={handleConnectTelegram}
                    className="w-full gap-2"
                  >
                    <span className="text-lg">📱</span>
                    Connecter Telegram
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
