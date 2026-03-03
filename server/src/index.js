import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import prisma from './prisma.js';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['https://apps.iaudit.global', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'], // Allow production and local development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
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

const router = express.Router();

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'subs.safetynett@gmail.com',
        pass: 'wdve zudb tzwf spyo'
    },
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

// Example route to get all companies (including sites and departments)
app.get('/api/companies', async (req, res) => {
    const { userId } = req.query;
    try {
        const parsedUserId = userId ? parseInt(userId) : null;
        const whereClause = parsedUserId ? { userId: parsedUserId } : {};
        const companies = await prisma.company.findMany({
            where: whereClause,
            include: {
                sites: {
                    where: parsedUserId ? { userId: parsedUserId } : {},
                    include: {
                        departments: true
                    }
                }
            }
        });
        res.json(companies);
    } catch (error) {
        console.error('Failed to fetch companies:', error);
        res.status(500).json({ error: 'Failed to fetch companies' });
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
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
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
        res.status(500).json({ error: 'Failed to create site' });
    }
});

// Get all sites (with optional user filtering)
app.get('/api/sites', async (req, res) => {
    const { userId } = req.query;
    try {
        const whereClause = userId ? { userId: parseInt(userId) } : {};
        const sites = await prisma.site.findMany({
            where: whereClause,
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
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
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
                userId: userId ? parseInt(userId) : null
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
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

        // Store OTP in database
        await prisma.otp.upsert({
            where: { email },
            update: { code: otp, expiresAt },
            create: { email, code: otp, expiresAt }
        });

        step = 'Send Email';
        const mailOptions = {
            from: 'subs.safetynett@gmail.com',
            to: email,
            subject: 'Your AuditMate Verification Code',
            text: `Your verification code is: ${otp}. This code will expire in 5 minutes.`
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`OTP successfully sent to ${email}`);
        } catch (emailError) {
            console.error('Email sending failed, but continuing for development/test:', emailError.message);
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
                role: role || 'User',
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
                from: 'subs.safetynett@gmail.com',
                to: email,
                subject: 'Welcome to AuditMate!',
                html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                            <h2 style="color: #213847;">Welcome to AuditMate, ${firstName} ${lastName}!</h2>
                            <p style="color: #4B5563;">Your account has been created successfully. Here are your login details:</p>
                            <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                                <p style="margin: 0; color: #111827;"><strong>Name:</strong> ${firstName} ${lastName}</p>
                                <p style="margin: 8px 0 0; color: #111827;"><strong>Email:</strong> ${email}</p>
                                <p style="margin: 8px 0 0; color: #111827;"><strong>Password:</strong> ${password}</p>
                            </div>
                            <p style="color: #4B5563;">You can log in to AuditMate using your email address and password above.</p>
                            <p style="color: #4B5563;">If you have any questions, please contact your administrator.</p>
                            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                            <p style="color: #9CA3AF; font-size: 12px;">This is an automated message from AuditMate. Please do not reply to this email.</p>
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
    const { userId } = req.query;
    try {
        const whereClause = userId ? { userId: parseInt(userId) } : {};
        const programs = await prisma.auditProgram.findMany({
            where: whereClause,
            include: {
                site: true,
                auditors: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                leadAuditor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            }
        });
        res.json(programs);
    } catch (error) {
        console.error('Failed to fetch audit programs:', error);
        res.status(500).json({ error: 'Failed to fetch audit programs' });
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
    try {
        await prisma.auditProgram.delete({
            where: { id: parseInt(id) }
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
        if (userId) whereClause.userId = parseInt(userId);
        const plans = await prisma.auditPlan.findMany({
            where: whereClause,
            include: {
                leadAuditor: true,
                auditors: true,
                auditProgram: {
                    include: {
                        site: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(plans);
    } catch (error) {
        console.error('Failed to fetch audit plans:', error);
        res.status(500).json({ error: 'Failed to fetch audit plans' });
    }
});

// Create Audit Plan
app.post('/api/audit-plans', async (req, res) => {
    const {
        auditProgramId, executionId, auditType, auditName, templateId, date, location,
        scope, objective, criteria,
        leadAuditorId, auditorIds, itinerary, userId
    } = req.body;

    try {
        const plan = await prisma.auditPlan.create({
            data: {
                auditProgramId: parseInt(auditProgramId),
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
        res.status(500).json({ error: 'Failed to save audit plan' });
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


app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    try {
        await prisma.$connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection failed:', error.message);
    }
});
