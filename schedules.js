const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const { PrismaClient } = require('@prisma/client');

const deletePreviousLog = async () => {
    const offset = new Date().getTimezoneOffset();
    const file_delete_start_from = new Date(new Date().getTime() - (offset * 60 * 1000));
    const logDir = import.meta.env.VITE_ROOT_DIRECTORY + "/logs/" + file_delete_start_from.getFullYear();
    /**
     * Add number of days for keeping log data
    * If we want to keep last 3 month data then add 90 days only and before 90 days  data will be removed
    */
    const store_days = 90;

    file_delete_start_from.setDate(file_delete_start_from.getDate() - store_days);

    const year = file_delete_start_from.getFullYear();
    const month = file_delete_start_from.getMonth();
    const day = file_delete_start_from.getDate();

    const file_delete_start_from_date = new Date(year, month, day).toLocaleDateString();

    const year_directories = fs.readdirSync(logDir);
    // If year directories does not have any subfolder then it will be removed from logs
    if (year_directories.length == 0) {
        fs.rm(logDir, { recursive: true }, (error) => {
            if (error) {
                throw new Error(error)
            }
        })
    }

    // In year derectories find out monthly subfolder 
    year_directories.forEach((month_directory) => {
        // Make month directory 
        const month_path = path.join(logDir, month_directory);
        const month_files = fs.readdirSync(month_path);

        // If month directories does not have any subfolder then it will be removed from year directory
        if (month_files.length == 0) {
            fs.rm(month_path, { recursive: true }, (error) => {
                if (error) {
                    throw new Error(error)
                }
            })
        }

        month_files.forEach((day_directory) => {
            // Make day directory
            const delete_path = path.join(month_path, day_directory);
            const delete_path_date = delete_path.split('/').map((Number));

            /**
             * Find out year, month and day from "delete_path_date" array
             * "/var/www/shopify-app/discountray-dev/logs/2024/1/10" this is "delete_path" format
             * After split date number index is (9-1) = 8 similarly month index is (9-2) = 7 and year indx is (9-3) = 6
             */
            const remove_date = delete_path_date[delete_path_date.length - 1];
            const remove_month = delete_path_date[delete_path_date.length - 2];
            const remove_year = delete_path_date[delete_path_date.length - 3];

            // Convert directory to the date format
            const delete_directory_date = new Date(remove_year, remove_month - 1, remove_date).toLocaleDateString();

            if (delete_directory_date < file_delete_start_from_date) {
                fs.rm(delete_path, { recursive: true }, (error) => {
                    if (error) {
                        throw new Error(error)
                    }
                })
            }

        })

    })
}

function compareDates(referenceTimeStr) {
    // Parse the reference time string into a Date object
    const referenceTime = new Date(referenceTimeStr);

    // Get the current date and time
    const currentDate = new Date();

    // Compare the Date objects
    if (currentDate > referenceTime) {
        return "after";
    } else if (currentDate < referenceTime) {
        return "before";
    } else {
        return "same";
    }
}

async function adjustStatus() {
    const prisma = new PrismaClient();

    const discounts = await prisma.discounts.findMany()
    discounts.map(async discount => {
        const startsAtStatus = compareDates(discount.startsAt)
        if (discount.status != "EXPIRED" && discount.endsAt == null) {
            if (startsAtStatus == 'before') {
                await prisma.discounts.update(
                    {
                        where: {
                            discountId: discount.discountId
                        },
                        data: { status: 'SCHEDULED' },
                    }
                )
            } else if (startsAtStatus == 'after') {
                await prisma.discounts.update(
                    {
                        where: {
                            discountId: discount.discountId
                        },
                        data: { status: 'ACTIVE' }
                    }
                )
            }
        } else if (discount.status != "EXPIRED" && discount.endsAt) {
            const endsAtStatus = compareDates(discount.endsAt)
            if (endsAtStatus == 'before' && startsAtStatus == 'after') {
                await prisma.discounts.update(
                    {
                        where: {
                            discountId: discount.discountId
                        },
                        data: { status: 'ACTIVE' }
                    }
                )
            } else if (endsAtStatus == 'after' && startsAtStatus == 'after') {
                await prisma.discounts.update(
                    {
                        where: {
                            discountId: discount.discountId
                        },
                        data: { status: 'EXPIRED' }
                    }
                )
            }
            else if (endsAtStatus == 'before' && startsAtStatus == 'before') {
                await prisma.discounts.update(
                    {
                        where: {
                            discountId: discount.discountId
                        },
                        data: { status: 'SCHEDULED' }
                    }
                )
            }
        }
    })
}

// Run at everyday 12:05 AM
schedule.scheduleJob('0 5 0 * * *', function () {
    deletePreviousLog();
});
// Run at every minute
schedule.scheduleJob('* * * * *', function () {
    adjustStatus();
});
