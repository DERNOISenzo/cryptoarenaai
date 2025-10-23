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
    const { alertId, currentPrice } = await req.json();

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get alert details
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*, profiles!inner(telegram_chat_id, username)')
      .eq('id', alertId)
      .single();

    if (alertError || !alert) {
      console.error('Alert not found:', alertError);
      return new Response(JSON.stringify({ error: 'Alert not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chatId = alert.profiles.telegram_chat_id;
    if (!chatId) {
      console.log('User has no Telegram chat ID configured');
      return new Response(JSON.stringify({ success: false, reason: 'no_telegram' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current analysis for this symbol
    const analysisResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ symbol: alert.symbol })
    });

    let signal = "NEUTRAL";
    let confidence = 0;
    if (analysisResponse.ok) {
      const analysisData = await analysisResponse.json();
      signal = analysisData.analysis.signal;
      confidence = analysisData.analysis.confidence;
    }

    // Build Telegram message
    const conditionText = alert.condition === 'above' ? 'au-dessus' : 'en-dessous';
    const emoji = alert.condition === 'above' ? '📈' : '📉';
    const signalEmoji = signal === 'LONG' ? '🟢' : signal === 'SHORT' ? '🔴' : '⚪';
    
    let message = `🚨 *ALERTE DÉCLENCHÉE* 🚨\n\n`;
    message += `${emoji} *${alert.crypto_name}* (${alert.symbol})\n`;
    message += `Prix actuel: *$${currentPrice.toFixed(currentPrice < 1 ? 6 : 2)}*\n`;
    message += `Condition: ${conditionText} de $${alert.price}\n\n`;
    message += `${signalEmoji} Signal IA: *${signal}*\n`;
    message += `🎯 Confiance: ${confidence.toFixed(1)}%\n\n`;
    message += `Gérez vos positions sur l'application.`;

    // Send Telegram message
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
      throw new Error('Failed to send Telegram message');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send telegram alert error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});