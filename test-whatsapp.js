require('dotenv').config();
const { getWhatsAppServiceWithSettings } = require('./src/lib/whatsapp-service');

async function run() {
  try {
    const whatsapp = await getWhatsAppServiceWithSettings();
    const otp = "123456";
    
    await whatsapp.sendTemplateMessage({
        to: "918667629499", // The user's number from screenshot
        templateName: 'client_login_code_2',
        language: 'en_US',
        components: [
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: otp }
                ]
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                { type: 'text', text: otp }
              ]
            }
        ]
    });
    console.log("Success!");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
