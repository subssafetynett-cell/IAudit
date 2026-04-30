import prisma from '../src/prisma.js';

async function main() {
  const customerIdToClear = 'cus_UQjfNGxgSZP0lf';
  
  const users = await prisma.user.findMany({
    where: { stripeCustomerId: customerIdToClear }
  });

  console.log(`Found ${users.length} users with customer ID ${customerIdToClear}`);

  for (const user of users) {
    // Delete related test subscriptions
    await prisma.subscription.deleteMany({
      where: { userId: user.id }
    });
    
    // Delete related test payments
    await prisma.payment.deleteMany({
      where: { userId: user.id }
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        stripeInvoiceId: null,
        stripePaymentIntentId: null,
        subscriptionStatus: null,
        subscriptionPlan: null,
        planStartDate: null,
        planExpiryDate: null,
        nextBillingDate: null
      }
    });
    console.log(`Cleared Stripe data for user ID: ${user.id} (${user.email})`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // await prisma.$disconnect(); 
    // Prisma via pg pool might not use $disconnect correctly, so process.exit is fine.
    process.exit(0);
  });
