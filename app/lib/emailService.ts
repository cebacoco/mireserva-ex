/**
 * emailService.ts — Direct SMTP2GO email sending
 *
 * Sends booking notification emails directly via SMTP2GO REST API.
 * Includes a sync.ini code block for easy confirmation management.
 */

const SMTP2GO_API_KEY = 'api-9372466CD1864BF994B0AA3C0815C72C';

const SENDER_EMAIL = 'cebacoco@isekaisland.com';
const RECIPIENT_EMAIL = 'cebacoco@isekaisland.com';

const SMTP2GO_ENDPOINT = 'https://api.smtp2go.com/v3/email/send';

export interface BookingEmailData {
  confirmationNumber: string;
  customerName: string;
  customerEmail: string;
  customerWhatsapp: string;
  items: { name: string; price: number; quantity: number; date?: string | null }[];
  total: number;
}

// ═══════════════════════════════════════════════════════════════
// SYNC.INI CODE BLOCK GENERATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a sync.ini code block from booking data.
 * This block can be copy-pasted into sync.ini for confirmation.
 */
function generateSyncINIBlock(booking: BookingEmailData): string {
  // Determine the booking date (from items, or today)
  let bookingDate = '';
  const dateItems = booking.items.filter(i => i.date);
  if (dateItems.length > 0) {
    // Try to parse the first date found
    const rawDate = dateItems[0].date!;
    // Try ISO format first, then various formats
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      bookingDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    } else {
      bookingDate = rawDate;
    }
  }
  if (!bookingDate) {
    const now = new Date();
    bookingDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Categorize items
  const foodItems: string[] = [];
  const activityItems: string[] = [];
  const fishingItems: string[] = [];
  let beachId = '';
  let adults = 0;
  let kids = 0;
  let overnightNights = 0;
  let returnBoat = 0;
  let fishingType = '';
  let fishingAnglers = 0;
  let isFishingTrip = false;

  for (const item of booking.items) {
    const nameLower = item.name.toLowerCase();

    // Detect fishing trips
    if (nameLower.includes('offshore') || nameLower.includes('big game') || nameLower.includes('biggame') || nameLower.includes('inshore fishing')) {
      isFishingTrip = true;
      if (nameLower.includes('offshore')) fishingType = 'offshore';
      else if (nameLower.includes('big game') || nameLower.includes('biggame')) fishingType = 'biggame';
      else fishingType = 'inshore';
      fishingAnglers = item.quantity;
      continue;
    }

    // Detect additional anglers
    if (nameLower.includes('angler') || nameLower.includes('additional angler')) {
      fishingAnglers += item.quantity;
      continue;
    }

    // Detect boat/transport (adults)
    if (nameLower.includes('boat') && nameLower.includes('adult')) {
      adults = item.quantity;
      continue;
    }

    // Detect kids
    if (nameLower.includes('kid') || nameLower.includes('child')) {
      kids = item.quantity;
      continue;
    }

    // Detect overnight
    if (nameLower.includes('overnight') || nameLower.includes('night') || nameLower.includes('island stay')) {
      overnightNights = item.quantity;
      continue;
    }

    // Detect return boat
    if (nameLower.includes('return boat') || nameLower.includes('return transfer')) {
      returnBoat = item.quantity;
      continue;
    }

    // Detect beach
    if (nameLower.includes('coco loco')) beachId = 'coco_loco';
    else if (nameLower.includes('coco blanco')) beachId = 'coco_blanco';
    else if (nameLower.includes('coco escondido')) beachId = 'coco_escondido';
    else if (nameLower.includes('coco doble')) beachId = 'coco_doble';
    else if (nameLower.includes('coco privado')) beachId = 'coco_privado';
    else if (nameLower.includes('coco cristal')) beachId = 'coco_cristal';

    // Categorize food vs activity
    const foodKeywords = ['juice', 'cream', 'banana', 'krowky', 'chips', 'guanábana', 'guanabana', 'panameño', 'panameno', 'fruit pop', 'pops', 'coconut chips'];
    const isFood = foodKeywords.some(kw => nameLower.includes(kw));

    if (isFood) {
      foodItems.push(`${item.name} x${item.quantity}`);
    } else {
      activityItems.push(`${item.name} x${item.quantity}`);
    }
  }

  // Build the INI block
  const lines: string[] = [];
  lines.push(`; ─── ${bookingDate} — ${booking.customerName || 'Guest'} ───`);
  lines.push(`[${bookingDate}]`);

  if (isFishingTrip) {
    // Fishing booking
    lines.push(`fishing_1_type=${fishingType}`);
    lines.push(`fishing_1_anglers=${fishingAnglers || 1}`);
    if (foodItems.length > 0) {
      lines.push(`fishing_1_food=${foodItems.join(',')}`);
    }
  }

  if (beachId || adults > 0 || kids > 0 || overnightNights > 0) {
    // Beach/day trip booking
    lines.push(`booking_1_beach=${beachId || 'coco_loco'}`);
    lines.push(`booking_1_adults=${adults || 1}`);
    lines.push(`booking_1_kids=${kids}`);
    if (foodItems.length > 0) {
      lines.push(`booking_1_food=${foodItems.join(',')}`);
    }
    if (activityItems.length > 0) {
      lines.push(`booking_1_activities=${activityItems.join(',')}`);
    }
    lines.push(`booking_1_overnight=${overnightNights}`);
    if (returnBoat > 0 || overnightNights > 0) {
      lines.push(`booking_1_return_boat=${returnBoat || (adults + kids)}`);
    }
  }

  // If neither fishing nor beach detected, just dump all items as a generic booking
  if (!isFishingTrip && !beachId && adults === 0) {
    lines.push(`booking_1_beach=coco_loco`);
    lines.push(`booking_1_adults=1`);
    lines.push(`booking_1_kids=0`);
    if (foodItems.length > 0) {
      lines.push(`booking_1_food=${foodItems.join(',')}`);
    }
    if (activityItems.length > 0) {
      lines.push(`booking_1_activities=${activityItems.join(',')}`);
    }
  }

  lines.push('');
  lines.push(`confirmed=${booking.confirmationNumber}`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// EMAIL BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildEmailHTML(booking: BookingEmailData): string {
  const itemRows = booking.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">
          ${item.name}
          ${item.date ? `<br><span style="font-size:12px;color:#94a3b8;">${item.date}</span>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:14px;color:#475569;">
          ${item.quantity}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;font-weight:600;color:#0f172a;">
          $${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join('');

  const contactLines: string[] = [];
  if (booking.customerEmail) {
    contactLines.push(`<a href="mailto:${booking.customerEmail}" style="color:#0d9488;text-decoration:none;">${booking.customerEmail}</a>`);
  }
  if (booking.customerWhatsapp) {
    contactLines.push(`<a href="https://wa.me/${booking.customerWhatsapp.replace(/[^0-9]/g, '')}" style="color:#25d366;text-decoration:none;">WhatsApp: ${booking.customerWhatsapp}</a>`);
  }

  // Generate sync.ini block
  const syncBlock = generateSyncINIBlock(booking);
  const syncBlockHTML = syncBlock
    .split('\n')
    .map(line => line.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('<br>');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d9488,#14b8a6);border-radius:16px 16px 0 0;padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">New Booking Request</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Cebaco Bay — Bahía de los Cocos</p>
    </div>

    <!-- Confirmation Badge -->
    <div style="background:#fff;padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#0d9488;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Confirmation Number</p>
        <p style="margin:0;font-size:28px;font-weight:800;color:#0f172a;letter-spacing:2px;">${booking.confirmationNumber}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">STATUS: PENDING CONFIRMATION</p>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="background:#fff;padding:20px 24px;border-bottom:1px solid #f1f5f9;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Customer Details</h2>
      <p style="margin:0 0 8px;font-size:15px;color:#334155;"><strong>${booking.customerName || 'Guest'}</strong></p>
      ${contactLines.map((line) => `<p style="margin:0 0 4px;font-size:14px;">${line}</p>`).join('')}
    </div>

    <!-- Items Table -->
    <div style="background:#fff;padding:20px 24px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Booking Items</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:14px 12px;font-size:16px;font-weight:800;color:#0f172a;">TOTAL</td>
            <td style="padding:14px 12px;text-align:right;font-size:20px;font-weight:800;color:#0d9488;">$${booking.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- sync.ini Code Block -->
    <div style="background:#fff;padding:20px 24px;border-top:1px solid #f1f5f9;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#0f172a;">
        <span style="display:inline-block;width:20px;height:20px;background:#1e293b;color:#fff;border-radius:4px;text-align:center;line-height:20px;font-size:11px;margin-right:8px;">&#60;/&#62;</span>
        sync.ini — Copy &amp; Paste to Confirm
      </h2>
      <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">Add this block to sync.ini on GitHub to confirm the booking:</p>
      <div style="background:#1e293b;border-radius:10px;padding:16px 18px;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:1.6;color:#e2e8f0;overflow-x:auto;">
        ${syncBlockHTML}
      </div>
      <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">
        File: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;">github.com/cebacoco/configs/main/sync.ini</code>
      </p>
    </div>

    <!-- Action Note -->
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:20px 24px;border-top:1px solid #f1f5f9;">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Action needed:</strong> Please contact the customer to confirm their booking and arrange transportation details. Then add the sync.ini block above to confirm.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:24px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        Sent automatically from the Cebaco Bay app<br>
        Confirmation: ${booking.confirmationNumber}
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(booking: BookingEmailData): string {
  const itemLines = booking.items
    .map((i) => {
      let line = `  - ${i.name} x${i.quantity} = $${(i.price * i.quantity).toFixed(2)}`;
      if (i.date) line += ` (${i.date})`;
      return line;
    })
    .join('\n');

  const contactInfo = [
    booking.customerEmail ? `  Email: ${booking.customerEmail}` : null,
    booking.customerWhatsapp ? `  WhatsApp: ${booking.customerWhatsapp}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const syncBlock = generateSyncINIBlock(booking);

  return `NEW BOOKING REQUEST — CEBACO BAY
========================================
CONFIRMATION: ${booking.confirmationNumber}
STATUS: PENDING CONFIRMATION
========================================

Customer: ${booking.customerName || 'Guest'}
${contactInfo}

Items:
${itemLines}

TOTAL: $${booking.total.toFixed(2)}

========================================
SYNC.INI — COPY & PASTE TO CONFIRM
========================================
Add this block to sync.ini on GitHub:

${syncBlock}

========================================
File: github.com/cebacoco/configs/main/sync.ini
========================================

Please contact the customer to confirm their booking
and arrange transportation details.

Sent from the Cebaco Bay app`;
}

/**
 * Send a booking email directly via SMTP2GO REST API.
 */
export async function sendBookingEmail(
  booking: BookingEmailData
): Promise<{ success: boolean; error?: string }> {
  if (!SMTP2GO_API_KEY || SMTP2GO_API_KEY === 'PASTE_YOUR_SMTP2GO_API_KEY_HERE') {
    console.error('[emailService] SMTP2GO API key not configured!');
    return {
      success: false,
      error: 'Email service not configured. Please set your SMTP2GO API key in app/lib/emailService.ts',
    };
  }

  const subject = `[${booking.confirmationNumber}] New Booking: ${booking.customerName || 'Guest'} — $${booking.total.toFixed(2)}`;

  const payload = {
    api_key: SMTP2GO_API_KEY,
    to: [`Cebaco Bay <${RECIPIENT_EMAIL}>`],
    sender: `Cebaco Bay App <${SENDER_EMAIL}>`,
    subject,
    text_body: buildEmailText(booking),
    html_body: buildEmailHTML(booking),
  };

  try {
    console.log('[emailService] Sending email via SMTP2GO...');

    const response = await fetch(SMTP2GO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result?.data?.succeeded > 0) {
      console.log('[emailService] Email sent successfully!', result.data);
      return { success: true };
    }

    const errorMsg =
      result?.data?.error ||
      result?.data?.failures?.[0]?.error ||
      result?.message ||
      `SMTP2GO responded with status ${response.status}`;

    console.warn('[emailService] SMTP2GO error:', errorMsg, result);
    return { success: false, error: errorMsg };
  } catch (err: any) {
    console.error('[emailService] Network error sending email:', err);
    return {
      success: false,
      error: err?.message || 'Network error — could not reach SMTP2GO',
    };
  }
}

/**
 * Check if the email service is properly configured
 */
export function isEmailConfigured(): boolean {
  return !!SMTP2GO_API_KEY && SMTP2GO_API_KEY !== 'PASTE_YOUR_SMTP2GO_API_KEY_HERE';
}

/**
 * Generate sync.ini block for external use (e.g., display in booking history)
 */
export function getSyncINIBlock(booking: BookingEmailData): string {
  return generateSyncINIBlock(booking);
}
