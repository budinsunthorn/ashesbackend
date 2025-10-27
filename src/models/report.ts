import { OrderMjType, OrderStatus, PackageStatus } from "@prisma/client";
import { truncateToTwoDecimals, timezoneMap, formatHour } from "../context";
import { NotifyType } from "../generated/graphql";
import * as userModel from '../models/user'

export const getPrintSettingByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.printSetting.findMany({
        where: { dispensaryId: dispensaryId || undefined },
    })
}

export const getExitLabelByOrderId = async (context, orderId) => {
    const order = await context.prisma.order.findUnique({
        where: { id: orderId || undefined },
        include: {
            OrderItem: {
                include: {
                    package: {
                        select: {
                            packageId: true,
                            itemName: true,
                            itemUnitWeight: true,
                            itemUnitWeightUnitOfMeasureName: true,
                            UnitOfMeasureName: true,
                            ItemFromFacilityLicenseNumber: true,
                            ItemFromFacilityName: true,
                            LabTestingStateDate: true
                        },
                    }
                }
            },
            customer: {
                select: {
                    medicalLicense: true
                }
            },
            dispensary: true,
        }
    })
    return order
}
export const getExitLabelByPackageLabel = async (context, args) => {
    const packageData = await context.prisma.package.findUnique({
        where: { packageLabel: args.packageLabel },
        select: {
            packageId: true,
            itemName: true,
            itemUnitWeight: true,
            itemUnitWeightUnitOfMeasureName: true,
            UnitOfMeasureName: true,
            ItemFromFacilityLicenseNumber: true,
            ItemFromFacilityName: true,
            LabTestingStateDate: true
        },
    })
    return packageData
}

export const getReceiptByOrderId = async (context, orderId) => {
    const order = await context.prisma.order.findUnique({
        where: { id: orderId || undefined },
        include: {
            OrderItem: {
                orderBy: {
                    id: 'asc' // or 'desc' for descending order
                },
                include: {
                    product: {
                        include: {
                            itemCategory: true
                        }
                    },
                    TaxHistory: true,
                    package: true
                }
            },
            customer: true,
            dispensary: true,
            drawer: true,
            user: true,
            DiscountHistory: true,
            LoyaltyHistory: true,
        }
    })
    // console.log("order>>>>>", order)
    const tax = await context.prisma.taxHistory.aggregate({
        _sum: {
            taxAmount: true,
        },
        where: {
            orderId: orderId,
        },
    });

    return {
        order: order,
        tax: tax._sum.taxAmount || 0,
    }
}

export const getSalesMoneyReport = async (context, args) => {
    // const result = await context.prisma.payment.aggregate({
    //     _sum: {
    //         amount: true,
    //         cost: true,
    //         changeDue: true,
    //         discount: true,
    //     },
    //     where: {
    //         payDate: {
    //             gte: args.dateFrom,
    //             lte: args.dateTo,
    //         },
    //     },
    // });
    return {
        amount: 0,
        cost: 0,
        changeDue: 0,
        discount: 0,
    }
}

