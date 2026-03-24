export class ConsoleEmailProvider {
  async send({ to, subject, html, text }) {
    console.log("[notifications:email:console]", {
      to,
      subject,
      text,
      htmlPreview: typeof html === "string" ? html.slice(0, 240) : null,
    });

    return {
      provider: "console",
      messageId: `console-${Date.now()}`,
    };
  }
}
