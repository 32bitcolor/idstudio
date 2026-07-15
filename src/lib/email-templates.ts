// Plain template literals, matching the house style already established in
// course-export-assets.ts for generating HTML outside the React tree — no
// templating library. Deliberately plain (a heading, a couple of lines): these
// are notifications, not marketing mail.

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

function layout(heading: string, bodyHtml: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:0 0 12px">${heading}</h2>
  ${bodyHtml}
  <p style="margin-top:24px;color:#888;font-size:12px">IDStudio</p>
</div>`;
}

type Email = { subject: string; html: string; text: string };

export function intakeSubmittedConfirmation(params: { ticket: string; title: string; workspaceName: string }): Email {
  const { ticket, title, workspaceName } = params;
  return {
    subject: `We got your request — ${ticket}`,
    html: layout(
      "Thanks — your request is in",
      `<p>Reference: <strong>${esc(ticket)}</strong></p>
<p>${esc(title)}</p>
<p>The ${esc(workspaceName)} team will be in touch.</p>`,
    ),
    text: `Reference: ${ticket}\n${title}\n\nThe ${workspaceName} team will be in touch.`,
  };
}

export function newIntakeRequestForAdmin(params: {
  ticket: string;
  title: string;
  requesterName: string;
  workspaceName: string;
}): Email {
  const { ticket, title, requesterName, workspaceName } = params;
  return {
    subject: `New request — ${ticket}: ${title}`,
    html: layout(
      "New intake request",
      `<p><strong>${esc(ticket)}</strong> from ${esc(requesterName)}</p>
<p>${esc(title)}</p>
<p>Review it in ${esc(workspaceName)}'s Intake queue.</p>`,
    ),
    text: `${ticket} from ${requesterName}\n${title}\n\nReview it in ${workspaceName}'s Intake queue.`,
  };
}

export function intakeApprovedNotification(params: { ticket: string; title: string; workspaceName: string }): Email {
  const { ticket, title, workspaceName } = params;
  return {
    subject: `Your request was approved — ${ticket}`,
    html: layout(
      "Your request was approved",
      `<p>Reference: <strong>${esc(ticket)}</strong></p>
<p>"${esc(title)}" has been approved and is now moving forward with the ${esc(workspaceName)} team.</p>`,
    ),
    text: `Reference: ${ticket}\n"${title}" has been approved and is now moving forward with the ${workspaceName} team.`,
  };
}

export function intakeRejectedNotification(params: {
  ticket: string;
  title: string;
  workspaceName: string;
  reason: string | null;
}): Email {
  const { ticket, title, workspaceName, reason } = params;
  return {
    subject: `Update on your request — ${ticket}`,
    html: layout(
      "Update on your request",
      `<p>Reference: <strong>${esc(ticket)}</strong></p>
<p>"${esc(title)}" won't be moving forward with the ${esc(workspaceName)} team at this time.</p>
${reason ? `<p>${esc(reason)}</p>` : ""}`,
    ),
    text: `Reference: ${ticket}\n"${title}" won't be moving forward with the ${workspaceName} team at this time.${reason ? `\n\n${reason}` : ""}`,
  };
}
