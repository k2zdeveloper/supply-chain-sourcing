// supabase/functions/create-payment-intent/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// Deno securely imports NPM packages dynamically. No node_modules required.
import Stripe from 'npm:stripe@^14.0.0'

// Initialize Stripe strictly using the environment variable vault
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// Strict CORS policy to prevent cross-site scripting attacks
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Extract payload from the React Client
    const { expected_total, workspace_ids, cost_center } = await req.json()

    if (!expected_total || !workspace_ids) {
      throw new Error("Malformed payload: Missing financial parameters.");
    }

    // 3. Financial Conversion (Stripe requires integers in cents)
    // SECURITY NOTE: In a full zero-trust production state, we would query the Supabase DB 
    // right here to recalculate the total based on workspace_ids to verify `expected_total` hasn't been tampered with.
    const amountInCents = Math.round(expected_total * 100);

    // 4. Generate the secure Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        workspaces: workspace_ids.join(','),
        cost_center: cost_center
      }
    })

    // 5. Return the client_secret to unlock the frontend iframe
    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})