const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PRICES = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID
};

async function createCheckoutSession(plan, chatId, successUrl, cancelUrl) {
  var priceId = PRICES[plan];
  if (!priceId) throw new Error('Invalid plan: ' + plan);
  var session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}&chat_id=' + (chatId || ''),
    cancel_url: cancelUrl,
    metadata: { plan: plan, chatId: chatId || '' }
  });
  return session;
}

async function verifySession(sessionId) {
  try {
    var s = await stripe.checkout.sessions.retrieve(sessionId);
    if (s.payment_status === 'paid') {
      return { success: true, data: { plan: s.metadata.plan, chatId: s.metadata.chatId, email: s.customer_details ? s.customer_details.email : '' } };
    }
    return { success: false, reason: 'Payment not completed' };
  } catch(err) {
    return { success: false, reason: err.message };
  }
}

// ── STRIPE WEBHOOK VERIFICATION ──────────────────────────────────────────
// Without this, anyone on the internet can POST a fake "payment succeeded"
// event and get a free Pro account. Stripe signs every webhook with a secret.
// You MUST set STRIPE_WEBHOOK_SECRET in .env (get it from Stripe Dashboard
// → Developers → Webhooks → your endpoint → Signing secret)
async function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Payments] STRIPE_WEBHOOK_SECRET not set — webhook verification DISABLED');
    return { valid: false, error: 'Webhook secret not configured' };
  }
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { valid: true, event };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = { createCheckoutSession, verifySession, verifyWebhookSignature };
