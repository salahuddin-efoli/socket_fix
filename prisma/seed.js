import { PrismaClient } from "@prisma/client";

const prisma = global.prisma || new PrismaClient();

async function main() {
    await prisma.plans.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            title: "Starter",
            monthlyPrice: 0.000,
            annualPrice: 0.000,
            monthlyFeatures: '{"target":"FOR INDIVIDUALS & SMALL BUSINESSES","description":"Perfect for startups and small businesses looking to explore the basics with no cost. Access essential features to get started.","freeText":"You can try this for Free for the first 5 days!","features":["Basic analytics dashboard","Limited product listings","Community support","Basic automation tools"]}',
            annualFeatures: null,
            commonFeatures: '[{"label":"Pay Monthly","value":"Free"},{"label":"Pay Yearly","value":"-"},{"label":"Basic analytics dashboard","value":"Yes"},{"label":"Advanced analytics dashboard","value":"No"},{"label":"Unlimited product listings","value":"No"},{"label":"Community support","value":"Yes"},{"label":"Priority support","value":"No"},{"label":"24/7 dedicated support","value":"No"},{"label":"Customizable templates","value":"No"},{"label":"Premium customizable templates","value":"No"},{"label":"Automated workflows","value":"No"},{"label":"Advanced marketing tools","value":"No"}]',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
        }
    });
    await prisma.plans.upsert({
        where: { id: 2 },
        update: {},
        create: {
            id: 2,
            title: "Standard",
            monthlyPrice: 9.000,
            annualPrice: 99.000,
            monthlyFeatures: '{"target":"FOR INDIVIDUALS & SMALL BUSINESSES","description":"Upgrade to unlock advanced features for growing businesses. Enjoy more customization and support.","freeText":"You can try this for Free for the first 5 days!","features":["Advanced analytics dashboard","Unlimited product listings","Priority support","Customizable templates","Automated discount codes","Email marketing tools"]}',
            annualFeatures: '{"target":"FOR INDIVIDUALS & SMALL BUSINESSES","description":"Save money with our yearly plan while accessing all Standard Plan features. Ideal for businesses with long-term growth in mind.","freeText":"You can try this for Free for the first 5 days!","features":["All monthly features included","2 months free compared to monthly plan","Annual strategy consultation","Exclusive yearly discounts on services"]}',
            commonFeatures: '[{"label":"Pay Monthly","value":"$9"},{"label":"Pay Yearly","value":"$99"},{"label":"Basic analytics dashboard","value":"Yes"},{"label":"Advanced analytics dashboard","value":"Yes"},{"label":"Unlimited product listings","value":"Yes"},{"label":"Community support","value":"No"},{"label":"Priority support","value":"Yes"},{"label":"24/7 dedicated support","value":"No"},{"label":"Customizable templates","value":"Yes"},{"label":"Premium customizable templates","value":"No"},{"label":"Automated workflows","value":"Yes"},{"label":"Advanced marketing tools","value":"Yes"}]',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
        }
    });
    await prisma.plans.upsert({
        where: { id: 3 },
        update: {},
        create: {
            id: 3,
            title: "Professional",
            monthlyPrice: 15.000,
            annualPrice: 149.000,
            monthlyFeatures: '{"target":"FOR LARGE BUSINESSES","description":"Designed for large businesses needing robust features. Manage large-scale operations with ease.","freeText":"You can try this for Free for the first 5 days!","features":["Advanced analytics with AI insights","Unlimited product listings","24/7 dedicated support","Premium customizable templates","Automated workflows","Advanced marketing tools"]}',
            annualFeatures: '{"target":"FOR LARGE BUSINESSES","description":"Maximize savings with the yearly plan while benefiting from all Professional Plan features. Best suited for businesses scaling up operations.","freeText":"You can try this for Free for the first 5 days!","features":["All monthly features included","2 months free compared to monthly plan","Annual performance review and optimization","Access to exclusive yearly events and training"]}',
            commonFeatures: '[{"label":"Pay Monthly","value":"$15"},{"label":"Pay Yearly","value":"$149"},{"label":"Basic analytics dashboard","value":"Yes"},{"label":"Advanced analytics dashboard","value":"Yes"},{"label":"Unlimited product listings","value":"Yes"},{"label":"Community support","value":"No"},{"label":"Priority support","value":"No"},{"label":"24/7 dedicated support","value":"Yes"},{"label":"Customizable templates","value":"Yes"},{"label":"Premium customizable templates","value":"Yes"},{"label":"Automated workflows","value":"Yes"},{"label":"Advanced marketing tools","value":"Yes"}]',
            createdAt: new Date(),
            updatedAt: null,
            deletedAt: null,
        }
    });

    // Insert access controll permissions if not exists
    await prisma.permissions.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            code: 'BNNR_CRT',
            name: 'Banner Create',
            description: 'Create a banner for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
            updatedAt: new Date('2024-08-20 09:41:29.252')
        }
    });
    await prisma.permissions.upsert({
        where: { id: 2 },
        update: {},
        create: {
            id: 2,
            code: 'BNNR_LST',
            name: 'Banner List',
            description: 'View the list of banners',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 3 },
        update: {},
        create: {
            id: 3,
            code: 'BNNR_EDT',
            name: 'Banner Edit',
            description: 'Edit an existing banner',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 4 },
        update: {},
        create: {
            id: 4,
            code: 'BNNR_DLT',
            name: 'Banner Delete',
            description: 'Delete an existing banner',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
            updatedAt: new Date('2024-08-20 09:42:15.887')
        }
    });
    await prisma.permissions.upsert({
        where: { id: 5 },
        update: {},
        create: {
            id: 5,
            code: 'RAPP_CRT',
            name: 'Recommended Apps Create',
            description: 'Create a recommended app entry for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 6 },
        update: {},
        create: {
            id: 6,
            code: 'RAPP_LST',
            name: 'Recommended Apps List',
            description: 'View the list of recommended apps',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 7 },
        update: {},
        create: {
            id: 7,
            code: 'RAPP_EDT',
            name: 'Recommended Apps Edit',
            description: 'Edit a recommended app entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 8 },
        update: {},
        create: {
            id: 8,
            code: 'RAPP_DLT',
            name: 'Recommended Apps Delete',
            description: 'Delete a recommended app entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
            updatedAt: null
        }
    });
    await prisma.permissions.upsert({
        where: { id: 9 },
        update: {},
        create: {
            id: 9,
            code: 'ART_CRT',
            name: 'Article Create',
            description: 'Create an article for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 10 },
        update: {},
        create: {
            id: 10,
            code: 'ART_LST',
            name: 'Article List',
            description: 'View the list of articles',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 11 },
        update: {},
        create: {
            id: 11,
            code: 'ART_EDT',
            name: 'Article Edit',
            description: 'Edit an existing article',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 12 },
        update: {},
        create: {
            id: 12,
            code: 'ART_DLT',
            name: 'Article Delete',
            description: 'Delete an existing article',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 13 },
        update: {},
        create: {
            id: 13,
            code: 'YTVD_CRT',
            name: 'YouTube Video Create',
            description: 'Create a YouTube video entry for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 14 },
        update: {},
        create: {
            id: 14,
            code: 'YTVD_LST',
            name: 'YouTube Video List',
            description: 'View the list of YouTube videos',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 15 },
        update: {},
        create: {
            id: 15,
            code: 'YTVD_EDT',
            name: 'YouTube Video Edit',
            description: 'Edit a YouTube video entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 16 },
        update: {},
        create: {
            id: 16,
            code: 'YTVD_DLT',
            name: 'YouTube Video Delete',
            description: 'Delete a YouTube video entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 17 },
        update: {},
        create: {
            id: 17,
            code: 'FAQ_CRT',
            name: 'FAQ Create',
            description: 'Create an FAQ entry for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 18 },
        update: {},
        create: {
            id: 18,
            code: 'FAQ_LST',
            name: 'FAQ List',
            description: 'View the list of FAQs',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 19 },
        update: {},
        create: {
            id: 19,
            code: 'FAQ_EDT',
            name: 'FAQ Edit',
            description: 'Edit an FAQ entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 20 },
        update: {},
        create: {
            id: 20,
            code: 'FAQ_DLT',
            name: 'FAQ Delete',
            description: 'Delete an FAQ entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 21 },
        update: {},
        create: {
            id: 21,
            code: 'FRQ_CRT',
            name: 'Feature Request Create',
            description: 'Create a feature request for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 22 },
        update: {},
        create: {
            id: 22,
            code: 'FRQ_LST',
            name: 'Feature Request List',
            description: 'View the list of feature requests',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 23 },
        update: {},
        create: {
            id: 23,
            code: 'FRQ_EDT',
            name: 'Feature Request Edit',
            description: 'Edit a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 24 },
        update: {},
        create: {
            id: 24,
            code: 'FRQ_DLT',
            name: 'Feature Request Delete',
            description: 'Delete a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 25 },
        update: {},
        create: {
            id: 25,
            code: 'FRQ_RST',
            name: 'Feature Request Restore',
            description: 'Restore a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 17 },
        update: {},
        create: {
            id: 17,
            code: 'FAQ_CRT',
            name: 'FAQ Create',
            description: 'Create an FAQ entry for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 18 },
        update: {},
        create: {
            id: 18,
            code: 'FAQ_LST',
            name: 'FAQ List',
            description: 'View the list of FAQs',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 19 },
        update: {},
        create: {
            id: 19,
            code: 'FAQ_EDT',
            name: 'FAQ Edit',
            description: 'Edit an FAQ entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 20 },
        update: {},
        create: {
            id: 20,
            code: 'FAQ_DLT',
            name: 'FAQ Delete',
            description: 'Delete an FAQ entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 21 },
        update: {},
        create: {
            id: 21,
            code: 'FRQ_CRT',
            name: 'Feature Request Create',
            description: 'Create a feature request for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 22 },
        update: {},
        create: {
            id: 22,
            code: 'FRQ_LST',
            name: 'Feature Request List',
            description: 'View the list of feature requests',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 23 },
        update: {},
        create: {
            id: 23,
            code: 'FRQ_EDT',
            name: 'Feature Request Edit',
            description: 'Edit a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 24 },
        update: {},
        create: {
            id: 24,
            code: 'FRQ_DLT',
            name: 'Feature Request Delete',
            description: 'Delete a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 25 },
        update: {},
        create: {
            id: 25,
            code: 'FRQ_RST',
            name: 'Feature Request Restore',
            description: 'Restore a feature request entry',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 26 },
        update: {},
        create: {
            id: 26,
            code: 'AGT_CRT',
            name: 'Agent Create',
            description: 'Create an agent for the dashboard',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 27 },
        update: {},
        create: {
            id: 27,
            code: 'AGT_LST',
            name: 'Agent List',
            description: 'View the list of agents',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 28 },
        update: {},
        create: {
            id: 28,
            code: 'AGT_EDT',
            name: 'Agent Edit',
            description: "Edit an agent's details",
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 29 },
        update: {},
        create: {
            id: 29,
            code: 'AGT_DLT',
            name: 'Agent Delete',
            description: 'Delete an agent from the system',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 30 },
        update: {},
        create: {
            id: 30,
            code: 'TCKT_CRT',
            name: 'Ticket Create',
            description: 'Create a ticket for customer support',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 31 },
        update: {},
        create: {
            id: 31,
            code: 'TCKT_LST',
            name: 'Ticket List',
            description: 'View the list of support tickets',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 32 },
        update: {},
        create: {
            id: 32,
            code: 'TCKT_LST_ALL',
            name: 'Ticket List of All Agents',
            description: 'View the list of support tickets from all tickets',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 33 },
        update: {},
        create: {
            id: 33,
            code: 'TCKT_RCV',
            name: 'Ticket Receive From Merchant',
            description: 'Receive support tickets from merchants',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 34 },
        update: {},
        create: {
            id: 34,
            code: 'TCKT_EDT',
            name: 'Ticket Edit',
            description: 'Edit a support ticket',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 35 },
        update: {},
        create: {
            id: 35,
            code: 'TCKT_EDT_STTS',
            name: 'Ticket Edit Status',
            description: 'Edit a support ticket status',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 36 },
        update: {},
        create: {
            id: 36,
            code: 'TCKT_FWRD',
            name: 'Ticket Forward',
            description: 'Forward a support ticket to another agent',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 37 },
        update: {},
        create: {
            id: 37,
            code: 'TCKT_RPL_DSUB',
            name: 'Ticket Reply Direct Submission',
            description: 'Submit replies directly to merchant on a support ticket',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 38 },
        update: {},
        create: {
            id: 38,
            code: 'TCKT_RPL_DLT',
            name: 'Ticket Reply Delete',
            description: 'Delete replies of a support ticket',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        }
    });
    await prisma.permissions.upsert({
        where: { id: 39 },
        update: {},
        create: {
            id: 39,
            code: 'PRMSN_CRT',
            name: 'Permission Create',
            description: 'Create a permission for customer support',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:23:41.439'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 40 },
        update: {},
        create: {
            id: 40,
            code: 'PRMSN_LST',
            name: 'Permission List',
            description: 'View the list of support permissions',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:32.503'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 41 },
        update: {},
        create: {
            id: 41,
            code: 'PRMSN_EDT',
            name: 'Permission Edit',
            description: 'Edit a support permission',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:28:59.011'),
        },
    });
    await prisma.permissions.upsert({
        where: { id: 42 },
        update: {},
        create: {
            id: 42,
            code: 'PRMSN_DLT',
            name: 'Permission Delete',
            description: 'Delete a support permission',
            status: 'ACTIVE',
            createdAt: new Date('2024-08-20 09:29:16.104'),
        },
    });
}
main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		await prisma.$disconnect();
		process.exit(1);
	});
