import prisma from './src/prisma.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

async function diagnose() {
    console.log('--- BACKEND DIAGNOSTIC START ---');
    console.log('Time:', new Date().toISOString());
    console.log('Environment:', process.env.NODE_ENV || 'not set');

    // 1. Check Database connection
    console.log('\n1. Testing Database Connection...');
    try {
        await prisma.$connect();
        console.log('✅ Prisma connected to database.');

        // Test a simple query
        const userCount = await prisma.user.count();
        console.log(`✅ Database query successful. Total users: ${userCount}`);

        // Test Otp table access
        console.log('Testing Otp table access...');
        await prisma.otp.findFirst();
        console.log('✅ Otp table is accessible.');
    } catch (dbError) {
        console.error('❌ Database connection/query failed:');
        console.error(dbError);
        console.log('\n--- RDS TROUBLESHOOTING TIPS ---');
        console.log('1. Ensure your DATABASE_URL in server/.env is correctly formatted:');
        console.log('   postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/DB_NAME?schema=public');
        console.log('2. PORT 5432: Check your RDS Security Group Inbound rules.');
        console.log('   You MUST allow Port 5432 from your EC2 instance private IP or "0.0.0.0/0" (for testing).');
        console.log('3. PRISMA CLIENT: If you see "Incompatible engine", run:');
        console.log('   npx prisma generate');
        console.log('\nCurrent DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');
    }

    // 2. Check Email service
    console.log('\n2. Testing Email Service (Nodemailer)...');
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'subs.safetynett@gmail.com',
                pass: 'wdve zudb tzwf spyo'
            }
        });

        await transporter.verify();
        console.log('✅ Nodemailer transporter is ready.');
    } catch (emailError) {
        console.error('❌ Email service verification failed:');
        console.error(emailError);
        console.log('\nTIP: Ensure Gmail "App Password" is still valid and not blocked by AWS Security Groups.');
    }

    console.log('\n--- DIAGNOSTIC COMPLETE ---');
    process.exit();
}

diagnose();
