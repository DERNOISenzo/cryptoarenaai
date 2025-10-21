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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("*")
      .eq("is_active", true);

    if (alertsError) throw alertsError;

    const triggeredAlerts = [];

    // Check each alert
    for (const alert of alerts || []) {
      try {
        // Fetch current price from Binance
        const response = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${alert.symbol}`
        );
        const data = await response.json();
        const currentPrice = parseFloat(data.price);

        let shouldTrigger = false;

        if (alert.condition === "au-dessus" && currentPrice >= alert.price) {
          shouldTrigger = true;
        } else if (alert.condition === "en-dessous" && currentPrice <= alert.price) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          // Update alert
          await supabase
            .from("alerts")
            .update({
              is_active: false,
              triggered_at: new Date().toISOString(),
            })
            .eq("id", alert.id);

          triggeredAlerts.push({
            ...alert,
            currentPrice,
          });

          console.log(`Alert triggered for ${alert.symbol}: ${alert.condition} $${alert.price} (current: $${currentPrice})`);
        }
      } catch (error) {
        console.error(`Error checking alert ${alert.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        checked: alerts?.length || 0,
        triggered: triggeredAlerts.length,
        alerts: triggeredAlerts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-alerts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
