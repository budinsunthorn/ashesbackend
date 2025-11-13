import { DropType, DrawerStatus, OrderStatus } from "@prisma/client";
import { date } from "joi";
import { truncateToTwoDecimals } from "../context";

export const getMoneyDropHistoryByDrawerId = async (context, args) => {
    return context.prisma.moneyDrop.findMany({
        where: {
            drawerId: args.drawerId,
        },
        orderBy: { createdAt: "asc" },
    })
}

export const getCurrentDrawerByUserId = async (context, userId) => {
    return context.prisma.drawer.findMany({
        where: {
            userId: userId,
            status: DrawerStatus.PENDING
        },
        orderBy: { id: "asc" },
    })
}

export const getDrawerInfoByDrawerId = async (context, drawerId) => {

    const drawer = await context.prisma.drawer.findUnique({
        where: {
            id: drawerId
        },
    })

    const dropAmount = await context.prisma.moneyDrop.groupBy({
        by: ['dropType'],
        where: {
            drawerId: drawerId
        },
        _sum: {
            amount: true
        },
        orderBy: {
            dropType: 'asc'
        }
    });

    const orders = await context.prisma.order.groupBy({
        by: ['drawerId'],
        where: {
            drawerId: drawerId,
            status: OrderStatus.PAID
        },
        _sum: {
            cashAmount: true,
            changeDue: true,
            otherAmount: true,
        },
    })

    const drops = {};
    drops[DropType.IN] = 0
    drops[DropType.OUT] = 0
    dropAmount.forEach(item => {
        drops[item.dropType] = item._sum.amount;
    });
    const startingBalance = drawer.startAmount
    const incomingDrops = drops[DropType.IN]
    const outgoingDrops = drops[DropType.OUT]
    const changeDue = orders.length > 0 ? orders[0]._sum.changeDue : 0
    const cashSales = orders.length > 0 ? orders[0]._sum.cashAmount : 0
    const otherSales = orders.length > 0 ? orders[0]._sum.otherAmount : 0
    const expectedCash = startingBalance  + incomingDrops  - outgoingDrops  - changeDue  + cashSales 

    const responseResult: any = {
        startingBalance: truncateToTwoDecimals(startingBalance),
        incomingDrops: truncateToTwoDecimals(incomingDrops),
        outgoingDrops: truncateToTwoDecimals(outgoingDrops),
        cashSales: truncateToTwoDecimals(cashSales),
        otherSales: truncateToTwoDecimals(otherSales),
        changeDue: truncateToTwoDecimals(changeDue),
        expectedCash: truncateToTwoDecimals(expectedCash),
    }

    return responseResult
}

export const getDrawerReportByDrawerId = async (context, drawerId) => {
    
    try {
        const drawer = await context.prisma.drawer.findUnique({
            where: {
                id: drawerId
            },
            include: {
                dispensary: {
                    select: {
                        name: true
                    }
                },
                user: {
                    select: {
                        name: true
                    }
                }
            }
        })

        console.log("drawer>>--------->> ", drawer)
        const dropAmount = await context.prisma.moneyDrop.groupBy({
            by: ['dropType'],
            where: {
                drawerId: drawerId
            },
            _sum: {
                amount: true
            },
            orderBy: {
                dropType: 'asc'
            }
        });
        const orders = await context.prisma.order.groupBy({
            by: ['drawerId'],
            where: {
                drawerId: drawerId,
                status: OrderStatus.PAID
            },
            _sum: {
                cashAmount: true,
                changeDue: true,
                otherAmount: true,
            },
        })

        const voidedOrders = await context.prisma.order.groupBy({
            by: ['drawerId'],
            where: {
                drawerId: drawerId,
                status: OrderStatus.VOID
            },
            _sum: {
                cashAmount: true,
                changeDue: true,
                otherAmount: true,
            },
        })

        // const taxes = await context.prisma.taxHistory.groupBy({
        //     by: ['taxName'],
        //     where: {
        //         order: {
        //             drawerId: drawerId,
        //         }
        //     },
        //     _sum: {
        //         taxAmount: true,
        //     },
        // })

        // const taxArray = taxes.map(item => ({
        //     taxName: item.taxName + " " + item.taxPercent,
        //     taxAmount: item._sum.taxAmount
        // }));

        // const totalTaxAmount = taxArray.reduce((sum, item) => sum + item.taxAmount, 0)

        const taxesData = await context.prisma.taxHistory.findMany({
            where: {
                order: {
                    drawerId: drawerId,
                    status: OrderStatus.PAID
                },
            },
            select: {
                taxName: true,
                taxPercent: true,
                taxAmount: true,
            },
        });

        // Group manually
        const grouped = taxesData.reduce((acc, item) => {
            if (!acc[item.taxName]) {
                acc[item.taxName] = {
                    taxName: item.taxName + " - " + item.taxPercent + "%",
                    taxAmount: 0,
                };
            }
            acc[item.taxName].taxAmount += item.taxAmount;
            return acc;
        }, {});

        // Convert to array if needed
        const taxResult = Object.values(grouped);
        const formattedData = taxResult.map((item: any) => ({
            ...item,
            taxAmount: Number(item.taxAmount.toFixed(2))
        }));
        const sumTotalTaxAmount = formattedData.reduce((sum, item: any) => sum + item.taxAmount, 0);

        const drops: any = {};
        drops[DropType.IN] = 0
        drops[DropType.OUT] = 0
        dropAmount.forEach(item => {
            drops[item.dropType] = item._sum.amount;
        });
        const startingBalance = drawer.startAmount ?? 0
        const incomingDrops =drops[DropType.IN]
        const outgoingDrops = drops[DropType.OUT]
        const changeDue = orders.length > 0 ? orders[0]._sum.changeDue : 0
        const cashSales = orders.length > 0 ? orders[0]._sum.cashAmount : 0
        const otherSales = orders.length > 0 ? orders[0]._sum.otherAmount : 0
        const expectedCash = startingBalance  + incomingDrops  - outgoingDrops  - changeDue  + cashSales 
        const cashPayments = cashSales - changeDue 
        const drawerEndAmount = drawer.endAmount ?? 0
        const drawerTotalDeposit = drawer.totalDeposite ?? 0
        const actualCashInDrawer = drawerEndAmount + drawerTotalDeposit

        const voidedChangeDue = voidedOrders.length > 0 ? voidedOrders[0]._sum.changeDue : 0
        const voidedCashSales = voidedOrders.length > 0 ? voidedOrders[0]._sum.cashAmount : 0
        const voidedOtherSales = voidedOrders.length > 0 ? voidedOrders[0]._sum.otherAmount : 0
        const voidedAmount = voidedCashSales  + voidedOtherSales  - voidedChangeDue 

        const responseResult: any = {

            storeName: drawer.dispensary.name,
            registerName: drawer.register,
            startedBy: drawer.user.name,
            startedAt: drawer.createdAt,
            startNote: drawer.note,
            endedAt: drawer.endedAt,
            endNote: drawer.comment,

            startingBalance: startingBalance,
            discrepancyReason: drawer.discrepancyReason,
            cashPayments: cashPayments,
            returns: 0,
            voids: voidedAmount,
            incomingDrops: incomingDrops,
            outgoingDrops: outgoingDrops,
            closingDrop: drawerTotalDeposit,
            leftInDrawer: drawerEndAmount,
            expectedCash: expectedCash,
            actualCashInDrawer: actualCashInDrawer,
            closingDiscrepancy: actualCashInDrawer - expectedCash,
            otherPayments: otherSales,
            totalPayments: cashPayments  + otherSales ,
            taxes: formattedData,
            taxTotal: sumTotalTaxAmount,
            netSales: cashPayments  + otherSales  - sumTotalTaxAmount 
        }

        return responseResult
    } catch (e) {
        console.log("drawerReport error>>>>>>>>>>", e)
    }

}

