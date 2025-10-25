import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const update = await req.json();
    console.log('Telegram update:', update);

    // Basic validation
    if (!update.message || !update.message.chat || !update.message.text) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // Command /start <userId> - Link Telegram account
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const userId = parts[1]; // User ID passed from the app
      // Check if already linked
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (existingProfile) {
        await sendTelegramMessage(chatId, `✅ Votre compte est déjà lié!\n\nUtilisez /alert pour voir vos alertes actives.`, TELEGRAM_BOT_TOKEN);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      // If userId provided, link the account
      if (userId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ telegram_chat_id: chatId.toString() })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error linking Telegram:', updateError);
          await sendTelegramMessage(chatId, `❌ Erreur lors de la liaison du compte. Veuillez réessayer depuis votre profil.`, TELEGRAM_BOT_TOKEN);
        } else {
          await sendTelegramMessage(chatId, `✅ Compte lié avec succès!\n\nVous recevrez désormais vos alertes de prix ici.\n\nCommandes disponibles:\n/alert - Voir vos alertes actives\n/help - Aide`, TELEGRAM_BOT_TOKEN);
        }
      } else {
        await sendTelegramMessage(chatId, `👋 Bienvenue sur CryptoArena IA!\n\nPour lier votre compte:\n1. Connectez-vous sur l'application\n2. Allez dans votre profil\n3. Cliquez sur "Connecter Telegram"\n\nEnsuite, vous recevrez vos alertes ici!`, TELEGRAM_BOT_TOKEN);
      }
    }

    // Command /alert - List alerts
    else if (text === '/alert' || text === '/alerts') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('telegram_chat_id', chatId.toString())
        .single();

      if (!profile) {
        await sendTelegramMessage(chatId, `⚠️ Votre compte n'est pas lié.\n\nUtilisez /start pour commencer.`, TELEGRAM_BOT_TOKEN);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }

      const { data: alerts } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('is_active', true);

      if (!alerts || alerts.length === 0) {
        await sendTelegramMessage(chatId, `📭 Vous n'avez aucune alerte active.\n\nCréez-en sur https://cryptoarena.lovable.app`, TELEGRAM_BOT_TOKEN);
      } else {
        let message = `🔔 *Vos alertes actives:*\n\n`;
        alerts.forEach((alert: any, idx: number) => {
          message += `${idx + 1}. ${alert.crypto_name} (${alert.symbol})\n`;
          message += `   ${alert.condition === 'above' ? '📈 Au-dessus' : '📉 En-dessous'} de $${alert.price}\n\n`;
        });
        message += `Gérez vos alertes sur l'app.`;
        
        await sendTelegramMessage(chatId, message, TELEGRAM_BOT_TOKEN);
      }
    }

    // Command /help
    else if (text === '/help') {
      await sendTelegramMessage(chatId, `📚 *Commandes disponibles:*\n\n/start - Lier votre compte\n/alert - Voir vos alertes actives\n/help - Afficher cette aide\n\nVous recevrez automatiquement des notifications quand vos alertes se déclenchent!`, TELEGRAM_BOT_TOKEN);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

  } catch (error) {
    console.error('Telegram webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTelegramMessage(chatId: number, text: string, token: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });

  if (!response.ok) {
    console.error('Telegram API error:', await response.text());
  }
  
  return response;
}