import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const postmarkToken = Deno.env.get("POSTMARK_SERVER_TOKEN");
    const fromEmail = Deno.env.get("POSTMARK_FROM_EMAIL");
    const toEmail = Deno.env.get("PERS_SYS_ALERT_TO_EMAIL");
    const messageStream = Deno.env.get("POSTMARK_MESSAGE_STREAM") ?? "outbound";

    if (!postmarkToken || !fromEmail || !toEmail) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_required_secrets",
          has_POSTMARK_SERVER_TOKEN: Boolean(postmarkToken),
          has_POSTMARK_FROM_EMAIL: Boolean(fromEmail),
          has_PERS_SYS_ALERT_TO_EMAIL: Boolean(toEmail),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let subject = "Pers-Sys test email";
    let htmlBody =
      "Pers-Sys test email\nIf you received this, Supabase Edge Function → Postmark is working.";
    let textBody =
      "Pers-Sys test email\n\nIf you received this, Supabase Edge Function -> Postmark is working.";

    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (typeof body.subject === "string" && body.subject.trim()) {
          subject = body.subject.trim();
        }
        if (typeof body.htmlBody === "string" && body.htmlBody.trim()) {
          htmlBody = body.htmlBody;
        }
        if (typeof body.textBody === "string" && body.textBody.trim()) {
          textBody = body.textBody;
        }
      }
    } catch {
      // Allow empty or non-JSON POST bodies and fall back to defaults.
    }

    const postmarkPayload = {
      From: fromEmail,
      To: toEmail,
      Subject: subject,
      HtmlBody: htmlBody,
      TextBody: textBody,
      MessageStream: messageStream,
    };

    const postmarkRes = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": postmarkToken,
      },
      body: JSON.stringify(postmarkPayload),
    });

    const rawText = await postmarkRes.text();
    let parsed: unknown = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    return new Response(
      JSON.stringify({
        ok: postmarkRes.ok,
        postmark_status: postmarkRes.status,
        from: fromEmail,
        to: toEmail,
        message_stream: messageStream,
        postmark_response: parsed,
      }),
      {
        status: postmarkRes.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "unexpected_error",
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