export const getDrawerHistory = async (context, args) => {

    const startOfDay = new Date(args.dateFrom + 'T00:00:00.000Z');
    const endOfDay = new Date(args.dateTo + 'T23:59:59.999Z');

    const drawers = await context.prisma.drawer.findMany({
        where: {
            dispensaryId: args.dispensaryId,
            createdAt: {
                gte: startOfDay, // Ensure args.dateFrom is a valid date
                lte: endOfDay, // Ensure args.dateTo is a valid date
            },
        },
        include: {
            user: true
        },
        orderBy: { createdAt: "desc" },
    })
    return drawers
}


export const getUsingDrawersByDispensaryId = async (context, dispensaryId) => {
    try {
        return context.prisma.drawer.findMany({
            where: {
                dispensaryId: dispensaryId,
                status: DrawerStatus.PENDING
            },
            include: {
                user: true
            },
            orderBy: { register: "asc" },
        })
    } catch (error) {
        console.log("error>>>>>", error)
    }
}

export const getUsingDrawer = async (context, args) => {
    const usingDrawer = await context.prisma.drawer.findMany({
        where: {
            userId: args.userId,
            dispensaryId: args.dispensaryId,
            isUsing: true
        },
        include: {
            Order: {
                where: {
                    status: OrderStatus.PAID,
                },
            },
        }
    })

    const startAmount = usingDrawer[0].startAmount

    const sumCashAmount = usingDrawer.reduce((sum, item) => {
        return sum + item.Order.reduce((orderSum, order) => orderSum + (order.cashAmount || 0), 0);
    }, 0);

    const sumChangeDue = usingDrawer.reduce((sum, item) => {
        return sum + item.Order.reduce((orderSum, order) => orderSum + (order.changeDue || 0), 0);
    }, 0);

    const drawerId = usingDrawer[0].id

    const dropIn = await context.prisma.moneyDrop.aggregate({
        _sum: {
            amount: true,
        },
        where: {
            drawerId: drawerId,
            dropType: DropType.IN
        },
    });

    const dropOut = await context.prisma.moneyDrop.aggregate({
        _sum: {
            amount: true,
        },
        where: {
            drawerId: drawerId,
            dropType: DropType.OUT
        },
    });
    const dropInMoney = dropIn._sum.amount | 0
    const dropOutMoney = dropOut._sum.amount | 0

    const cashBalance = startAmount + sumCashAmount - sumChangeDue + dropInMoney - dropOutMoney

    const numberOfOrders = usingDrawer[0].Order.length
    const usingDrawerDataIndex = {
        id: usingDrawer[0].id,
        register: usingDrawer[0].register,
        startedAt: usingDrawer[0].createdAt,
        cashBalance: cashBalance,
        numberOfOrders: numberOfOrders,
    }
    return usingDrawerDataIndex
}