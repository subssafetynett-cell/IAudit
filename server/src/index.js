import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import prisma from './prisma.js';
import bcrypt from 'bcrypt';
import { execSync } from 'child_process';

dotenv.config();

// Auto-apply database schema changes in production
try {
    console.log('Synchronizing database schema using local binary...');
    // Use the local node_modules binary instead of npx, as npx may not be in the PATH when run via pm2 or systemd on EC2
    execSync('./node_modules/.bin/prisma db push --accept-data-loss', { stdio: 'inherit' });
    execSync('./node_modules/.bin/prisma generate', { stdio: 'inherit' });
    console.log('Database synchronization completed.');
} catch (error) {
    console.error('Failed to synchronize database. Schema might be out of date:', error.message);
    console.log('You can manually trigger a sync by hitting /api/admin/upgrade-db');
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['https://apps.iaudit.global', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'], // Allow production and local development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
}));
app.use(express.json({ limit: '50mb' }));

// Content Security Policy middleware to allow Google Fonts and self-hosted resources
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' https://apps.iaudit.global; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "script-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "connect-src 'self' https://apps.iaudit.global https://fonts.googleapis.com;"
    );
    next();
});

// Prevent caching for API routes to fix AWS caching issue where companies/sites disappear on refresh
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

const router = express.Router();

// Email Transporter Configuration
const smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
const smtpPort = process.env.SMTP_PORT || '587';
const smtpUser = process.env.SMTP_USER || 'noreply@iaudit.global';
const smtpPass = process.env.SMTP_PASS || 'nfqhvzbfydxwpfsy';

const transporterConfig = {
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: smtpPort === '465',
    auth: {
        user: smtpUser,
        pass: smtpPass
    },
    tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
    }
};

const transporter = nodemailer.createTransport({
    ...transporterConfig,
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000    // 5 seconds
});

// Temporary in-memory store for OTPs - REMOVED for AWS scalability
// const otpStore = new Map();

// Helper function to generate a 6 digit code
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Root route to prevent 404
app.get('/', (req, res) => {
    res.send('AuditMate Backend is running.');
});

// Admin Route to manually force DB Schema push 
app.get('/api/admin/upgrade-db', (req, res) => {
    try {
        console.log('Manual DB upgrade requested...');
        const outputPush = execSync('./node_modules/.bin/prisma db push --accept-data-loss', { encoding: 'utf-8' });
        const outputGen = execSync('./node_modules/.bin/prisma generate', { encoding: 'utf-8' });

        res.status(200).send(`<pre>Database Synchronized Successfully!\n\n${outputPush}\n\n${outputGen}\n\nServer is automatically restarting to load the new schema. Please wait 5 seconds and refresh your app!</pre>`);

        // Force PM2 to restart this process so V8 memory reloads the new Prisma Client
        setTimeout(() => {
            console.log("Restarting process to apply Prisma schema...");
            process.exit(0);
        }, 1000);
    } catch (error) {
        console.error('Manual manual DB sync failed:', error);
        res.status(500).send(`<pre>Failed to synchronize database:\n\n${error.message}\n\n${error.stdout || ''}\n${error.stderr || ''}</pre>`);
    }
});

// Example route to get all companies (including sites and departments)
app.get('/api/companies', async (req, res) => {
    const { userId, admin } = req.query;
    console.log(`[DEBUG] GET /api/companies called with userId: ${userId}, admin: ${admin}`);
    try {
        if (admin === 'true') {
            const companies = await prisma.company.findMany({
                include: {
                    sites: {
                        include: { departments: true }
                    }
                }
            });
            console.log(`[DEBUG] Fetched ${companies.length} companies for Admin.`);
            return res.json(companies);
        }

        // SECURITY: Enforce strict userId filtering. Do not return all companies if userId is missing.
        if (!userId || userId === 'undefined' || userId === 'null') {
            console.warn(`[SECURITY] GET /api/companies called without valid userId. Returning empty list.`);
            return res.json([]);
        }
        const parsedUserId = parseInt(userId);
        if (isNaN(parsedUserId)) {
            return res.json([]);
        }

        const whereClause = { userId: parsedUserId };
        console.log(`[DEBUG] Querying companies with whereClause:`, whereClause);

        const companies = await prisma.company.findMany({
            where: whereClause,
            include: {
                sites: {
                    where: { userId: parsedUserId },
                    include: {
                        departments: true
                    }
                }
            }
        });

        console.log(`[DEBUG] Successfully fetched ${companies.length} companies for userId ${parsedUserId}.`);
        res.json(companies);
    } catch (error) {
        console.error('Failed to fetch companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies', details: error.message || String(error) });
    }
});