export const getSalesIndexReport = async (context, args) => {
    const storeInfo = await context.prisma.dispensary.findUnique({
        select: {
            name: true,
            cannabisLicense: true
        },
        where: { id: args.dispensaryId },
    })
    const totalOrders = await context.prisma.order.count({
        where: {
            dispensaryId: args.dispensaryId,
            status: OrderStatus.PAID,
            orderDate: {
                gte: args.dateFrom,
                lte: args.dateTo,
            },
        },
    }) || 0;

    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const structuredResponse = {
        storeName: storeInfo.name,
        cannabisLicense: storeInfo.cannabisLicense,
        totalOrders: totalOrders,
        dateCreated: formattedDate,
        dateFrom: args.dateFrom,
        dateTo: args.dateTo,
    };
    return structuredResponse
}
export const getSalesTaxReport = async (context, args) => {
    let taxReport
    try {
        // taxTotal = await context.prisma.taxHistory.aggregate({
        //     _sum: {
        //         taxAmount: true,
        //     },
        //     where: {
        //         dispensaryId: args.dispensaryId,
        //         order: {
        //             status: OrderStatus.PAID,
        //             orderDate: {
        //                 gte: args.dateFrom, // Ensure args.dateFrom is a valid date
        //                 lte: args.dateTo, // Ensure args.dateTo is a valid date
        //             },
        //         }
        //     },
        //     // include: {
        //     //     order: true
        //     // }
        // });
        const result = await context.prisma.taxHistory.groupBy({
            by: ['taxName', 'taxPercent'],
            _sum: {
                taxAmount: true,
            },
            where: {
                dispensaryId: args.dispensaryId,
                order: {
                    status: OrderStatus.PAID,
                    orderDate: {
                        gte: args.dateFrom, // Ensure args.dateFrom is a valid date
                        lte: args.dateTo, // Ensure args.dateTo is a valid date
                    },
                }
            },
        });

        taxReport = result.map(item => ({
            taxAmount: item._sum.taxAmount,
            taxName: item.taxName,
            taxPercent: item.taxPercent,
        }));

    } catch (e) {
        console.log("taxHistory error >>>>>>>>>", e)
    }
    return taxReport
}
export const getSalesDetailReport = async (context, args) => {
    let orderItems
    try {
        orderItems = await context.prisma.orderItem.findMany({
            where: {
                order: {
                    dispensaryId: args.dispensaryId,
                    status: OrderStatus.PAID, // Ensure OrderStatus.PAID is defined
                    orderDate: {
                        gte: args.dateFrom, // Ensure args.dateFrom is a valid date
                        lte: args.dateTo, // Ensure args.dateTo is a valid date
                    },
                },
            },
            include: {
                order: true, // Include the related order data
                TaxHistory: true
            },
        });
        // Do something with orderItems
    } catch (error) {
        console.error("Error fetching order items:", error);
    }

    console.log("SalesDetailReport orderitems----------", orderItems)
    // Calculate the total discounted and loyalty amounts grouped by mjType
    const orderItemTotals = orderItems.reduce((acc, item) => {
        const mjType = item.mjType; // Accessing mjType from the related order
        const amount = item.amount || 0;
        const discountedAmount = item.discountedAmount || 0; // Ensure it's not null
        const loyaltyAmount = item.loyaltyAmount || 0; // Ensure it's not null
        const totalDiscountAmount = discountedAmount + loyaltyAmount
        const totalTaxAmount = item.TaxHistory.reduce((sum, item) => sum + item.taxAmount, 0);
        // console.log(item)
        if (mjType) {
            if (item.isReturned) {
                if (!acc['return_' + mjType]) {
                    acc['return_' + mjType] = 0; // Initialize if not already present
                }
                acc['return_' + mjType] += amount
            } else {
                if (!acc['grossSales_' + mjType]) {
                    acc['grossSales_' + mjType] = 0; // Initialize if not already present
                }
                acc['grossSales_' + mjType] += amount; // Sum the grossSales amounts

                if (!acc['discount_' + mjType]) {
                    acc['discount_' + mjType] = 0; // Initialize if not already present
                }
                acc['discount_' + mjType] += totalDiscountAmount; // Sum the discounted amounts

                if (!acc['cost_' + mjType]) {
                    acc['cost_' + mjType] = 0
                }
                const costAmount = item.cost * item.quantity
                acc['cost_' + mjType] += costAmount

                if (!acc['tax_' + mjType]) {
                    acc['tax_' + mjType] = 0
                }
                acc['tax_' + mjType] += totalTaxAmount
            }
        }

        return acc;
    }, {});

    console.log("SalesDetailReport orderItemTotals----------", orderItemTotals)
    // Convert the result to an array of objects if needed

    const tax_Mj = orderItemTotals['tax_MJ'] || 0
    const tax_nMj = orderItemTotals['tax_NMJ'] || 0
    const tax_total = tax_Mj + tax_nMj
    console.log("tax Total --------", tax_total)
    const grossSales_Mj = orderItemTotals['grossSales_MJ'] || 0
    const grossSales_nMj = orderItemTotals['grossSales_NMJ'] || 0
    const grossSales_total = grossSales_Mj + grossSales_nMj

    const discounts_Mj = orderItemTotals['discount_MJ'] || 0
    const discounts_nMj = orderItemTotals['discount_NMJ'] || 0
    const discounts_total = discounts_Mj + discounts_nMj

    const netSales_Mj = grossSales_Mj - discounts_Mj- tax_Mj
    const netSales_nMj = grossSales_nMj - discounts_nMj - tax_nMj
    const netSales_total = netSales_Mj + netSales_nMj

    const return_Mj = orderItemTotals['return_MJ'] || 0
    const return_nMj = orderItemTotals['return_NMJ'] || 0
    const return_total = return_Mj + return_nMj

    const cost_Mj = orderItemTotals['cost_MJ'] || 0
    const cost_nMj = orderItemTotals['cost_NMJ'] || 0
    const cost_total = cost_Mj + cost_nMj

    const grossProfit_Mj = netSales_Mj - cost_Mj
    const grossProfit_nMj = netSales_nMj - cost_nMj
    const grossProfit_total = grossProfit_Mj + grossProfit_nMj

    const structuredResponse = {
        grossSales: {
            mj: grossSales_Mj | 0,
            nMj: grossSales_nMj | 0,
            total: grossSales_total | 0,
        },
        discounts: {
            mj: discounts_Mj | 0,
            nMj: discounts_nMj | 0,
            total: discounts_total | 0,
        },
        returns: {
            mj: return_Mj | 0,
            nMj: return_nMj | 0,
            total: return_total | 0,
        },
        netSales: {
            mj: netSales_Mj | 0,
            nMj: netSales_nMj | 0,
            total: netSales_total | 0,
        },
        cost: {
            mj: cost_Mj | 0,
            nMj: cost_nMj | 0,
            total: cost_total | 0,
        },
        grossProfit: {
            mj: grossProfit_Mj | 0,
            nMj: grossProfit_nMj | 0,
            total: grossProfit_total | 0,
        },
    }

    console.log("SalesDetailReport structuredResponse>>>>>> : ", structuredResponse)

    return structuredResponse
}

