const nodemailer = require("nodemailer");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // Read body (supports JSON + form-urlencoded)
    let body = {};
    const contentType = (req.headers["content-type"] || "").toLowerCase();

    if (contentType.includes("application/json")) {
      body = req.body || {};
    } else {
      const raw = await getRawBody(req);
      const params = new URLSearchParams(raw);
      for (const [k, v] of params.entries()) body[k] = v;
    }

    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();

    // Honeypot anti-bot
    const website = (body.website || "").trim();
    if (website) return res.status(200).json({ ok: true });

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    // 1) Push contact to Brevo
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) throw new Error("Missing BREVO_API_KEY");

    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ");

    const brevoPayload = {
      email,
      updateEnabled: true,
      attributes: {
        FIRSTNAME: firstName || name,
        LASTNAME: lastName || "",
        MESSAGE: message,
        SOURCE: "ControlLayer Website",
      },
    };

    const brevoResp = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": brevoKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(brevoPayload),
    });

    if (!brevoResp.ok && brevoResp.status !== 204) {
      const txt = await brevoResp.text();
      throw new Error(`Brevo error ${brevoResp.status}: ${txt}`);
    }

    // 2) Send emails via Zoho SMTP
    const smtpUser = process.env.ZOHO_SMTP_USER;
    const smtpPass = process.env.ZOHO_SMTP_PASS;
    const notifyTo = process.env.NOTIFY_TO || smtpUser;

    if (!smtpUser || !smtpPass) throw new Error("Missing ZOHO_SMTP_USER or ZOHO_SMTP_PASS");

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `ControlLayer <${smtpUser}>`,
      to: email,
      subject: "We received your request (ControlLayer)",
      text:
        `Hi ${firstName || name},\n\n` +
        `Thanks for reaching out. We received your message and will reply within 24 hours.\n\n` +
        `Your message:\n${message}\n\n` +
        `— ControlLayer`,
    });

    await transporter.sendMail({
      from: `ControlLayer <${smtpUser}>`,
      to: notifyTo,
      subject: "New lead from ControlLayer website",
      text: `New lead:\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