// Create a site
app.post('/api/companies/:companyId/sites', async (req, res) => {
    const { companyId } = req.params;
    const {
        name, description, siteType, status,
        address, city, state, country, postalCode,
        latitude, longitude, contactName, contactPosition,
        contactNumber, email, userId
    } = req.body;
    try {
        const site = await prisma.site.create({
            data: {
                name,
                description,
                siteType,
                status: status || 'Active',
                address,
                city,
                state,
                country,
                postalCode,
                latitude: latitude != null && String(latitude).trim() !== '' && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null,
                longitude: longitude != null && String(longitude).trim() !== '' && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null,
                contactName,
                contactPosition,
                contactNumber,
                email,
                companyId: parseInt(companyId),
                userId: userId ? parseInt(userId) : null
            }
        });
        res.status(201).json(site);
    } catch (error) {
        console.error('Error creating site:', error);
        res.status(500).json({ error: 'Failed to create site', details: error.message || String(error) });
    }
});

// Get all sites (with strict user filtering for security)
app.get('/api/sites', async (req, res) => {
    const { userId } = req.query;

    // SECURITY: Enforce strict userId filtering. Do not return all sites if userId is missing.
    if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json([]);
    }

    try {
        const parsedUserId = parseInt(userId);
        if (isNaN(parsedUserId)) {
            return res.json([]);
        }

        const sites = await prisma.site.findMany({
            where: { userId: parsedUserId },
            include: {
                company: true
            }
        });
        res.json(sites);
    } catch (error) {
        console.error('Failed to fetch sites:', error);
        res.status(500).json({ error: 'Failed to fetch sites' });
    }
});

// Update a site
app.put('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name, description, siteType, status,
        address, city, state, country, postalCode,
        latitude, longitude, contactName, contactPosition,
        contactNumber, email
    } = req.body;
    try {
        const site = await prisma.site.update({
            where: { id: parseInt(id) },
            data: {
                name,
                description,
                siteType,
                status,
                address,
                city,
                state,
                country,
                postalCode,
                latitude: latitude != null && String(latitude).trim() !== '' && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : null,
                longitude: longitude != null && String(longitude).trim() !== '' && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : null,
                contactName,
                contactPosition,
                contactNumber,
                email
            }
        });
        res.json(site);
    } catch (error) {
        console.error('Error updating site:', error);
        res.status(500).json({ error: 'Failed to update site' });
    }
});

// Delete a site
app.delete('/api/sites/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.site.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting site:', error);
        res.status(500).json({ error: 'Failed to delete site' });
    }
});

// Create a department
app.post('/api/sites/:siteId/departments', async (req, res) => {
    const { siteId } = req.params;
    const { name, code, status, manager, description } = req.body;
    try {
        const department = await prisma.department.create({
            data: {
                name,
                code,
                status: status || 'Active',
                manager,
                description,
                siteId: parseInt(siteId)
            }
        });
        res.status(201).json(department);
    } catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ error: 'Failed to create department' });
    }
});

// Update a department
app.put('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    const { name, code, status, manager, description } = req.body;
    try {
        const department = await prisma.department.update({
            where: { id: parseInt(id) },
            data: { name, code, status, manager, description }
        });
        res.json(department);
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({ error: 'Failed to update department' });
    }
});

// Delete a department
app.delete('/api/departments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.department.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ error: 'Failed to delete department' });
    }
});

// Example route to create a company
app.post('/api/companies', async (req, res) => {
    const {
        name, industry, description, logo,
        contactNumber, streetAddress, city,
        state, country, postalCode, standards, userId
    } = req.body;
    try {
        const parsedUserId = userId ? parseInt(userId) : null;

        // Enforce One Company Per User Rule
        if (parsedUserId) {
            const existingCompany = await prisma.company.findFirst({
                where: { userId: parsedUserId }
            });
            if (existingCompany) {
                return res.status(400).json({ error: 'User already has a registered company. Only one company is allowed per user.' });
            }
        }

        const company = await prisma.company.create({
            data: {
                name,
                industry,
                description,
                logo,
                contactNumber,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                isoStandards: standards || [],
                // Automatically set legacy fields for compatibility
                location: `${city || ''}, ${country || ''}`.trim().replace(/^, |,$/, ''),
                contactDetails: contactNumber,
                userId: parsedUserId
            },
        });
        res.status(201).json(company);
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
});

// Update a company
app.put('/api/companies/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name, industry, description, logo,
        contactNumber, streetAddress, city,
        state, country, postalCode, standards
    } = req.body;
    try {
        const company = await prisma.company.update({
            where: { id: parseInt(id) },
            data: {
                name,
                industry,
                description,
                logo,
                contactNumber,
                streetAddress,
                city,
                state,
                country,
                postalCode,
                isoStandards: standards || [],
                location: `${city || ''}, ${country || ''}`.trim().replace(/^, |,$/, ''),
                contactDetails: contactNumber
            },
        });
        res.json(company);
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
});