export const getInsightSummaryReportByDayOfWeek = async (context, args) => {
    let resultData, queryResult, countResult
    try {
        // queryResult = await context.prisma.$queryRaw`
        //     SELECT 
        //         EXTRACT(DOW FROM "orderDate"::date) AS day_of_week,
        //         COUNT(*) AS order_count,
        //         SUM("cashAmount") AS total_cashAmount,
        //         SUM("otherAmount") AS total_otherAmount,
        //         SUM("changeDue") AS total_changeDue,
        //         SUM("discount") AS total_discount,
        //         SUM("loyalty") AS total_loyalty,
        //         SUM("cost") AS total_cost,
        //         SUM("tax") AS total_tax
        //         FROM "Order"
        //         WHERE
        //         "dispensaryId" = ${args.dispensaryId}
        //         AND "status" = 'PAID'
        //         AND "orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
        //         GROUP BY EXTRACT(DOW FROM "orderDate"::date)
        //         ORDER BY EXTRACT(DOW FROM "orderDate"::date)
        //   `;

        countResult = await context.prisma.$queryRaw`
            SELECT 
                EXTRACT(DOW FROM "orderDate"::date) AS day_of_week,
                COUNT(*) AS order_count
            FROM "Order"
            WHERE 
                "dispensaryId" = ${args.dispensaryId}
                AND "status" = 'PAID'
                AND "orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
            GROUP BY EXTRACT(DOW FROM "orderDate"::date)
            ORDER BY EXTRACT(DOW FROM "orderDate"::date)
        `;

        console.log(countResult)
        const orderCountArray = countResult.reduce((acc, item) => {
            acc[item.day_of_week] = item.order_count;
            return acc;
        }, {});
        queryResult = await context.prisma.$queryRaw`
            SELECT 
                EXTRACT(DOW FROM "Order"."orderDate"::date) AS day_of_week,
                SUM("OrderItem"."amount") AS "totalAmount",
                SUM("OrderItem"."discountedAmount") AS "totalDiscountedAmount",
                SUM("OrderItem"."loyaltyAmount") AS "totalLoyaltyAmount",
                SUM("OrderItem"."costAmount") AS "totalCostAmount",
                SUM("TaxSum"."taxAmount") AS "totalTaxAmount"
            FROM "OrderItem"
            LEFT JOIN "Product" ON "OrderItem"."productId" = "Product".id
            LEFT JOIN "ItemCategory" ON "Product"."itemCategoryId" = "ItemCategory".id
            LEFT JOIN (
                SELECT "orderItemId", SUM("taxAmount") AS "taxAmount"
                FROM "TaxHistory"
                GROUP BY "orderItemId"
            ) AS "TaxSum" ON "TaxSum"."orderItemId" = "OrderItem".id
            LEFT JOIN "Order" ON "OrderItem"."orderId" = "Order".id
            WHERE 
                "Order"."dispensaryId" = ${args.dispensaryId}
                AND "Order"."status" = 'PAID'
                AND "Order"."orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
            GROUP BY EXTRACT(DOW FROM "Order"."orderDate"::date)
            ORDER BY EXTRACT(DOW FROM "Order"."orderDate"::date)
            `;
        // console.log(queryResult, '----------------3---------------')
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        resultData = queryResult.map(item => {
            const { day_of_week, totalAmount, totalDiscountedAmount, totalLoyaltyAmount, totalTaxAmount, totalCostAmount } = item;
            const order_count = orderCountArray[day_of_week]
            const netSales = totalAmount - totalTaxAmount - totalDiscountedAmount - totalLoyaltyAmount
            const aov = netSales / Number(order_count); // convert BigInt to Number
            const marginPercent = ((netSales - totalCostAmount) / netSales) * 100;

            return {
                dayOfWeek: dayNames[day_of_week],
                netSales: netSales,
                orderCount: Number(order_count),
                aov: aov,
                marginPercent: marginPercent
            };
        });
    } catch (error) {
        console.log(error)
    }
    return resultData
}

