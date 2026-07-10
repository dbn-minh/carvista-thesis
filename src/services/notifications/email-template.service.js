import { env } from "../../config/env.js";

export function buildViewingRequestSellerEmail({
  sellerName,
  listingTitle,
  listingId,
  buyerName,
  buyerEmail,
  buyerPhone,
  preferredViewingTime,
  message,
}) {
  const listingUrl = `${env.frontendUrl}/listings/${listingId}`;
  const requestsUrl = `${env.frontendUrl}/requests`;

  const subject = "New viewing request for your vehicle listing";
  const infoRows = [
    ["Listing", listingTitle || `Listing #${listingId}`],
    ["Reference", `#${listingId}`],
    ["Buyer", buyerName || "Not provided"],
    ["Buyer email", buyerEmail || "Not provided"],
    ["Buyer phone", buyerPhone || "Not provided"],
    [
      "Preferred time",
      preferredViewingTime ? formatDateTime(preferredViewingTime) : "Not specified",
    ],
  ];

  const text = [
    `Hi ${sellerName || "seller"},`,
    "",
    "You have a new viewing request for your vehicle listing.",
    "",
    ...infoRows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Buyer note: ${message || "No message provided."}`,
    "",
    `Open listing: ${listingUrl}`,
    `Manage viewing requests: ${requestsUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14315c">
      <p>Hi ${escapeHtml(sellerName || "seller")},</p>
      <p>You have a new viewing request for your vehicle listing.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:16px 0">
        ${infoRows
          .map(
            ([label, value]) => `
          <tr>
            <td style="font-weight:700;border-bottom:1px solid #e5edf8;width:180px">${escapeHtml(
              label
            )}</td>
            <td style="border-bottom:1px solid #e5edf8">${escapeHtml(value)}</td>
          </tr>
        `
          )
          .join("")}
      </table>
      <p><strong>Buyer note</strong><br />${escapeHtml(
        message || "No message provided."
      )}</p>
      <p>
        <a href="${listingUrl}" style="display:inline-block;background:#14315c;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;margin-right:8px">Open listing</a>
        <a href="${requestsUrl}" style="display:inline-block;background:#2f6fdf;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Manage viewing requests</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export function buildViewingRequestBuyerEmail({
  buyerName,
  listingTitle,
  listingId,
  sellerName,
  preferredViewingTime,
  message,
}) {
  const listingUrl = `${env.frontendUrl}/listings/${listingId}`;
  const requestsUrl = `${env.frontendUrl}/requests`;

  const subject = "Your viewing request was sent";
  const infoRows = [
    ["Listing", listingTitle || `Listing #${listingId}`],
    ["Reference", `#${listingId}`],
    ["Seller", sellerName || "Seller"],
    [
      "Preferred time",
      preferredViewingTime ? formatDateTime(preferredViewingTime) : "Not specified",
    ],
  ];

  const text = [
    `Hi ${buyerName || "there"},`,
    "",
    "Thanks for using CarVista. Your viewing request was sent successfully.",
    "",
    ...infoRows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Your note: ${message || "No message provided."}`,
    "",
    "The seller has been notified and can follow up from their CarVista dashboard.",
    `Open listing: ${listingUrl}`,
    `Manage your requests: ${requestsUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14315c">
      <p>Hi ${escapeHtml(buyerName || "there")},</p>
      <p>Thanks for using CarVista. Your viewing request was sent successfully.</p>
      <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:16px 0">
        ${infoRows
          .map(
            ([label, value]) => `
          <tr>
            <td style="font-weight:700;border-bottom:1px solid #e5edf8;width:180px">${escapeHtml(
              label
            )}</td>
            <td style="border-bottom:1px solid #e5edf8">${escapeHtml(value)}</td>
          </tr>
        `
          )
          .join("")}
      </table>
      <p><strong>Your note</strong><br />${escapeHtml(
        message || "No message provided."
      )}</p>
      <p>The seller has been notified and can follow up from their CarVista dashboard.</p>
      <p>
        <a href="${listingUrl}" style="display:inline-block;background:#14315c;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;margin-right:8px">Open listing</a>
        <a href="${requestsUrl}" style="display:inline-block;background:#2f6fdf;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Manage requests</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export function buildWelcomeEmailTemplate({ userName }) {
  const appUrl = trimTrailingSlash(env.frontendUrl || env.appPublicUrl);
  const listingsUrl = buildAppUrl("/listings");
  const compareUrl = buildAppUrl("/compare");
  const profileUrl = buildAppUrl("/profile");
  const displayName = String(userName || "").trim() || "there";
  const firstName = displayName.split(/\s+/)[0] || "there";
  const currentYear = new Date().getFullYear();
  const subject = "Welcome to CarVista";
  const preheader =
    "Your CarVista account is ready. Start exploring vehicles, comparisons, and ownership insights.";
  const highlightRows = [
    ["Browse vehicles", "Search listings and shortlist cars that fit your needs."],
    ["Compare confidently", "Use comparisons to weigh trims, body styles, and fuel types."],
    ["Manage your profile", "Keep your contact details ready for viewing requests."],
  ];

  const text = [
    `Hi ${displayName},`,
    "",
    "Welcome to CarVista. Your account has been created successfully.",
    "You can now save vehicles, compare options, request viewings, and manage your car-shopping activity from one place.",
    "",
    "Good places to start:",
    ...highlightRows.map(([label, description]) => `- ${label}: ${description}`),
    "",
    `Open CarVista: ${appUrl}`,
    `Browse listings: ${listingsUrl}`,
    `Compare vehicles: ${compareUrl}`,
    `Manage profile: ${profileUrl}`,
    "",
    `Copyright ${currentYear} CarVista.`,
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
        <style>
          @media only screen and (max-width: 620px) {
            .cv-container { width: 100% !important; }
            .cv-content { padding: 28px 22px !important; }
            .cv-actions td { display: block !important; width: 100% !important; padding: 0 0 10px !important; }
            .cv-card { border-radius: 22px !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f1f5fc;color:#1a2b4c;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">
          ${escapeHtml(preheader)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f1f5fc;">
          <tr>
            <td align="center" style="padding:34px 14px;">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" class="cv-container" style="width:640px;max-width:640px;border-collapse:separate;border-spacing:0;">
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="cv-card" style="width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe6f5;border-radius:28px;overflow:hidden;box-shadow:0 18px 45px rgba(26,43,76,0.12);">
                      <tr>
                        <td style="padding:30px 36px;background:#1a2b4c;background-image:linear-gradient(135deg,#1a2b4c 0%,#304f8f 62%,#6f91dd 100%);">
                          <div style="font-size:25px;line-height:1.2;font-weight:700;color:#ffffff;letter-spacing:0;">
                            CarVista
                          </div>
                          <div style="margin-top:16px;font-size:13px;line-height:1.4;font-weight:700;color:#dce8ff;text-transform:uppercase;letter-spacing:2px;">
                            Account ready
                          </div>
                          <h1 style="margin:8px 0 0;color:#ffffff;font-size:30px;line-height:1.25;font-weight:700;">
                            Welcome, ${escapeHtml(firstName)}
                          </h1>
                          <p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#e9f1ff;">
                            Your account is ready for vehicle search, comparisons, viewing requests, and ownership planning.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td class="cv-content" style="padding:36px 42px 34px;">
                          <p style="margin:0;color:#50627f;font-size:16px;line-height:1.7;">
                            Thanks for joining CarVista. You can now save vehicles, compare models, and keep your car-shopping activity organized as you narrow down the right fit.
                          </p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:28px 0;">
                            ${highlightRows
                              .map(
                                ([label, description]) => `
                            <tr>
                              <td style="padding:16px 0;border-bottom:1px solid #e5edf8;">
                                <div style="font-size:15px;line-height:1.4;font-weight:700;color:#1a2b4c;">${escapeHtml(
                                  label
                                )}</div>
                                <div style="margin-top:4px;font-size:14px;line-height:1.6;color:#64748b;">${escapeHtml(
                                  description
                                )}</div>
                              </td>
                            </tr>
                          `
                              )
                              .join("")}
                          </table>
                          <table role="presentation" cellpadding="0" cellspacing="0" class="cv-actions" style="border-collapse:collapse;margin:0 0 22px;">
                            <tr>
                              <td style="padding-right:10px;">
                                <a href="${escapeHtml(listingsUrl)}" style="display:inline-block;background:#2f6fdf;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Browse vehicles</a>
                              </td>
                              <td>
                                <a href="${escapeHtml(compareUrl)}" style="display:inline-block;background:#eef5ff;color:#304f8f;padding:12px 18px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:700;">Compare cars</a>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.65;">
                            If you did not create this account, you can ignore this email.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:24px 42px 32px;background:#f8fbff;border-top:1px solid #e5edf8;color:#8a98ad;font-size:12px;line-height:1.6;">
                          <a href="${escapeHtml(appUrl)}" style="color:#304f8f;text-decoration:none;font-weight:700;">Open CarVista</a>
                          <span style="color:#a7b3c6;">&nbsp;|&nbsp;</span>
                          <a href="${escapeHtml(profileUrl)}" style="color:#304f8f;text-decoration:none;font-weight:700;">Manage profile</a>
                          <br />
                          &copy; ${currentYear} CarVista. This is an automated welcome email for your account.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}

export function buildOtpEmailTemplate({ code, expiresInMinutes, purpose }) {
  const subject = getOtpEmailSubject(purpose);
  const title = getOtpEmailTitle(purpose);
  const intro = getOtpEmailIntro(purpose);
  const plainCode = String(code);
  const displayCode = formatOtpCode(code);
  const expiryLabel = formatMinuteLabel(expiresInMinutes);
  const appUrl = getPublicAppUrl();
  const supportEmail = getSupportEmail();
  const currentYear = new Date().getFullYear();
  const preheader = `${plainCode} is your CarVista verification code. It expires in ${expiryLabel}.`;
  const footerText = [
    `CarVista account security email. Copyright ${currentYear} CarVista.`,
    supportEmail ? `Support: ${supportEmail}` : "",
    appUrl ? `CarVista: ${appUrl}` : "",
  ].filter(Boolean);

  const text = [
    title,
    "",
    intro,
    "",
    `Verification code: ${plainCode}`,
    `Expires in: ${expiryLabel}`,
    "",
    "Security note: Do not share this code with anyone. CarVista will never ask for your OTP.",
    "If you did not request this code, you can safely ignore this email.",
    "",
    ...footerText,
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(subject)}</title>
        <style>
          @media only screen and (max-width: 620px) {
            .cv-container { width: 100% !important; }
            .cv-card { border-radius: 22px !important; }
            .cv-content { padding: 28px 22px !important; }
            .cv-code { font-size: 30px !important; letter-spacing: 8px !important; }
            .cv-footer { padding: 20px 22px 28px !important; }
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:#f1f5fc;color:#1a2b4c;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">
          ${escapeHtml(preheader)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f1f5fc;">
          <tr>
            <td align="center" style="padding:34px 14px;">
              <table role="presentation" width="640" cellpadding="0" cellspacing="0" class="cv-container" style="width:640px;max-width:640px;border-collapse:separate;border-spacing:0;">
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="cv-card" style="width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe6f5;border-radius:28px;overflow:hidden;box-shadow:0 18px 45px rgba(26,43,76,0.12);">
                      <tr>
                        <td style="padding:26px 34px;background:#1a2b4c;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="font-size:25px;line-height:1.2;font-weight:700;color:#ffffff;letter-spacing:0;">
                                CarVista
                              </td>
                              <td align="right" style="font-size:12px;line-height:1.4;font-weight:700;color:#dce8ff;text-transform:uppercase;letter-spacing:2px;">
                                Secure OTP
                              </td>
                            </tr>
                          </table>
                          <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#dce8ff;">
                            Use this code only for your CarVista account request.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td class="cv-content" style="padding:36px 42px 34px;">
                          <p style="margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;">
                            Account verification
                          </p>
                          <h1 style="margin:0;color:#1a2b4c;font-size:28px;line-height:1.25;font-weight:700;">
                            ${escapeHtml(title)}
                          </h1>
                          <p style="margin:16px 0 0;color:#50627f;font-size:16px;line-height:1.65;">
                            ${escapeHtml(intro)}
                          </p>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:28px 0;">
                            <tr>
                              <td align="center" style="padding:24px 16px;background:#eef5ff;border:1px solid #d5e3f8;border-radius:22px;">
                                <div style="font-size:12px;line-height:1.4;font-weight:700;color:#304f8f;text-transform:uppercase;letter-spacing:2px;">
                                  Your one-time code
                                </div>
                                <div class="cv-code" style="margin-top:12px;font-size:38px;line-height:1.15;font-weight:700;letter-spacing:11px;color:#1a2b4c;font-family:'Courier New',Courier,monospace;">
                                  ${escapeHtml(displayCode)}
                                </div>
                                <div style="margin-top:12px;font-size:14px;line-height:1.5;color:#50627f;">
                                  Expires in ${escapeHtml(expiryLabel)}
                                </div>
                              </td>
                            </tr>
                          </table>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
                            <tr>
                              <td style="padding:16px 18px;border-radius:18px;background:#fff8e6;border:1px solid #f3d58b;color:#75531a;font-size:14px;line-height:1.6;">
                                <strong>Security note:</strong> Do not share this code with anyone. CarVista will never ask for your OTP.
                              </td>
                            </tr>
                          </table>
                          <p style="margin:0;color:#50627f;font-size:14px;line-height:1.65;">
                            If you did not request this code, you can safely ignore this email. The code only works for a short time and does not change your account by itself.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td class="cv-footer" style="padding:24px 42px 34px;background:#f8fbff;border-top:1px solid #e5edf8;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="font-size:13px;line-height:1.7;color:#64748b;">
                                This email was sent for a CarVista account request.
                                ${
                                  supportEmail
                                    ? `<br />Support: <span style="color:#304f8f;font-weight:700;">${escapeHtml(
                                        supportEmail
                                      )}</span>`
                                    : ""
                                }
                                ${
                                  appUrl
                                    ? `<br />CarVista: <span style="color:#304f8f;font-weight:700;">${escapeHtml(
                                        appUrl
                                      )}</span>`
                                    : ""
                                }
                              </td>
                            </tr>
                            <tr>
                              <td style="padding-top:10px;font-size:12px;line-height:1.6;color:#8a98ad;">
                                &copy; ${currentYear} CarVista. This is an automated security email for your account.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, text, html };
}

function getOtpEmailSubject(purpose) {
  if (purpose === "register") return "Verify your CarVista account";
  if (purpose === "reset_password") return "Reset your CarVista password";
  if (purpose === "passwordless_signin" || purpose === "login") {
    return "Your CarVista sign-in code";
  }
  if (purpose === "verify_contact") return "Confirm your CarVista contact";
  return "Your CarVista verification code";
}

function getOtpEmailTitle(purpose) {
  if (purpose === "register") return "Verify your CarVista account";
  if (purpose === "reset_password") return "Reset your password";
  if (purpose === "passwordless_signin" || purpose === "login") {
    return "Sign in to CarVista";
  }
  if (purpose === "verify_contact") return "Confirm your contact information";
  return "Your CarVista verification code";
}

function getOtpEmailIntro(purpose) {
  if (purpose === "register") {
    return "Use this one-time code to finish creating your CarVista account.";
  }
  if (purpose === "reset_password") {
    return "Use this one-time code to verify your account before setting a new password.";
  }
  if (purpose === "passwordless_signin" || purpose === "login") {
    return "Use this one-time code to sign in to your CarVista account.";
  }
  if (purpose === "verify_contact") {
    return "Use this one-time code to confirm this contact method for your CarVista account.";
  }
  return "Use this one-time code to continue with CarVista.";
}

function formatOtpCode(code) {
  return String(code).replace(/\s+/g, "").split("").join(" ");
}

function formatMinuteLabel(minutes) {
  const safeMinutes = Number(minutes) || 0;
  return `${safeMinutes} ${safeMinutes === 1 ? "minute" : "minutes"}`;
}

function buildAppUrl(path = "") {
  const baseUrl = trimTrailingSlash(env.frontendUrl || env.appPublicUrl);
  const normalizedPath = String(path || "");
  return `${baseUrl}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getPublicAppUrl() {
  return [env.frontendUrl, env.appPublicUrl].map(toPublicHttpsUrl).find(Boolean) || "";
}

function toPublicHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local");

    if (url.protocol !== "https:" || isLocalHost) return "";
    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function getSupportEmail() {
  const email = extractEmailAddress(env.notifications.email.from);
  if (!email || isLocalEmailAddress(email)) return "";
  return email;
}

function extractEmailAddress(value) {
  const normalized = String(value || "").trim();
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const candidate = bracketMatch ? bracketMatch[1] : normalized;
  const emailMatch = candidate.match(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/);
  return emailMatch ? emailMatch[0] : "";
}

function isLocalEmailAddress(email) {
  const domain = String(email).split("@").pop()?.toLowerCase() || "";
  return domain === "localhost" || domain.endsWith(".local");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
