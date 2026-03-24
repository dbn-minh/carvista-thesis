export class ConsoleSmsProvider {
  async sendOtp({ destination, message }) {
    console.log("[notifications:sms:console]", {
      to: destination,
      message,
    });

    return {
      provider: "console",
      messageId: `console-sms-${Date.now()}`,
    };
  }
}