// Delete a company
app.delete('/api/companies/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.company.delete({
            where: { id: parseInt(id) },
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({ error: 'Failed to delete company' });
    }
});

// -------------------------
// Auth & OTP Routes
// -------------------------

// Alias for signup if frontend calls /api/auth/signup directly
// Refactored Send OTP logic to be reusable
const sendOtpLogic = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    let step = 'Lookup existing user';
    try {
        // 1. Prevent signup if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        step = 'Generate and Store OTP';
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minute expiration

        // Store OTP in database
        await prisma.otp.upsert({
            where: { email },
            update: { code: otp, expiresAt },
            create: { email, code: otp, expiresAt }
        });

        const mailOptions = {
            from: {
                name: 'iAudit Global',
                address: smtpUser
            },
            to: email,
            subject: 'Your Account Verification Code',
            headers: {
                'X-Entity-Ref-ID': otp,
            },
            text: `Your verification code is: ${otp}. This code will expire in 1 minute.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #00875b; font-size: 28px; margin: 0;">Welcome to iAudit Global</h1>
                    </div>
                    
                    <p style="color: #374151; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
                        Hello!<br><br>
                        Please use the verification code below to confirm your email address and complete your signup securely:
                    </p>
                    
                    <div style="background-color: #f3f4f6; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 32px;">
                        <p style="text-transform: uppercase; font-size: 14px; font-weight: 600; color: #6b7280; margin: 0 0 12px 0; letter-spacing: 1px;">Secure Verification Code</p>
                        <h2 style="font-size: 42px; font-weight: 800; color: #111827; letter-spacing: 8px; margin: 0;">${otp}</h2>
                    </div>
                    
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
                        This code will expire in <strong>1 minute</strong>. If you did not request this verification, your account is safe, and you can safely ignore this email.
                    </p>
                    
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
                    
                    <div style="text-align: center; color: #9ca3af; font-size: 12px;">
                        <p style="margin: 0;">&copy; ${new Date().getFullYear()} iAudit Global. All rights reserved.</p>
                        <p style="margin: 4px 0 0 0;">This email was sent to ${email}. Please do not reply to this automated message.</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`OTP successfully sent to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed, but continuing for development/test:', emailError.message);
            if (emailError.message.includes('5.7.139')) {
                console.error('\n====================================================================');
                console.error('     🚨 CRITICAL: MICROSOFT 365 SECURITY BLOCK DETECTED 🚨');
                console.error('====================================================================');
                console.error('Exact Issue: Microsoft Office 365 has disabled Basic Authentication');
                console.error('             (SMTP AUTH) for the account "noreply@iaudit.global".');
                console.error('');
                console.error('HOW TO FIX THIS (Required Admin Action):');
                console.error('  1. Log in to admin.microsoft.com as a Global Administrator.');
                console.error('  2. Go to Users > Active users.');
                console.error('  3. Click on the user: noreply@iaudit.global');
                console.error('  4. Click the "Mail" tab on the right side window.');
                console.error('  5. Click "Manage email apps".');
                console.error('  6. Check the box for "Authenticated SMTP" and save changes.');
                console.error('  7. Wait 15-30 minutes for Microsoft to apply the policy.');
                console.error('====================================================================\n');
            }
            console.log(`Bypassed Email - OTP for ${email} is: ${otp}`);
        }
        res.status(200).json({ message: 'OTP sent successfully (Bypassed if email failed)' });

    } catch (error) {
        console.error(`--- SEND OTP FAILURE at step: ${step} ---`);
        console.error('Email:', email);
        console.error('Error message:', error.message);

        // Add specific hints for AWS/Production issues
        if (error.message.includes('ECONNREFUSED')) {
            console.error('HINT: Check if your DATABASE_URL is accessible from this server.');
        } else if (error.message.includes('Invalid login') || error.message.includes('EAUTH')) {
            console.error('HINT: Email authentication failed. Check your SMTP/Gmail credentials.');
        }

        res.status(500).json({
            error: `Failed during: ${step}`,
            message: error.message,
            code: error.code,
            step: step
        });
    }
};