export const getInsightSummaryReport = async (context, args) => {
    let orderItems, orderSum, byCustomers, queryResult
    try {
        orderSum = await context.prisma.order.aggregate({
            _count: {
                cashAmount: true,
            },
            where: {
                dispensaryId: args.dispensaryId,
                status: OrderStatus.PAID, // Ensure OrderStatus.PAID is defined
                orderDate: {
                    gte: args.dateFrom, // Ensure args.dateFrom is a valid date
                    lte: args.dateTo, // Ensure args.dateTo is a valid date
                },
            },
        });
        console.log(orderSum)
        byCustomers = await context.prisma.order.groupBy({
            by: ['customerId'], // Group by customerId
            where: {
                dispensaryId: args.dispensaryId,
                status: OrderStatus.PAID, // Ensure OrderStatus.PAID is defined
                orderDate: {
                    gte: args.dateFrom, // Ensure args.dateFrom is a valid date
                    lte: args.dateTo, // Ensure args.dateTo is a valid date
                },
            },
        });
        queryResult = await context.prisma.$queryRaw`
            SELECT 
                SUM("OrderItem"."amount") AS "totalAmount",
                SUM("OrderItem"."discountedAmount") AS "totalDiscountedAmount",
                SUM("OrderItem"."loyaltyAmount") AS "totalLoyaltyAmount",
                SUM("OrderItem"."costAmount") AS "totalCostAmount",
                SUM("TaxSum"."taxAmount") AS "totalTaxAmount"
            FROM "OrderItem"
            LEFT JOIN "Product" ON "OrderItem"."productId" = "Product".id
            LEFT JOIN "ItemCategory" ON "Product"."itemCategoryId" = "ItemCategory".id
            LEFT JOIN (
                SELECT "orderItemId", SUM("taxAmount") AS "taxAmount"
                FROM "TaxHistory"
                GROUP BY "orderItemId"
            ) AS "TaxSum" ON "TaxSum"."orderItemId" = "OrderItem".id
            LEFT JOIN "Order" ON "OrderItem"."orderId" = "Order".id
            WHERE 
                "Order"."dispensaryId" = ${args.dispensaryId}
                AND "Order"."status" = 'PAID'
                AND "Order"."orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
        `;
    } catch (error) {
        console.error("Error fetching order items:", error);
    }

    console.log("query result === ", queryResult[0])

    const netSales = truncateToTwoDecimals(queryResult[0].totalAmount - queryResult[0].totalTaxAmount - queryResult[0].totalDiscountedAmount - queryResult[0].totalLoyaltyAmount)
    const orderCount = orderSum._count.cashAmount
    const aov = truncateToTwoDecimals(netSales / orderCount)
    const customerCount = byCustomers.length
    const marginPercent = truncateToTwoDecimals((netSales - queryResult[0].totalCostAmount) / netSales * 100)

    const structuredResponse = {
        netSales: netSales,
        orderCount: orderCount,
        aov: aov,
        customerCount: customerCount,
        marginPercent: marginPercent,
        winBackOrderPercent: 0
    }

    return structuredResponse
}

