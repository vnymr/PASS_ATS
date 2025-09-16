#!/usr/bin/env node

/**
 * Reset password for a user
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'i.vinaymr@gmail.com';
  const newPassword = 'D@dl0ve0';

  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const user = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    console.log('✅ Password reset successfully for:', email);
    console.log('User ID:', user.id);
    console.log('\nYou can now login with:');
    console.log('Email:', email);
    console.log('Password:', newPassword);

  } catch (error) {
    if (error.code === 'P2025') {
      console.log('❌ User not found:', email);
      console.log('\nCreating new user...');

      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const newUser = await prisma.user.create({
          data: {
            email,
            password: hashedPassword
          }
        });

        console.log('✅ User created successfully!');
        console.log('User ID:', newUser.id);
      } catch (createError) {
        console.error('❌ Error creating user:', createError.message);
      }
    } else {
      console.error('❌ Error resetting password:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword().catch(console.error);