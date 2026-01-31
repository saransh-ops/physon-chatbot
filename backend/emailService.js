const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            if (process.env.EMAIL_SERVICE === 'gmail') {
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
            } else if (process.env.EMAIL_SERVICE === 'sendgrid') {
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.sendgrid.net',
                    port: 587,
                    auth: {
                        user: 'apikey',
                        pass: process.env.SENDGRID_API_KEY
                    }
                });
            } else {
                // Custom SMTP
                this.transporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
            }
            console.log('✅ Email service initialized');
        } catch (error) {
            console.error('⚠️ Email service initialization failed:', error.message);
            console.log('⚠️ Email verification will not work. Please configure email settings in .env');
        }
    }

    async sendOTP(email, otpCode) {
        if (!this.transporter) {
            console.log(`📧 [DEV MODE] OTP for ${email}: ${otpCode}`);
            return true;
        }

        try {
            const mailOptions = {
                from: process.env.EMAIL_USER || 'noreply@chatbot.com',
                to: email,
                subject: 'Your Verification Code - AI Chatbot',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
                        <div style="background: white; padding: 30px; border-radius: 10px;">
                            <h1 style="color: #667eea; text-align: center;">🤖 AI Chatbot</h1>
                            <h2 style="color: #333; text-align: center;">Email Verification</h2>
                            <p style="color: #666; font-size: 16px; text-align: center;">
                                Thank you for signing up! Use the code below to verify your email:
                            </p>
                            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
                                <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0;">
                                    ${otpCode}
                                </h1>
                            </div>
                            <p style="color: #999; font-size: 14px; text-align: center;">
                                This code will expire in 10 minutes.
                            </p>
                            <p style="color: #999; font-size: 14px; text-align: center;">
                                If you didn't request this code, please ignore this email.
                            </p>
                        </div>
                    </div>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`✅ OTP sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            // In development, log OTP to console
            console.log(`📧 [DEV MODE] OTP for ${email}: ${otpCode}`);
            return false;
        }
    }
}

module.exports = new EmailService();