export const getInsightSummaryReportByHour = async (context, args) => {
    const dispensary = await context.prisma.dispensary.findUnique({
        where: { id: args.dispensaryId },
    })
    const storeTimeZone = dispensary.storeTimeZone
    const timeZoneString = timezoneMap[storeTimeZone]
    let queryResult, structuredResponse, responseWithformattedHours
    try {
        queryResult = await context.prisma.$queryRaw`
            SELECT 
                EXTRACT(HOUR FROM "Order"."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timeZoneString}) AS hour,
                SUM("OrderItem"."amount") AS "totalAmount",
                SUM("OrderItem"."discountedAmount") AS "totalDiscountedAmount",
                SUM("OrderItem"."loyaltyAmount") AS "totalLoyaltyAmount",
                SUM("OrderItem"."costAmount") AS "totalCostAmount",
                SUM("TaxSum"."taxAmount") AS "totalTaxAmount"
            FROM "OrderItem"
            LEFT JOIN "Product" ON "OrderItem"."productId" = "Product".id
            LEFT JOIN "ItemCategory" ON "Product"."itemCategoryId" = "ItemCategory".id
            LEFT JOIN (
                SELECT "orderItemId", SUM("taxAmount") AS "taxAmount"
                FROM "TaxHistory"
                GROUP BY "orderItemId"
            ) AS "TaxSum" ON "TaxSum"."orderItemId" = "OrderItem".id
            LEFT JOIN "Order" ON "OrderItem"."orderId" = "Order".id
            WHERE 
                "Order"."dispensaryId" = ${args.dispensaryId}
                AND "Order"."status" = 'PAID'
                AND "Order"."orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
            GROUP BY hour
            ORDER BY hour;
        `;
        structuredResponse = queryResult.map(item => ({
            ...item,
            netSales: item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount - item.totalTaxAmount,
            grossMargin: truncateToTwoDecimals((item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount - item.totalTaxAmount - item.totalCostAmount) / (item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount - item.totalTaxAmount) * 100),
        }));
        responseWithformattedHours = structuredResponse.map(item => ({
            ...item,
            hourLabel: formatHour(item.hour),
        }));

        console.log("responseWithformattedHours>>> ", responseWithformattedHours)

    } catch (e) {
        console.log("raw query error>>>>>> ", e)
    }

    return responseWithformattedHours
}

