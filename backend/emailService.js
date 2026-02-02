const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Send OTP email
const sendOTP = async (email, otpCode) => {
    try {
        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: '🔐 Your AI Chatbot Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">AI Chatbot Verification</h2>
                    <p>Your verification code is:</p>
                    <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; text-align: center;">
                        <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
                    </div>
                    <p style="color: #6B7280; margin-top: 20px;">This code will expire in 10 minutes.</p>
                    <p style="color: #6B7280;">If you didn't request this code, please ignore this email.</p>
                </div>
            `
        });

        console.log(`✅ OTP email sent to ${email}`);
    } catch (error) {
        console.error('❌ Error sending email:', error);
        // Print OTP in dev mode if email fails
        console.log(`📧 [DEV MODE] OTP for ${email}: ${otpCode}`);
        throw error;
    }
};

console.log('✅ Email service initialized (Resend)');

module.exports = { sendOTP };