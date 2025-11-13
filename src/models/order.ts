import { detectRuntime } from "@prisma/client/runtime/library"
import { throwUnauthorizedError, throwManualError } from '../index'
import { LimitWeight, LoyaltyTxType, OrderMjType, OrderStatus } from "@prisma/client"
import { truncateToTwoDecimals, setFourDecimals, getConvertedWeight } from "../context";
import { MetrcOrderSyncType, ProductUnitOfMeasure } from "../generated/graphql";

export const getOrder = async (context, id) => {
    return context.prisma.order.findUnique({
        where: { id: id || undefined },
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
                    }
                }
            },
            customer: true,
            dispensary: true,
            drawer: true,
            user: true
        }
    })
}

export const getOrderAmountInfo = async (context, id) => {
    const order = await context.prisma.order.findUnique({
        where: {
            id: id
        },
        include: {
            OrderItem: {
                include: {
                    package: true,
                    TaxHistory: true,
                }
            },
            customer: true
        }
    })

    let subTotal = 0;
    let tax = 0;
    let discount = 0;
    let netTotal = 0;
    let cash = setFourDecimals(order.cashAmount || 0);
    let other = setFourDecimals(order.otherAmount || 0);
    let changeDue = setFourDecimals(order.changeDue || 0);
    let total = setFourDecimals(cash - other - changeDue);

    for (let i = 0; i < order.OrderItem.length; i++) {
        // console.log("order.OrderItem.TaxHistory", order.OrderItem[i].TaxHistory)
        let totalTaxAmount = 0
        if (order.OrderItem[i].TaxHistory.length > 0) {
            totalTaxAmount = setFourDecimals(order.OrderItem[i].TaxHistory.reduce((sum, tax) => setFourDecimals(setFourDecimals(sum) + setFourDecimals(tax.taxAmount)), 0));
        }
        const amount = setFourDecimals(order.OrderItem[i].amount)
        const discountedAmount = order.OrderItem[i].discountedAmount
        const loyaltyAmount = order.OrderItem[i].loyaltyAmount
        const net = setFourDecimals(amount - discountedAmount - loyaltyAmount - setFourDecimals(totalTaxAmount))

        subTotal += setFourDecimals(amount)
        tax += setFourDecimals(totalTaxAmount)
        discount += setFourDecimals(discountedAmount)
        discount += setFourDecimals(loyaltyAmount)
        netTotal += setFourDecimals(Math.round(setFourDecimals(net) * 100) / 100)
    }

    const result = {
        subTotal: subTotal.toFixed(2),
        tax: tax.toFixed(2),
        discount: discount.toFixed(2),
        netTotal: (Number(subTotal.toFixed(2)) - Number(discount.toFixed(2)) - Number(tax.toFixed(2))).toFixed(2),
        total: total.toFixed(2),
        cash: cash.toFixed(2),
        other: other.toFixed(2),
        changeDue: changeDue.toFixed(2),
    }

    return result

}

