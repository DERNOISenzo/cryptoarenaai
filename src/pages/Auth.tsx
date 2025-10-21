import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const calculatePasswordStrength = (pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (pwd.length >= 12) strength += 15;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 20;
    if (/\d/.test(pwd)) strength += 20;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength += 20;
    return Math.min(strength, 100);
  };

  const generateSecurePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(password);
  };

  const passwordStrength = calculatePasswordStrength(password);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "❌ Erreur",
        description: "Le pseudo est requis",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            username: username.trim()
          });

        if (profileError) throw profileError;

        toast({
          title: "✅ Compte créé !",
          description: "Connexion en cours...",
          duration: 3000
        });

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "✅ Connecté !",
        description: "Bienvenue sur le bot de trading",
        duration: 3000
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: "❌ Erreur",
        description: error.message,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Bot de Trading Crypto</h1>
          <p className="text-muted-foreground">Connectez-vous pour gérer vos alertes</p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Pseudo"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe (min. 8 caractères)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                      className="h-8 w-8 p-0"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={generateSecurePassword}
                      className="h-8 w-8 p-0"
                      title="Générer un mot de passe"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {password && (
                  <div className="space-y-1">
                    <Progress value={passwordStrength} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Sécurité: {passwordStrength < 40 ? "Faible" : passwordStrength < 70 ? "Moyenne" : "Fort"}
                    </p>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Création..." : "Créer un compte"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
