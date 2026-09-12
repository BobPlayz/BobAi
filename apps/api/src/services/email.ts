import net from "node:net";
import tls from "node:tls";

const TIMEOUT_MS = 15_000;

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
};

function config(): SmtpConfig {
  const host = process.env.BOBAI_SMTP_HOST?.trim();
  const port = Number(process.env.BOBAI_SMTP_PORT || 587);
  const from = process.env.BOBAI_SMTP_FROM?.trim();
  const user = process.env.BOBAI_SMTP_USER?.trim();
  const password = process.env.BOBAI_SMTP_PASSWORD;
  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP email delivery is not configured");
  if ((user && !password) || (!user && password)) throw new Error("BOBAI_SMTP_USER and BOBAI_SMTP_PASSWORD must be provided together");
  return { host, port, user, password, from };
}

function readResponse(socket: net.Socket | tls.TLSSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const lines: string[] = [];
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString("utf8");
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() || "";
      for (const line of parts) {
        lines.push(line);
        if (/^\d{3} /.test(line)) { cleanup(); resolve(lines.join("\n")); return; }
      }
      if (lines.join("\n").length + buffer.length > 64_000) { cleanup(); reject(new Error("SMTP response too large")); }
    };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("SMTP connection closed unexpectedly")); };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

function command(socket: net.Socket | tls.TLSSocket, value: string, expected: number[] = [250]) {
  socket.write(`${value}\r\n`);
  return readResponse(socket).then(response => {
    const finalLine = response.split("\n").at(-1) || "";
    const code = Number(finalLine.slice(0, 3));
    if (!expected.includes(code)) throw new Error(`SMTP command failed (${code})`);
    return response;
  });
}

function connect(configValue: SmtpConfig): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = configValue.port === 465;
    const socket = secure
      ? tls.connect({ host: configValue.host, port: configValue.port, servername: configValue.host })
      : net.connect({ host: configValue.host, port: configValue.port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("SMTP connection timed out")); }, TIMEOUT_MS);
    const onConnect = () => { clearTimeout(timer); resolve(socket); };
    socket.once(secure ? "secureConnect" : "connect", onConnect);
    socket.once("error", error => { clearTimeout(timer); reject(error); });
  });
}

function address(value: string) {
  const match = value.match(/<([^<>\s]+)>/);
  return (match?.[1] || value).trim();
}

function encodeHeader(value: string) {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=` : value;
}

function dotStuff(value: string) {
  return value.replace(/^\./gm, "..");
}

async function sendSmtp(to: string, subject: string, text: string) {
  const c = config();
  let socket = await connect(c);
  try {
    let response = await readResponse(socket);
    if (!response.startsWith("220")) throw new Error("SMTP server rejected connection");
    response = await command(socket, "EHLO bobai", [250]);

    if (c.port !== 465 && /(^|\n)250[ -]STARTTLS/i.test(response)) {
      await command(socket, "STARTTLS", [220]);
      socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const upgraded = tls.connect({ socket, servername: c.host });
        const timer = setTimeout(() => { upgraded.destroy(); reject(new Error("SMTP TLS negotiation timed out")); }, TIMEOUT_MS);
        upgraded.once("secureConnect", () => { clearTimeout(timer); resolve(upgraded); });
        upgraded.once("error", error => { clearTimeout(timer); reject(error); });
      });
      response = await command(socket, "EHLO bobai", [250]);
    } else if (c.user && c.port !== 465) {
      throw new Error("SMTP server did not advertise STARTTLS; refusing to send credentials without TLS");
    }

    if (c.user) {
      const authResponse = await command(socket, "AUTH PLAIN", [334, 235]);
      if (authResponse.split("\n").at(-1)?.startsWith("334")) {
        await command(socket, Buffer.from(`\0${c.user}\0${c.password || ""}`).toString("base64"), [235]);
      }
    }

    await command(socket, `MAIL FROM:<${address(c.from)}>`, [250]);
    await command(socket, `RCPT TO:<${address(to)}>`, [250, 251]);
    await command(socket, "DATA", [354]);
    const body = [
      `From: ${c.from}`,
      `To: ${to}`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      dotStuff(text.replace(/\r?\n/g, "\r\n")),
      ".",
    ].join("\r\n");
    await command(socket, body, [250]);
    await command(socket, "QUIT", [221, 250]).catch(() => undefined);
  } finally {
    socket.destroy();
  }
}

export async function sendEmail(to: string, subject: string, text: string) {
  await sendSmtp(to, subject, text);
}

export async function sendEmailOtp(email: string, code: string) {
  await sendEmail(email, "Your BobAI verification code", `Your BobAI verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`);
}

export async function sendPasswordResetEmail(email: string, rawToken: string) {
  const origin = process.env.BOBAI_WEB_URL?.trim() || process.env.CORS_ORIGIN?.split(",")[0]?.trim() || "http://localhost:3000";
  let resetUrl: URL;
  try { resetUrl = new URL("/reset-password", origin); } catch { throw new Error("BOBAI_WEB_URL or CORS_ORIGIN is invalid"); }
  resetUrl.searchParams.set("token", rawToken);
  await sendEmail(email, "Reset your BobAI password", `A password reset was requested for your BobAI account. Open this link within 15 minutes to choose a new password:\n\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`);
}
