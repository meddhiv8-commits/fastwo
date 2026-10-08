const crypto = require("crypto");
const { generateReply } = require("./assistantService.js");

function whatsappConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    version: process.env.WHATSAPP_API_VERSION || "v19.0",
  };
}

function verifySignature(rawBody, signature, appSecret) {
  if (!rawBody || !signature || !appSecret || !signature.startsWith("sha256="))
    return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const received = Buffer.from(signature.slice(7));
  const calculated = Buffer.from(expected);
  return (
    received.length === calculated.length &&
    crypto.timingSafeEqual(received, calculated)
  );
}

async function sendWhatsAppText(to, text) {
  const config = whatsappConfig();
  if (!config.token || !config.phoneId)
    throw new Error("WhatsApp Cloud API is not configured");
  const response = await fetch(
    `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "WhatsApp message failed");
  return data.messages?.[0]?.id || null;
}

async function sendWhatsAppNegotiationNotification({
  to,
  productLabel,
  offerAmount,
  sellerLink,
  productUrl,
}) {
  const config = whatsappConfig();
  const templateName = process.env.WHATSAPP_NEGOTIATION_TEMPLATE;
  const languageCode = process.env.WHATSAPP_NEGOTIATION_LANGUAGE || "fr";
  if (!config.token || !config.phoneId || !templateName)
    throw new Error("WhatsApp negotiation template is not configured");
  const response = await fetch(
    `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: productLabel },
                { type: "text", text: `${offerAmount} TND` },
                {
                  type: "text",
                  text: `${productUrl}\nRépondre à l’offre : ${sellerLink}`,
                },
              ],
            },
          ],
        },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "WhatsApp template message failed");
  return data.messages?.[0]?.id || null;
}

async function sendWhatsAppNegotiationResponseNotification({
  to,
  productLabel,
  offerAmount,
  decision,
  productUrl,
}) {
  const templateName = process.env.WHATSAPP_NEGOTIATION_RESPONSE_TEMPLATE;
  if (!templateName) {
    return sendWhatsAppText(
      to,
      `Votre offre de ${offerAmount} TND pour ${productLabel} a été ${decision}. Article : ${productUrl}`,
    );
  }
  const config = whatsappConfig();
  if (!config.token || !config.phoneId)
    throw new Error("WhatsApp Cloud API is not configured");
  const response = await fetch(
    `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: process.env.WHATSAPP_NEGOTIATION_LANGUAGE || "fr",
          },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: productLabel },
                { type: "text", text: `${offerAmount} TND` },
                { type: "text", text: decision },
                { type: "text", text: productUrl },
              ],
            },
          ],
        },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message || "WhatsApp response template failed");
  return data.messages?.[0]?.id || null;
}

async function getOrCreateConversation(supabase, whatsappId, profile = {}) {
  const { data: existing, error: readError } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("whatsapp_id", whatsappId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing;
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .insert({ whatsapp_id: whatsappId, profile })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function storeMessage(supabase, conversationId, message) {
  if (message.whatsappMessageId) {
    const { data: existing } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("whatsapp_message_id", message.whatsappMessageId)
      .maybeSingle();
    if (existing) return false;
  }
  const { error } = await supabase.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    whatsapp_message_id: message.whatsappMessageId || null,
    direction: message.direction,
    sender_type: message.senderType,
    body: message.body,
    payload: message.payload || {},
  });
  if (error) throw error;
  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  return true;
}

async function processIncomingMessage(supabase, { from, message, profile }) {
  if (!message?.text?.body) return;
  const conversation = await getOrCreateConversation(supabase, from, profile);
  const isNew = await storeMessage(supabase, conversation.id, {
    whatsappMessageId: message.id,
    direction: "inbound",
    senderType: "customer",
    body: message.text.body,
    payload: message,
  });
  if (
    !isNew ||
    conversation.control_mode === "human" ||
    conversation.status === "waiting_for_admin"
  )
    return;
  try {
    const result = await generateReply({
      conversation,
      inboundText: message.text.body,
      supabase,
    });
    const outboundId = await sendWhatsAppText(from, result.text);
    await storeMessage(supabase, conversation.id, {
      whatsappMessageId: outboundId,
      direction: "outbound",
      senderType: result.handedOff ? "system" : "assistant",
      body: result.text,
      payload: { provider: "whatsapp_cloud" },
    });
    if (!result.handedOff)
      await supabase
        .from("whatsapp_conversations")
        .update({
          status: "waiting_for_customer",
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
  } catch (error) {
    console.error("assistant processing error:", error);
    await supabase
      .from("whatsapp_conversations")
      .update({
        status: "waiting_for_admin",
        control_mode: "human",
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
    const fallback =
      "Je rencontre un problème technique. Un conseiller va reprendre votre demande ici.";
    try {
      const outboundId = await sendWhatsAppText(from, fallback);
      await storeMessage(supabase, conversation.id, {
        whatsappMessageId: outboundId,
        direction: "outbound",
        senderType: "system",
        body: fallback,
        payload: { error: "assistant_handoff" },
      });
    } catch (sendError) {
      console.error("handoff notification error:", sendError);
    }
  }
}

async function processWebhookPayload(supabase, payload) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        const contact = (value.contacts || []).find(
          (item) => item.wa_id === message.from,
        );
        await processIncomingMessage(supabase, {
          from: message.from,
          message,
          profile: { name: contact?.profile?.name || "", phone: message.from },
        });
      }
    }
  }
}

module.exports = {
  verifySignature,
  processWebhookPayload,
  sendWhatsAppText,
  sendWhatsAppNegotiationNotification,
  sendWhatsAppNegotiationResponseNotification,
  storeMessage,
  getOrCreateConversation,
};