export const getInsightSummaryReportByDayOfWeekAndHour = async (context, args) => {
    const dispensary = await context.prisma.dispensary.findUnique({
        where: { id: args.dispensaryId },
    })
    const storeTimeZone = dispensary.storeTimeZone
    const timeZoneString = timezoneMap[storeTimeZone]
    let queryResult, structuredResponse, responseWithformattedHours
    try {
        queryResult = await context.prisma.$queryRaw`
            SELECT 
                EXTRACT(DOW FROM "orderDate"::date) AS day_of_week,
                EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timeZoneString}) AS hour,
                COUNT(*) AS order_count
            FROM "Order"
            WHERE 
                "dispensaryId" = ${args.dispensaryId}
                AND "status" = 'PAID'
                AND "orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
            GROUP BY day_of_week, hour
            ORDER BY day_of_week, hour;
        `;
        // structuredResponse = queryResult.map(item => ({
        //     ...item,
        //     netSales: item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount,
        //     grossMargin: truncateToTwoDecimals((item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount - item.totalCostAmount) / (item.totalAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount) * 100),
        // }));

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        responseWithformattedHours = queryResult.map(item => ({
            ...item,
            hourLabel: formatHour(item.hour),
            dayName: dayNames[item.day_of_week],
            orderCount: Number(item.order_count)
        }));

        //   const groupedByHourLabel = responseWithformattedHours.reduce((acc, item) => {
        //     const label = item.hour;
        //     if (!acc[label]) {
        //       acc[label] = [];
        //     }
        //     acc[label].push(item);
        //     return acc;
        //   }, {});

        //   const resultArray = Object.entries(groupedByHourLabel);

        //   console.log(resultArray);

    } catch (e) {
        console.log("raw query error>>>>>> ", e)
    }

    return responseWithformattedHours
}

export const getSalesByCategory = async (context, args) => {
    let queryResult, structuredResponse
    try {
        queryResult = await context.prisma.$queryRaw`
         SELECT 
         "ItemCategory"."name" AS "categoryName",
         "ItemCategory"."color" AS "categoryColor",
         SUM("OrderItem"."amount") AS "totalAmount",
            SUM("OrderItem"."discountedAmount") AS "totalDiscountedAmount",
            SUM("OrderItem"."loyaltyAmount") AS "totalLoyaltyAmount",
            SUM("OrderItem"."costAmount") AS "totalCostAmount",
            SUM("TaxSum"."taxAmount") AS "totalTaxAmount"
        FROM "OrderItem"
        LEFT JOIN "Product" ON "OrderItem"."productId" = "Product".id
        LEFT JOIN "ItemCategory" ON "Product"."itemCategoryId" = "ItemCategory".id
        LEFT JOIN (
                SELECT "orderItemId", SUM("taxAmount") AS "taxAmount"
                FROM "TaxHistory"
                GROUP BY "orderItemId"
            ) AS "TaxSum" ON "TaxSum"."orderItemId" = "OrderItem".id
        WHERE "OrderItem"."orderId" IN (
            SELECT id 
            FROM "Order" 
            WHERE "Order"."dispensaryId" = ${args.dispensaryId}
            AND "Order"."status" = 'PAID'
            AND "Order"."orderDate" BETWEEN ${args.dateFrom} AND ${args.dateTo}
        )
        GROUP BY "Product"."itemCategoryId", "ItemCategory"."name", "ItemCategory"."color";
        `;
        structuredResponse = queryResult.map(item => ({
            ...item,
            netSales: item.totalAmount - item.totalTaxAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount,
            grossMargin: truncateToTwoDecimals((item.totalAmount - item.totalTaxAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount - item.totalCostAmount) / (item.totalAmount - item.totalTaxAmount - item.totalDiscountedAmount - item.totalLoyaltyAmount) * 100),
        }));
    } catch (e) {
        console.log("raw query error>>>>>> ", e)
    }

    return structuredResponse
}