app.post('/api/auth/send-otp', sendOtpLogic);
app.post('/api/auth/signup', sendOtpLogic);

app.post('/api/auth/verify-otp-and-signup', async (req, res) => {
    const { email, otp, firstName, lastName, mobile, password, role, customRoleName, isActive } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const storedData = await prisma.otp.findUnique({ where: { email } });

    if (!storedData) {
        return res.status(400).json({ error: 'No OTP requested for this email' });
    }

    if (new Date() > storedData.expiresAt) {
        await prisma.otp.delete({ where: { email } });
        return res.status(400).json({ error: 'OTP has expired' });
    }

    if (storedData.code !== otp) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }

    try {
        // OTP is valid! Create the user.
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                mobile,
                role: role || 'Admin',
                customRoleName,
                isActive: isActive !== undefined ? isActive : true,
                password: hashedPassword
            }
        });

        // Clean up OTP from database
        await prisma.otp.delete({ where: { email } });

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('Error creating user during OTP verification:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Use bcrypt to compare the provided password with the hashed password in DB
        let isPasswordMatch = false;
        try {
            isPasswordMatch = await bcrypt.compare(password, user.password);
        } catch (error) {
            isPasswordMatch = false;
        }

        if (!isPasswordMatch) {
            // Fallback: check plain text (for existing users not yet migrated to hashing)
            if (user.password === password) {
                // Migration: hash and save the password for future logins
                const hashedPassword = await bcrypt.hash(password, 10);
                await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
                isPasswordMatch = true;
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An error occurred during login' });
    }
});

// User routes
app.get('/api/users', async (req, res) => {
    const { creatorId } = req.query;
    try {
        const whereClause = creatorId ? { creatorId: parseInt(creatorId) } : {};
        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                mobile: true,
                role: true,
                customRoleName: true,
                isActive: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user status quickly
app.get('/api/users/:id/status', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                isActive: true
            }
        });

        if (!user) {
            return res.json({ exists: false, isActive: false });
        }

        res.json({ exists: true, isActive: user.isActive });
    } catch (error) {
        console.error('Failed to fetch user status:', error);
        res.status(500).json({ error: 'Failed to fetch user status' });
    }
});

