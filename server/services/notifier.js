import nodemailer from 'nodemailer';
import WebSocket from 'ws';

let wss = null;

export function setWss(wsServer) {
  wss = wsServer;
}

/**
 * 通过 WebSocket 广播通知
 */
export function notifyWebSocket(type, data) {
  if (!wss) return;

  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * 发送邮件通知
 */
export async function notifyEmail(subject, html, settings) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = settings;

  if (!SMTP_HOST || !SMTP_USER || !NOTIFY_EMAIL) {
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT) || 587,
      secure: parseInt(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `🔥 LKB Hot Monitor: ${subject}`,
      html,
    });

    return true;
  } catch (err) {
    console.error('Email notification error:', err.message);
    return false;
  }
}

/**
 * 发送所有类型的通知
 */
export async function sendNotification(hotspot, settings = {}) {
  // WebSocket 实时推送
  notifyWebSocket('new-hotspot', hotspot);

  // 邮件通知（高热度时发送）
  if (hotspot.heat_score >= 8) {
    const html = `
      <h2>🔥 AI热点提醒</h2>
      <h3>${hotspot.title}</h3>
      <p>${hotspot.summary || ''}</p>
      <p><strong>来源：</strong>${hotspot.source}</p>
      <p><strong>热度：</strong>${hotspot.heat_score}/10</p>
      ${hotspot.source_url ? `<p><a href="${hotspot.source_url}">查看原文</a></p>` : ''}
    `;
    await notifyEmail(hotspot.title, html, settings);
  }
}
