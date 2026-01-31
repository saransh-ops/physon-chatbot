require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const db = require('./database');
const emailService = require('./emailService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============= AUTH ROUTES =============

// Register user and send OTP
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Check if user exists
        const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const insertUser = db.prepare('INSERT INTO users (email, password, name, is_verified) VALUES (?, ?, ?, 0)');
        insertUser.run(email, hashedPassword, name || '');

        // Generate and send OTP
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const insertOTP = db.prepare('INSERT INTO otp_codes (email, otp_code, expires_at) VALUES (?, ?, ?)');
        insertOTP.run(email, otpCode, expiresAt);

        // Send OTP email
        await emailService.sendOTP(email, otpCode);

        res.json({
            message: 'Registration successful! Check your email for verification code.',
            email: email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
        return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    try {
        // Get latest OTP for email
        const otpRecord = db.prepare('SELECT * FROM otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(email);
        
        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Check if OTP expired
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Verify OTP
        if (otpRecord.otp_code !== otpCode) {
            return res.status(400).json({ error: 'Invalid OTP code' });
        }

        // Mark user as verified
        const updateUser = db.prepare('UPDATE users SET is_verified = 1 WHERE email = ?');
        updateUser.run(email);

        // Delete used OTP
        const deleteOTP = db.prepare('DELETE FROM otp_codes WHERE email = ?');
        deleteOTP.run(email);

        // Get user and generate token
        const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Email verified successfully!',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Check if user exists
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_verified) {
            return res.status(400).json({ error: 'Email already verified' });
        }

        // Generate new OTP
        const otpCode = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Delete old OTPs
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);

        // Insert new OTP
        db.prepare('INSERT INTO otp_codes (email, otp_code, expires_at) VALUES (?, ?, ?)').run(email, otpCode, expiresAt);

        await emailService.sendOTP(email, otpCode);
        res.json({ message: 'New verification code sent!' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login with 2FA
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ error: 'Please verify your email first' });
        }

        // Verify password first
        bcrypt.compare(password, user.password, async (err, validPassword) => {
            if (err || !validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate and send OTP for 2FA
            const otpCode = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Delete old OTPs
            db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);

            // Insert new OTP
            db.prepare('INSERT INTO otp_codes (email, otp_code, expires_at) VALUES (?, ?, ?)')
                .run(email, otpCode, expiresAt);

            // Send OTP email
            await emailService.sendOTP(email, otpCode);

            res.json({
                message: 'Verification code sent to your email',
                requiresOTP: true,
                email: email
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify login OTP
app.post('/api/auth/verify-login-otp', (req, res) => {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
        return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    try {
        // Get latest OTP for email
        const otpRecord = db.prepare('SELECT * FROM otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1').get(email);
        
        if (!otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Check if OTP expired
        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        // Verify OTP
        if (otpRecord.otp_code !== otpCode) {
            return res.status(400).json({ error: 'Invalid OTP code' });
        }

        // Delete used OTP
        db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email);

        // Get user and generate token
        const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============= CHAT ROUTES =============

// Stream chat from Groq
app.post('/api/chat/stream', authenticateToken, async (req, res) => {
    const { messages, model, conversationId } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.groq.com/openai/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            data: {
                model: model || 'llama-3.3-70b-versatile',
                messages: messages,
                temperature: 0.7,
                max_tokens: 4096,
                stream: true,
            },
            responseType: 'stream'
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponse = '';

        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content;
                            if (content) {
                                fullResponse += content;
                                res.write(`data: ${JSON.stringify({ content })}\n\n`);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        });

        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();

            // Save conversation to database
            if (conversationId) {
                const userMessage = messages[messages.length - 1];
                
                try {
                    // Check if this is the first user message BEFORE saving
                    const existingMessages = db.prepare(
                        "SELECT COUNT(*) as count FROM chat_history WHERE conversation_id = ? AND role = 'user'"
                    ).get(conversationId);
                    
                    const isFirstMessage = !existingMessages || existingMessages.count === 0;
                    
                    // Save user message
                    db.prepare('INSERT INTO chat_history (user_id, conversation_id, role, content, model) VALUES (?, ?, ?, ?, ?)')
                        .run(req.user.id, conversationId, userMessage.role, userMessage.content, model || 'llama-3.3-70b-versatile');

                    // Save assistant response
                    db.prepare('INSERT INTO chat_history (user_id, conversation_id, role, content, model) VALUES (?, ?, ?, ?, ?)')
                        .run(req.user.id, conversationId, 'assistant', fullResponse, model || 'llama-3.3-70b-versatile');

                    // Auto-rename conversation if this is the first message
                    if (isFirstMessage) {
                        let newTitle = userMessage.content.substring(0, 40);
                        if (userMessage.content.length > 40) {
                            newTitle += '...';
                        }
                        
                        db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                            .run(newTitle, conversationId);
                        
                        console.log(`✅ Renamed conversation to: "${newTitle}"`);
                    } else {
                        // Just update timestamp
                        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                            .run(conversationId);
                    }
                } catch (error) {
                    console.error('❌ Error saving chat history:', error);
                }
            }
        });

        response.data.on('error', (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
            res.end();
        });

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to get response from AI' });
    }
});

// ============= CONVERSATION ROUTES =============

// Create new conversation
app.post('/api/conversations', authenticateToken, (req, res) => {
    const { title } = req.body;
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        db.prepare('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)')
            .run(conversationId, req.user.id, title || 'New Conversation');
        
        res.json({
            id: conversationId,
            title: title || 'New Conversation',
            created_at: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// Get all conversations for user
app.get('/api/conversations', authenticateToken, (req, res) => {
    try {
        const conversations = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC')
            .all(req.user.id);
        res.json({ conversations });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

// Get conversation history
app.get('/api/conversations/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    try {
        const messages = db.prepare('SELECT * FROM chat_history WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
            .all(id, req.user.id);
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversation' });
    }
});

// Delete conversation
app.delete('/api/conversations/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    try {
        db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(id, req.user.id);
        db.prepare('DELETE FROM chat_history WHERE conversation_id = ? AND user_id = ?').run(id, req.user.id);
        
        res.json({ message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// ============= WEATHER ROUTE =============

app.get('/api/weather', authenticateToken, async (req, res) => {
    const { city } = req.query;

    if (!city) {
        return res.status(400).json({ error: 'City parameter is required' });
    }

    try {
        const apiKey = process.env.WEATHER_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ 
                error: 'Weather API key not configured',
                message: 'Get a free API key from https://openweathermap.org/api'
            });
        }

        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
        );

        const data = response.data;
        const weather = {
            city: data.name,
            country: data.sys.country,
            temperature: Math.round(data.main.temp),
            feels_like: Math.round(data.main.feels_like),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            humidity: data.main.humidity,
            wind_speed: data.wind.speed,
            pressure: data.main.pressure
        };

        res.json({ weather });
    } catch (error) {
        if (error.response?.status === 404) {
            res.status(404).json({ error: 'City not found' });
        } else {
            console.error('Weather API error:', error);
            res.status(500).json({ error: 'Failed to fetch weather data' });
        }
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'AI Chatbot API is running',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