app.post('/api/users', async (req, res) => {
    const { firstName, lastName, email, mobile, role, customRoleName, password, creatorId, sendWelcomeEmail } = req.body;
    try {
        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                mobile,
                role,
                customRoleName,
                isActive: req.body.isActive !== undefined ? req.body.isActive : true,
                password: await bcrypt.hash(password, 10),
                creatorId: creatorId ? parseInt(creatorId) : null
            }
        });

        // Send welcome email if requested — fire and forget, don't block the response
        if (sendWelcomeEmail) {
            const mailOptions = {
                from: smtpUser,
                to: email,
                subject: 'Welcome to iAudit Global!',
                html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #213847;">Welcome to iAudit Global, ${firstName} ${lastName}!</h2>
                            <p style="color: #4B5563;">Your account has been created successfully. Here are your login details:</p>
                            <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <p style="margin: 0; color: #111827;"><strong>Name:</strong> ${firstName} ${lastName}</p>
                                <p style="margin: 8px 0 0; color: #111827;"><strong>Email:</strong> ${email}</p>
                                <p style="margin: 8px 0 0; color: #111827;"><strong>Password:</strong> ${password}</p>
                            </div>
                            <p style="color: #4B5563;">You can log in to iAudit Global using your email address and password above.</p>
                            <p style="color: #4B5563;">If you have any questions, please contact your administrator.</p>
                            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                            <p style="color: #9CA3AF; font-size: 12px;">This is an automated message from iAudit Global. Please do not reply to this email.</p>
                        </div>
                    `
            };
            // Non-blocking: email sends in background, user creation returns immediately
            transporter.sendMail(mailOptions)
                .then(() => console.log(`Welcome email sent to ${email}`))
                .catch((emailError) => console.error('Failed to send welcome email:', emailError));
        }

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});


app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, mobile, role, customRoleName, isActive, password } = req.body;
    try {
        const updateData = {
            firstName,
            lastName,
            email,
            mobile,
            role,
            customRoleName,
            isActive
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Audit Program routes
app.get('/api/audit-programs', async (req, res) => {
    const { userId, full } = req.query;

    // SECURITY: Enforce strict userId filtering. Do not return all programs if userId is missing.
    if (!userId || userId === 'undefined' || userId === 'null') {
        return res.json([]);
    }

    try {
        const parsedUserId = parseInt(userId);
        console.log(`[DEBUG] Fetching audit programs for parsedUserId: ${parsedUserId}`);
        if (isNaN(parsedUserId)) {
            console.warn(`[DEBUG] parsedUserId is NaN for userId: ${userId}`);
            return res.json([]);
        }

        const programs = await prisma.auditProgram.findMany({
            where: {
                OR: [
                    { userId: parsedUserId },
                    { leadAuditorId: parsedUserId },
                    { auditors: { some: { id: parsedUserId } } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                isoStandard: true,
                frequency: true,
                duration: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                siteId: true,
                site: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                leadAuditor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                auditors: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                scheduleData: true
            }
        });
        console.log(`[DEBUG] Found ${programs.length} programs for user ${parsedUserId}`);
        if (programs.length > 0) {
            console.log(`[DEBUG] First program owners: userId=${programs[0].userId}, leadAuditorId=${programs[0].leadAuditorId}`);
            console.log(`[DEBUG] First program auditors:`, JSON.stringify(programs[0].auditors.map(a => a.id)));
        }
        // Map to include a simple boolean for UI and optionally strip full data to save bandwidth
        const optimizedPrograms = programs.map(p => {
            const isConfigured = p.scheduleData && typeof p.scheduleData === 'object' && Object.keys(p.scheduleData).length > 0;
            if (full === 'true') {
                return { ...p, isConfigured };
            }
            const { scheduleData: _, ...programWithoutData } = p;
            return {
                ...programWithoutData,
                isConfigured
            };
        });
        res.json(optimizedPrograms);
    } catch (error) {
        console.error('Failed to fetch audit programs:', error);
        res.status(500).json({ error: 'Failed to fetch audit programs' });
    }
});

// Get single Audit Program (Full Details)
app.get('/api/audit-programs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const program = await prisma.auditProgram.findUnique({
            where: { id: parseInt(id) },
            include: {
                site: true,
                auditors: true,
                leadAuditor: true
            }
        });
        if (!program) return res.status(404).json({ error: 'Audit program not found' });
        res.json(program);
    } catch (error) {
        console.error('Failed to fetch audit program details:', error);
        res.status(500).json({ error: 'Failed to fetch audit program details' });
    }
});

app.post('/api/audit-programs', async (req, res) => {
    const { name, isoStandard, frequency, duration, siteId, auditorIds, leadAuditorId, scheduleData, userId } = req.body;
    try {
        const program = await prisma.auditProgram.create({
            data: {
                name,
                isoStandard,
                frequency,
                duration: parseInt(duration),
                siteId: parseInt(siteId),
                auditors: {
                    connect: auditorIds.map(id => ({ id: parseInt(id) }))
                },
                leadAuditorId: leadAuditorId ? parseInt(leadAuditorId) : null,
                scheduleData: scheduleData || {},
                status: 'Draft',
                userId: userId ? parseInt(userId) : null
            },
            include: {
                site: true,
                auditors: true,
                leadAuditor: true
            }
        });
        res.status(201).json(program);
    } catch (error) {
        console.error('Error creating audit program:', error);
        res.status(500).json({ error: 'Failed to create audit program' });
    }
});

app.put('/api/audit-programs/:id', async (req, res) => {
    const { id } = req.params;
    const { name, isoStandard, frequency, duration, siteId, auditorIds, leadAuditorId, scheduleData, status } = req.body;
    try {
        // Disconnect all current auditors first before connecting new ones to ensure clean update
        await prisma.auditProgram.update({
            where: { id: parseInt(id) },
            data: {
                auditors: {
                    set: []
                }
            }
        });

        const program = await prisma.auditProgram.update({
            where: { id: parseInt(id) },
            data: {
                name,
                isoStandard,
                frequency,
                duration: parseInt(duration),
                siteId: parseInt(siteId),
                auditors: {
                    connect: auditorIds.map(aid => ({ id: parseInt(aid) }))
                },
                leadAuditorId: leadAuditorId ? parseInt(leadAuditorId) : null,
                scheduleData: scheduleData || {},
                status: status || 'Draft'
            },
            include: {
                site: true,
                auditors: true,
                leadAuditor: true
            }
        });
        res.json(program);
    } catch (error) {
        console.error('Error updating audit program:', error);
        res.status(500).json({ error: 'Failed to update audit program' });
    }
});

app.delete('/api/audit-programs/:id', async (req, res) => {
    const { id } = req.params;
    const programId = parseInt(id);
    try {
        await prisma.$transaction(async (tx) => {
            // Delete all associated audit plans first
            await tx.auditPlan.deleteMany({
                where: { auditProgramId: programId }
            });

            // Then delete the program
            await tx.auditProgram.delete({
                where: { id: programId }
            });
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting audit program:', error);
        res.status(500).json({ error: 'Failed to delete audit program' });
    }
});

// Audit Plan Routes

// Get all audit plans (optionally filter by programId)
app.get('/api/audit-plans', async (req, res) => {
    const { programId, userId } = req.query;
    try {
        const whereClause = {};
        if (programId) whereClause.auditProgramId = parseInt(programId);
        if (userId) {
            const uId = parseInt(userId);
            whereClause.OR = [
                { userId: uId },
                { leadAuditorId: uId },
                { auditors: { some: { id: uId } } }
            ];
        }
        const plans = await prisma.auditPlan.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                executionId: true,
                auditType: true,
                auditName: true,
                date: true,
                location: true,
                createdAt: true,
                updatedAt: true,
                templateId: true,
                auditProgramId: true,
                userId: true,
                // We fetch auditData only to calculate progress on server
                auditData: true,
                leadAuditor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                auditors: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                auditProgram: {
                    select: {
                        id: true,
                        name: true,
                        site: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Calculate progress on backend to reduce logic on frontend and keep it consistent
        const optimizedPlans = plans.map(plan => {
            let progress = 0;
            if (plan.auditData) {
                const data = typeof plan.auditData === 'string' ? JSON.parse(plan.auditData) : plan.auditData;
                progress = data.progress ?? 0;
            }

            const includeData = req.query.includeData === 'true';

            // Remove full auditData from the list response UNLESS includeData=true is passed
            if (!includeData) {
                const { auditData: _, ...planWithoutData } = plan;
                return {
                    ...planWithoutData,
                    progress
                };
            }

            return {
                ...plan,
                progress
            };
        });

        res.json(optimizedPlans);
    } catch (error) {
        console.error('Failed to fetch audit plans:', error);
        res.status(500).json({ error: 'Failed to fetch audit plans' });
    }
});

// Get single Audit Plan (Full Details)
app.get('/api/audit-plans/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const plan = await prisma.auditPlan.findUnique({
            where: { id: parseInt(id) },
            include: {
                leadAuditor: true,
                auditors: true,
                auditProgram: {
                    include: {
                        site: true
                    }
                }
            }
        });
        if (!plan) return res.status(404).json({ error: 'Audit plan not found' });
        res.json(plan);
    } catch (error) {
        console.error('Failed to fetch audit plan details:', error);
        res.status(500).json({ error: 'Failed to fetch audit plan details' });
    }
});

// Create Audit Plan
app.post('/api/audit-plans', async (req, res) => {
    const {
        auditProgramId, executionId, auditType, auditName, templateId, date, location,
        scope, objective, criteria,
        leadAuditorId, auditorIds, itinerary, userId
    } = req.body;

    if (!auditProgramId) {
        import('fs').then(fs => fs.appendFileSync('audit_debug.log', JSON.stringify({ error: "Missing auditProgramId", body: req.body }) + '\n'));
        return res.status(400).json({ error: 'Missing required field: auditProgramId' });
    }

    try {
        const plan = await prisma.auditPlan.create({
            data: {
                auditProgramId: parseInt(auditProgramId, 10),
                executionId,
                auditType,
                auditName,
                templateId,
                date: date ? new Date(date) : null,
                location,
                scope,
                objective,
                criteria,
                leadAuditorId: leadAuditorId ? parseInt(leadAuditorId) : null,
                auditors: {
                    connect: auditorIds ? auditorIds.map(id => ({ id: parseInt(id) })) : []
                },
                itinerary: itinerary || [],
                userId: userId ? parseInt(userId) : null
            }
        });
        res.status(201).json(plan);
    } catch (error) {
        console.error('Error saving audit plan:', error);
        import('fs').then(fs => fs.appendFileSync('audit_debug.log', JSON.stringify({ error: error.message, stack: error.stack, body: req.body }) + '\n'));
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'An audit plan for this program and execution already exists.' });
        }
        res.status(500).json({ error: 'Failed to save audit plan', details: error.message });
    }
});

// Update Audit Plan
app.put('/api/audit-plans/:id', async (req, res) => {
    const { id } = req.params;
    const {
        auditType, auditName, templateId, date, location,
        scope, objective, criteria,
        leadAuditorId, auditorIds, itinerary
    } = req.body;

    try {
        const updateData = {};
        if (auditType !== undefined) updateData.auditType = auditType;
        if (auditName !== undefined) updateData.auditName = auditName;
        if (templateId !== undefined) updateData.templateId = templateId;
        if (date !== undefined) updateData.date = date ? new Date(date) : null;
        if (location !== undefined) updateData.location = location;
        if (scope !== undefined) updateData.scope = scope;
        if (objective !== undefined) updateData.objective = objective;
        if (criteria !== undefined) updateData.criteria = criteria;
        if (leadAuditorId !== undefined) updateData.leadAuditorId = leadAuditorId ? parseInt(leadAuditorId) : null;
        if (auditorIds !== undefined) {
            updateData.auditors = {
                set: [],
                connect: auditorIds.map(aid => ({ id: parseInt(aid) }))
            };
        }
        if (itinerary !== undefined) updateData.itinerary = itinerary;
        if (req.body.auditData !== undefined) updateData.auditData = req.body.auditData;
        if (req.body.findingsData !== undefined) updateData.findingsData = req.body.findingsData;
        updateData.updatedAt = new Date();

        const plan = await prisma.auditPlan.update({
            where: { id: parseInt(id) },
            data: updateData
        });
        res.status(200).json(plan);
    } catch (error) {
        console.error('Error updating audit plan:', error);
        res.status(500).json({ error: 'Failed to update audit plan' });
    }
});

// Delete Audit Plan
app.delete('/api/audit-plans/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.auditPlan.delete({
            where: { id: parseInt(id) }
        });
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting audit plan:', error);
        res.status(500).json({ error: 'Failed to delete audit plan' });
    }
});


// Send Self Assessment Report by email
app.post('/api/send-assessment-report', async (req, res) => {
    const { to, companyName, auditorName, auditCompany, standard, score, date, questions } = req.body;

    if (!to || !companyName || !standard) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const total = questions?.length || 0;
        const yesCount = questions?.filter(q => q.answer === 'yes').length || 0;
        const noCount = questions?.filter(q => q.answer === 'no').length || 0;
        const percentage = total > 0 ? Math.round((yesCount / total) * 100) : 0;

        // Group questions by clause for detailed breakdown
        const clauseGroups = {};
        (questions || []).forEach(q => {
            if (!clauseGroups[q.clause]) clauseGroups[q.clause] = { yes: 0, no: 0, total: 0 };
            clauseGroups[q.clause].total++;
            if (q.answer === 'yes') clauseGroups[q.clause].yes++;
            else clauseGroups[q.clause].no++;
        });

        const clauseRows = Object.entries(clauseGroups).map(([clause, data]) => {
            const pct = Math.round((data.yes / data.total) * 100);
            const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
            return `<tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${clause}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:13px;">${data.yes} / ${data.total}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
                    <span style="color:${color};font-weight:600;font-size:13px;">${pct}%</span>
                </td>
            </tr>`;
        }).join('');

        const scoreColor = percentage >= 70 ? '#16a34a' : percentage >= 40 ? '#d97706' : '#dc2626';
        const stage = score >= 38 ? 'Mature Stage' : score >= 25 ? 'Moderate Stage' : 'Early Stage';

        const mailOptions = {
            from: 'subs.safetynett@gmail.com',
            to,
            subject: `Your ${standard} Self Assessment Report — ${companyName}`,
            html: `
            <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;">
                <!-- Header -->
                <div style="background:#213847;padding:28px 32px;border-radius:8px 8px 0 0;">
                    <h1 style="margin:0;color:#fff;font-size:22px;">Self Assessment Report</h1>
                    <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${standard}</p>
                </div>

                <!-- Details -->
                <div style="background:#fff;padding:28px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
                    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:160px;">Company</td><td style="padding:6px 0;font-size:13px;font-weight:600;">${companyName}</td></tr>
                        ${auditCompany ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Company Being Audited</td><td style="padding:6px 0;font-size:13px;font-weight:600;">${auditCompany}</td></tr>` : ''}
                        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Auditor</td><td style="padding:6px 0;font-size:13px;">${auditorName || '-'}</td></tr>
                        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Date</td><td style="padding:6px 0;font-size:13px;">${date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</td></tr>
                    </table>

                    <!-- Score Banner -->
                    <div style="background:#f1f5f9;border-radius:8px;padding:20px 24px;text-align:center;margin-bottom:24px;">
                        <p style="margin:0 0 4px;color:#64748b;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Overall Score</p>
                        <span style="font-size:42px;font-weight:700;color:${scoreColor};">${score} <span style="font-size:22px;color:#94a3b8;">/ 50</span></span>
                        <p style="margin:8px 0 0;color:#475569;font-size:14px;">Maturity Stage: <strong>${stage}</strong></p>
                        <p style="margin:4px 0 0;color:#475569;font-size:13px;">${yesCount} Yes &nbsp;·&nbsp; ${noCount} No &nbsp;·&nbsp; ${total} Total Questions</p>
                    </div>

                    <!-- Clause Breakdown -->
                    <h3 style="margin:0 0 12px;font-size:15px;color:#1e293b;">Score by Clause</h3>
                    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
                        <thead>
                            <tr style="background:#213847;">
                                <th style="padding:10px 12px;text-align:left;color:#fff;font-size:13px;">Clause</th>
                                <th style="padding:10px 12px;text-align:center;color:#fff;font-size:13px;">Compliance</th>
                                <th style="padding:10px 12px;text-align:center;color:#fff;font-size:13px;">Score</th>
                            </tr>
                        </thead>
                        <tbody>${clauseRows}</tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none;text-align:center;">
                    <p style="margin:0;color:#94a3b8;font-size:12px;">This report was generated by AuditMate. For questions, contact your administrator.</p>
                </div>
            </div>`
        };

        // Attach PDF if provided
        if (req.body.pdfBase64) {
            mailOptions.attachments = [{
                filename: `Self_Assessment_${companyName.replace(/\s+/g, '_')}_Report.pdf`,
                content: Buffer.from(req.body.pdfBase64, 'base64'),
                contentType: 'application/pdf'
            }];
        }

        // Fire and forget so response is returned immediately
        transporter.sendMail(mailOptions)
            .then(() => console.log(`Assessment report sent to ${to}`))
            .catch(err => console.error('Failed to send assessment report email:', err));

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending assessment report:', error);
        res.status(500).json({ error: 'Failed to send report' });
    }
});

