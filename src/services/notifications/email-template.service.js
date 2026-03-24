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
  const dashboardUrl = `${env.frontendUrl}/garage`;

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
    `Seller dashboard: ${dashboardUrl}`,
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
        <a href="${dashboardUrl}" style="display:inline-block;background:#2f6fdf;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Open seller dashboard</a>
      </p>
    </div>
  `;

  return { subject, text, html };
}

export function buildOtpEmailTemplate({ code, expiresInMinutes, purpose }) {
  const subject =
    purpose === "register"
      ? "Your CarVista verification code"
      : "Your CarVista login code";

  const text = [
    "Your CarVista verification code is below.",
    "",
    `Code: ${code}`,
    `Expires in: ${expiresInMinutes} minutes`,
    "",
    "If you did not request this code, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14315c">
      <p>Your CarVista verification code is below.</p>
      <div style="display:inline-block;margin:16px 0;padding:14px 20px;border-radius:18px;background:#f2f7ff;font-size:28px;font-weight:700;letter-spacing:6px">
        ${escapeHtml(code)}
      </div>
      <p>This code expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this code, you can safely ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
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
