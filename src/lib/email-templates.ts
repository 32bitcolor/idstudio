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

export function subtaskAssigned(params: {
  assigneeName: string;
  subtaskText: string;
  cardTitle: string;
  boardName: string;
}): Email {
  const { assigneeName, subtaskText, cardTitle, boardName } = params;
  return {
    subject: `You were assigned a subtask on "${cardTitle}"`,
    html: layout(
      "New subtask assigned to you",
      `<p>Hi ${esc(assigneeName)},</p>
<p><strong>${esc(subtaskText)}</strong></p>
<p>On card "${esc(cardTitle)}" in ${esc(boardName)}.</p>`,
    ),
    text: `Hi ${assigneeName},\n\n${subtaskText}\n\nOn card "${cardTitle}" in ${boardName}.`,
  };
}

export function cardAssigned(params: { assigneeName: string; cardTitle: string; boardName: string }): Email {
  const { assigneeName, cardTitle, boardName } = params;
  return {
    subject: `You were assigned "${cardTitle}"`,
    html: layout(
      "A card was assigned to you",
      `<p>Hi ${esc(assigneeName)},</p>
<p><strong>${esc(cardTitle)}</strong></p>
<p>On board ${esc(boardName)}.</p>`,
    ),
    text: `Hi ${assigneeName},\n\n${cardTitle}\n\nOn board ${boardName}.`,
  };
}

export function smeAssigned(params: { smeName: string; cardTitle: string; boardName: string }): Email {
  const { smeName, cardTitle, boardName } = params;
  return {
    subject: `You're the SME on "${cardTitle}"`,
    html: layout(
      "You were added as a subject-matter expert",
      `<p>Hi ${esc(smeName)},</p>
<p>You've been named the SME on <strong>${esc(cardTitle)}</strong>.</p>
<p>On board ${esc(boardName)}.</p>`,
    ),
    text: `Hi ${smeName},\n\nYou've been named the SME on "${cardTitle}".\n\nOn board ${boardName}.`,
  };
}

export function commentPosted(params: {
  recipientName: string;
  commenterName: string;
  cardTitle: string;
  boardName: string;
  excerpt: string;
}): Email {
  const { recipientName, commenterName, cardTitle, boardName, excerpt } = params;
  return {
    subject: `New comment on "${cardTitle}"`,
    html: layout(
      "New comment",
      `<p>Hi ${esc(recipientName)},</p>
<p>${esc(commenterName)} commented on <strong>${esc(cardTitle)}</strong> (${esc(boardName)}):</p>
<p style="border-left:3px solid #ddd;padding-left:12px;color:#444">${esc(excerpt)}</p>`,
    ),
    text: `Hi ${recipientName},\n\n${commenterName} commented on "${cardTitle}" (${boardName}):\n\n${excerpt}`,
  };
}

export function reviewRequested(params: {
  reviewerName: string;
  deliverableName: string;
  projectName: string;
  requesterName: string;
  dueDate: string | null;
}): Email {
  const { reviewerName, deliverableName, projectName, requesterName, dueDate } = params;
  return {
    subject: `Review requested: "${deliverableName}"`,
    html: layout(
      "You've been asked to review",
      `<p>Hi ${esc(reviewerName)},</p>
<p>${esc(requesterName)} asked you to review <strong>${esc(deliverableName)}</strong> in project "${esc(projectName)}".</p>
${dueDate ? `<p>Due by <strong>${esc(dueDate)}</strong>.</p>` : ""}`,
    ),
    text: `Hi ${reviewerName},\n\n${requesterName} asked you to review "${deliverableName}" in project "${projectName}".${dueDate ? `\n\nDue by ${dueDate}.` : ""}`,
  };
}

export function reviewDecided(params: {
  requesterName: string;
  deliverableName: string;
  projectName: string;
  reviewerName: string;
  decision: "approved" | "changes_requested";
  feedback?: string | null;
}): Email {
  const { requesterName, deliverableName, projectName, reviewerName, decision, feedback } = params;
  const verb = decision === "approved" ? "approved" : "requested changes on";
  return {
    subject: decision === "approved" ? `Approved: "${deliverableName}"` : `Changes requested: "${deliverableName}"`,
    html: layout(
      decision === "approved" ? "Your review was approved" : "Changes were requested",
      `<p>Hi ${esc(requesterName)},</p>
<p>${esc(reviewerName)} ${verb} <strong>${esc(deliverableName)}</strong> in project "${esc(projectName)}".</p>
${feedback ? `<p style="border-left:3px solid #ddd;padding-left:12px;color:#444">${esc(feedback)}</p>` : ""}`,
    ),
    text: `Hi ${requesterName},\n\n${reviewerName} ${verb} "${deliverableName}" in project "${projectName}".${feedback ? `\n\n${feedback}` : ""}`,
  };
}

export function memberWelcome(params: { name: string; workspaceName: string; inviterName: string }): Email {
  const { name, workspaceName, inviterName } = params;
  return {
    subject: `You've been added to ${workspaceName} on IDStudio`,
    html: layout(
      "Welcome to IDStudio",
      `<p>Hi ${esc(name)},</p>
<p>${esc(inviterName)} added you to the <strong>${esc(workspaceName)}</strong> workspace.</p>
<p>Ask ${esc(inviterName)} for your initial password, then sign in and change it under Settings → Account.</p>`,
    ),
    text: `Hi ${name},\n\n${inviterName} added you to the ${workspaceName} workspace.\n\nAsk ${inviterName} for your initial password, then sign in and change it under Settings → Account.`,
  };
}

export function passwordReset(params: { name: string; workspaceName: string; adminName: string }): Email {
  const { name, workspaceName, adminName } = params;
  return {
    subject: "Your IDStudio password was reset",
    html: layout(
      "Your password was reset",
      `<p>Hi ${esc(name)},</p>
<p>${esc(adminName)} reset your password for the <strong>${esc(workspaceName)}</strong> workspace. Ask them for the new password, then change it under Settings → Account.</p>
<p style="color:#888;font-size:12px">If you didn't expect this, contact your workspace admin.</p>`,
    ),
    text: `Hi ${name},\n\n${adminName} reset your password for the ${workspaceName} workspace. Ask them for the new password, then change it under Settings → Account.\n\nIf you didn't expect this, contact your workspace admin.`,
  };
}

export function cardDueReminder(params: { assigneeName: string; cardTitle: string; boardName: string; when: string }): Email {
  const { assigneeName, cardTitle, boardName, when } = params;
  return {
    subject: `Due ${when}: "${cardTitle}"`,
    html: layout(
      "A card is due soon",
      `<p>Hi ${esc(assigneeName)},</p>
<p><strong>${esc(cardTitle)}</strong> is due <strong>${esc(when)}</strong>.</p>
<p>On board ${esc(boardName)}.</p>`,
    ),
    text: `Hi ${assigneeName},\n\n${cardTitle} is due ${when}.\n\nOn board ${boardName}.`,
  };
}

export function milestoneDueReminder(params: { recipientName: string; milestoneName: string; projectName: string; when: string }): Email {
  const { recipientName, milestoneName, projectName, when } = params;
  return {
    subject: `Milestone due ${when}: "${milestoneName}"`,
    html: layout(
      "A milestone is due soon",
      `<p>Hi ${esc(recipientName)},</p>
<p>Milestone <strong>${esc(milestoneName)}</strong> in project "${esc(projectName)}" is due <strong>${esc(when)}</strong>.</p>`,
    ),
    text: `Hi ${recipientName},\n\nMilestone "${milestoneName}" in project "${projectName}" is due ${when}.`,
  };
}