// Feedback API
app.post('/api/feedback', async (req, res) => {
    const { name, email, feedback, image } = req.body;

    if (!name || !email || !feedback) {
        return res.status(400).json({ error: 'Name, email, and feedback are required' });
    }

    try {
        const mailOptions = {
            from: 'subs.safetynett@gmail.com',
            to: 'Mathew@iaudit.global',
            cc: 'jasmin@iaudit.global',
            subject: `[Feedback] From ${name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background: #213847; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">New User Feedback</h2>
                    </div>
                    <div style="padding: 24px;">
                        <p style="margin-bottom: 20px; font-size: 16px; color: #475569;">You have received a new feedback submission from a user.</p>
                        
                        <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase;">Name</p>
                            <p style="margin: 0 0 16px; font-weight: 600; color: #1e293b;">${name}</p>
                            
                            <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase;">Email</p>
                            <p style="margin: 0 0 16px; font-weight: 600; color: #1e293b;">${email}</p>
                            
                            <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase;">Feedback</p>
                            <p style="margin: 0; color: #334155; line-height: 1.6;">${feedback}</p>
                        </div>
                        
                        ${image ? '<p style="color: #64748b; font-size: 13px;"><em>An image attachment is included below.</em></p>' : ''}
                    </div>
                    <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #94a3b8;">
                        This email was sent automatically from iAudit Global Feedback system.
                    </div>
                </div>
            `
        };

        if (image) {
            const base64Data = image.split(';base64,').pop();
            const extension = image.split(';')[0].split('/')[1] || 'png';

            mailOptions.attachments = [{
                filename: `feedback_image.${extension}`,
                content: base64Data,
                encoding: 'base64'
            }];
        }

        await transporter.sendMail(mailOptions);
        console.log(`Feedback email sent from ${email}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending feedback email:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    try {
        await prisma.$connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
});