export const getOrderAndTax = async (context, id) => {
    try {
        return context.prisma.$transaction(async (tx) => {
            const orderItems = await tx.orderItem.findMany({
                where: {
                    orderId: id
                },
                include: {
                    product: {
                        include: {
                            itemCategory: true,
                        },
                    },
                },
            });
            // console.log("orderItems>>>>>>>>", orderItems)

            // console.log(groupedResult);

            const order = await tx.order.findUnique({
                where: { id: id || undefined },
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
                            package: true,
                            TaxHistory: true
                        }
                    },
                    customer: true,
                    dispensary: true,
                    drawer: true,
                    user: true,
                    DiscountHistory: true,
                    LoyaltyHistory: true
                }
            })
            // console.log("order>>>>>", order)
            const tax = await context.prisma.taxHistory.aggregate({
                _sum: {
                    taxAmount: true,
                },
                where: {
                    orderId: id,
                },
            });

            const currentTypeLimitValue = await context.prisma.purchaseLimit.findMany({
                where: {
                    dispensaryId: order.dispensaryId,
                },
            })

            // Initialize empty objects
            const limitUnitMap = {};
            const limitWeightMap = {};

            // Loop through the array to populate objects
            currentTypeLimitValue.forEach(item => {
                limitUnitMap[item.purchaseLimitType] = item.limitUnit;
                limitWeightMap[item.purchaseLimitType] = item.limitWeight;
            });

            let purchaseLimit

            if (order.mjType === OrderMjType.MJ) {
                const result = await orderItems.filter(item => item.mjType === OrderMjType.MJ).reduce((acc, item) => {
                    const purchaseLimitType = item.product.itemCategory.purchaseLimitType;
                    const productUnitWeight = item.product.unitWeight > 0 ? item.product.unitWeight : 1
                    const productNetWeight = item.product.netWeight > 0 ? item.product.netWeight : 1
                    const limitUnit = limitUnitMap[purchaseLimitType]
                    const limitWeightType = limitWeightMap[purchaseLimitType]
                    // Initialize the entry if it doesn't exist
                    if (!acc[purchaseLimitType]) {
                        acc[purchaseLimitType] = 0;
                    }
                    // Sum the quantities
                    let convertedWeight
                    if (item.product.productUnitOfMeasure == ProductUnitOfMeasure.Ea) {
                        const weight = limitWeightType == LimitWeight.unitWeight ? productUnitWeight : productNetWeight
                        const weightUnit = limitWeightType == LimitWeight.unitWeight ? item.product.unitOfUnitWeight : item.product.unitOfNetWeight
                        console.log(item.quantity, item.product.unitWeight, weight)
                        const qty =  item.product.isApplyUnitWeight && item.product.unitWeight > 0 ? truncateToTwoDecimals(item.quantity / item.product.unitWeight * weight) : item.quantity * weight
                        convertedWeight = getConvertedWeight(qty, weightUnit, limitUnit)
                        // console.log("----------",  qty, weightUnit, limitUnit, convertedWeight)
                    }else{
                        convertedWeight = getConvertedWeight(item.quantity, ProductUnitOfMeasure.G, limitUnit)
                    }
                    // console.log("convertedWeight>>>", item.quantity, item.product.unitOfMeasure, limitUnit, convertedWeight)
                    acc[purchaseLimitType] += convertedWeight;
                    return acc;
                }, {});
                // Convert the result to an array if needed
                purchaseLimit = Object.entries(result).map(([type, quantity]: any) => ({
                    purchaseLimitType: type,
                    totalQuantity: truncateToTwoDecimals(quantity),
                }));
            } else {
                purchaseLimit = []
            }

            return {
                order: order,
                tax: tax._sum.taxAmount || 0,
                purchaseLimit: purchaseLimit
            }
        })

    } catch (e) {
        console.log("ordertax error>>>", e)
    }
}

export const getAllOrdersByDispensaryIdAndDate = async (context, dispensaryId, orderDate) => {
    return context.prisma.order.findMany({
        where: {
            AND: [
                { dispensaryId: dispensaryId || undefined },
                { orderDate: orderDate || undefined },
            ]
        },
        include: {
            customer: true
        },
        orderBy: {
            id: 'asc',
        },
    })
}

export const getAllOrdersByDispensaryIdAndStatusAndOrderTypeAndSearchParamWithPages = async (context, args) => {

    let where: any = {
        dispensaryId: args.dispensaryId,
    }
    if (args.status) {
        if(args.status != 'all') where.status = args.status
    }
    if (args.orderType) {
        where.orderType = args.orderType
    }
    if (args.synced == MetrcOrderSyncType.Synced) {
        where.isReportedToMetrc = true
    }
    if (args.synced == MetrcOrderSyncType.NotSynced) {
        where.mjType = OrderMjType.MJ
        where.isReportedToMetrc = false
    }
    if (args.synced == MetrcOrderSyncType.NonMj) {
        where.mjType = OrderMjType.NMJ
    }
    let orderBy: any
    const sortDirection = args.sortDirection ? args.sortDirection : 'asc'
    if (args.sortField) {
        switch (args.sortField) {
            case 'id':
                orderBy = { id: sortDirection }
                break
            case 'status':
                orderBy = { status: sortDirection }
                break
            case 'mjType':
                orderBy = { mjType: sortDirection }
                break
            case 'metrcId':
                orderBy = { metrcId: sortDirection }
                break
            case 'customer.name':
                orderBy = { customer: { name: sortDirection } }
                break
            case 'customer.medicalLicense':
                orderBy = { customer: { medicalLicense: sortDirection } }
                break
            case 'user.name':
                orderBy = { user: { name: sortDirection } }
                break
            case 'orderDate':
                orderBy = { orderDate: sortDirection }
                break
            case 'isReportedToMetrc':
                orderBy = { isReportedToMetrc: sortDirection }
                break
        }
    }

    if (args.searchField) {
        switch (args.searchField) {
            case 'id':
                if (args.searchParam) {
                    if (Number(args.searchParam) > 0)
                        where.id = Number(args.searchParam)
                }
                break;

            case 'metrcId':
                if (args.searchParam) {
                    if (Number(args.searchParam) > 0)
                        where.metrcId = Number(args.searchParam)
                }
                break;
            case 'customer.name':
                if (args.searchParam) {
                    where.customer = {
                        name: {
                            contains: args.searchParam,
                            mode: 'insensitive',
                        }
                    };
                }
                break;
            case 'customer.medicalLicense':
                if (args.searchParam) {
                    where.customer = {
                        medicalLicense: {
                            contains: args.searchParam,
                            mode: 'insensitive',
                        }
                    };
                }
                break;
            case 'user.name':
                if (args.searchParam) {
                    where.user = {
                        name: {
                            contains: args.searchParam,
                            mode: 'insensitive',
                        }
                    };
                }
                break;

            case 'orderDate':
                if (args.searchParam) {
                    where.orderDate = {
                        contains: args.searchParam,
                        mode: 'insensitive',
                    };
                }
                break;

            default:
                break; // Do nothing if searchField doesn't match any case  
        }
    }

    const totalCount = await context.prisma.order.count({
        where: where
    });
    const searchedOrders = await context.prisma.order.findMany({
        where: where,
        include: {
            customer: true,
            user: true
        },
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
        orderBy: orderBy
    })
    const orderWithGrandTotal = searchedOrders.map(order => ({
        ...order,
        grandTotal: order.cashAmount + order.otherAmount - order.changeDue,
    }));
    return {
        orders: orderWithGrandTotal,
        totalCount: totalCount
    }
}

