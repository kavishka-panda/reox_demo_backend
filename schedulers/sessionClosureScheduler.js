const cron = require('node-cron');
const prisma = require('../config/prismaClient');
const db = require('../services/dbWrapper');

/**
 * Auto-close all open cash sessions at 11:59:59 PM Sri Lankan time (UTC+5:30)
 * Cron expression: '59 59 23 * * *' means at 23:59:59 every day
 */
const scheduleSessionClosure = () => {
    // Schedule task to run at 11:59:59 PM every day (Sri Lankan time - server is already in IST/SLT)
    const task = cron.schedule('59 59 23 * * *', async () => {
        try {
            console.log('\n⏰ Auto-closing cash sessions at 11:59:59 PM...');
            
            // Find all open sessions (status_id = 1)
            const openSessions = await prisma.cash_sessions.findMany({
                where: {
                    cash_status_id: 1
                },
                include: {
                    user: {
                        select: {
                            name: true
                        }
                    },
                    cashier_counters: {
                        select: {
                            cashier_counter: true
                        }
                    }
                }
            });

            if (openSessions.length === 0) {
                console.log('✅ No open sessions to close');
                return;
            }

            console.log(`📋 Found ${openSessions.length} open session(s) to close`);

            // Close all open sessions via outbox-safe writes.
            for (const session of openSessions) {
                await db.cash_sessions.update({
                    where: { id: session.id },
                    data: { cash_status_id: 2 }
                });
            }

            console.log(`✅ Successfully closed ${openSessions.length} cash session(s)`);
            
            // Log details of closed sessions
            openSessions.forEach((session, index) => {
                console.log(`   ${index + 1}. Session #${session.id} - ${session.user.name} at ${session.cashier_counters.cashier_counter}`);
            });

        } catch (error) {
            console.error('❌ Error auto-closing cash sessions:', error);
        }
    }, {
        scheduled: false,
        timezone: 'Asia/Colombo' // Sri Lankan timezone
    });

    // Start the scheduled task
    task.start();
    
    console.log('📅 Session auto-close scheduler initialized - Daily at 11:59:59 PM (Sri Lankan Time)');
    
    return task;
};

module.exports = { scheduleSessionClosure };