export const getPaymentCashReport = async (context, args) => {
    const result = await context.prisma.order.aggregate({
        _sum: {
            cashAmount: true,
            changeDue: true,
        },
        where: {
            dispensaryId: args.dispensaryId,
            status: OrderStatus.PAID,
            orderDate: {
                gte: args.dateFrom,
                lte: args.dateTo,
            },
        },
    });
    const structuredResponse = {
        cash: result._sum.cashAmount,
        changeDue: result._sum.changeDue,
        returns: 0,
    };
    return structuredResponse
}

export const getInventoryReport = async (context, args) => {
    const result = await context.prisma.order.aggregate({
        _sum: {
            cashAmount: true,
            changeDue: true,
        },
        where: {
            dispensaryId: args.dispensaryId,
            status: OrderStatus.PAID,
            orderDate: {
                gte: args.dateFrom,
                lte: args.dateTo,
            },
        },
    });
    const structuredResponse = {
        cash: result._sum.cashAmount,
        changeDue: result._sum.changeDue,
        returns: 0,
    };
    return null
}

export const getNotifications = async (context, args) => {
    const unsyncedOrderCount = await context.prisma.order.count({
        where: {
            dispensaryId: args.dispensaryId,
            mjType: OrderMjType.MJ,
            isReportedToMetrc: false,
            status: OrderStatus.PAID
        }
    })
    const packageFinishCount = await context.prisma.package.count({
        where: {
            dispensaryId: args.dispensaryId,
            Quantity: 0,
            packageStatus: PackageStatus.ACTIVE,
            assignPackage: {
                posQty: 0
            },
        },
    })
    const packageReconcileCount = await context.prisma.adjustPackage.count({
        where: {
            dispensaryId: args.dispensaryId,
            needMetrcSync: true,
            syncMetrc: false,
            package: {
                packageId: {
                    gt: 0,
                },
            }
        },
    })
    const tinyPackageCount = await context.prisma.package.count({
        where: {
            dispensaryId: args.dispensaryId,
            packageStatus: PackageStatus.ACTIVE,
            Quantity: {
                gt: 0,
                lt: 1
            },
            assignPackage: {
                posQty: {
                    gt: 0,
                    lt: 1
                }
            }
        },
    })
    type Notification = {
        notifyType: NotifyType;
        count: number;
    };
    const res = [
        { notifyType: NotifyType.OrderSync, count: unsyncedOrderCount },
        { notifyType: NotifyType.PackageFinish, count: packageFinishCount },
        { notifyType: NotifyType.PackageReconcile, count: packageReconcileCount },
        { notifyType: NotifyType.TinyPackage, count: tinyPackageCount },
    ]

    // const notifyList = res?.filter((item): item is Notification => item != null && item.count !== 0) || []
    // if (notifyList.length > 0) {
    //     await userModel.sendEmailFromTeamForNotification(notifyList, context.userInfo)
    // }

    return res
}

export const getActionHistory = async (context, args) => {
    let where: any = {
        dispensaryId: args.dispensaryId,
        createdAt: {
            gte: args.fromDate,
            lte: args.toDate
        }
    };
    let orderBy: any
    const sortDirection = 'desc'
    orderBy = { createdAt: sortDirection }
    if (args.searchField) {
        switch (args.searchField) {
            case 'orderId':
                if (args.searchParam) {
                    where.orderId = parseInt(args.searchParam)
                }
                break;

            case 'packageLabel':
                if (args.searchParam) {
                    where.packageLabel = { // Assuming there is a field called 'label' in the package model  
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;
            // You can add more cases here for additional searchField values.  

            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }

    let searchedHistory, totalCount
    try {
        searchedHistory = await context.prisma.actionHistory.findMany({
            where: where,
            orderBy: orderBy,
            skip: (args.pageNumber - 1) * args.onePageRecords,
            take: args.onePageRecords,
        })
        totalCount = await context.prisma.actionHistory.count({
            where: where
        });
    } catch (error) {
        console.log(error)
    }
    return {
        actionHistory: searchedHistory,
        totalCount: totalCount
    }
}