export const getEditOrderByDrawerId = async (context, drawerId) => {

    const editOrders = await context.prisma.order.findMany({
        where: {
            drawerId: drawerId,
            status: OrderStatus.EDIT
        },
        include: {
            OrderItem: {
                include: {
                    product: {
                        include: {
                            itemCategory: true
                        }
                    }
                }
            },

        },
    });

    return editOrders
}

export const getEditOrderCountByDrawerId = async (context, drawerId) => {

    const totalCount = await context.prisma.order.findMany({
        where: {
            drawerId: drawerId,
            status: OrderStatus.EDIT
        },
    });

    return {
        count: totalCount.length
    }
}

export const getAllOrdersByDrawerId = async (context, drawerId) => {
    return context.prisma.order.findMany({
        where: {
            drawerId: drawerId,
            OR: [
                { status: OrderStatus.EDIT },
                { status: OrderStatus.PAID },
                { status: OrderStatus.HOLD },
            ]
        },
        include: {
            customer: true,
            DiscountHistory: true,
            LoyaltyHistory: true
        },
        orderBy: {
            id: 'asc',
        },
    })
}

export const getAllOrdersInfoIncludingAllTypesByDrawerId = async (context, drawerId) => {
    return context.prisma.order.findMany({
        where: {
            drawerId: drawerId,
            description: null
        },
        include: {
            user: true,
        },
        orderBy: {
            id: 'desc',
        },
    })
}

export const getAllOrdersForCurrentDrawer = async (context, args) => {

    const getDrawer = await context.prisma.drawer.findMany({
        where: {
            dispensaryId: args.input.dispensaryId,
            userId: args.input.userId,
            isUsing: true,
        },
    })
    if (getDrawer.length === 0) return throwManualError(400, 'No started Drawer.')
    const drawerId = getDrawer[0].id
    return context.prisma.order.findMany({
        where: {
            drawerId: drawerId,
            OR: [
                { status: OrderStatus.EDIT },
                { status: OrderStatus.PAID },
            ]
        },
        include: {
            customer: true
        },
        orderBy: {
            id: 'asc',
        },
    })
}

export const getOrderNumbersByDispensaryIdAndCustomerIdWithPages = async (context, args) => {
    const totalCount = await context.prisma.order.count({
        where: {
            dispensaryId: args.dispensaryId,
            customerId: args.customerId,
            status: OrderStatus.PAID
        },
    });
    const orderNumbers = await context.prisma.order.findMany({
        where: {
            dispensaryId: args.dispensaryId,
            customerId: args.customerId,
            status: OrderStatus.PAID
        },
        select: {
            id: true,
            createdAt: true,
            cashAmount: true,
            otherAmount: true,
            changeDue: true
        },
        orderBy: {
            id: 'desc',
        },
        skip: (args.pageNumber - 1) * args.onePageRecords,
        take: args.onePageRecords,
    })

    const result = orderNumbers.map(order => ({
        id: order.id,
        orderDate: order.createdAt,
        amount: order.cashAmount + order.otherAmount - order.changeDue,
    }));

    return {
        orderHistory: result,
        totalCount: totalCount
    }
}