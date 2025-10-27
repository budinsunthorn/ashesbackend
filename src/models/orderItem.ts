import { truncateToTwoDecimals } from "../context";
import { TaxSettingApplyTo } from "@prisma/client";
export const getAllOrderItemsByOrderId = async (context, orderId) => {
    return context.prisma.orderItem.findMany({
        include: {
            product: {
                include: {
                    name: true,
                    productUnitOfMeasure: true,
                    itemCategory: {
                        include: {
                            name: true,
                            color: true,
                            metrcCategory: true
                        }
                    }
                }
            }
        },
        where: { orderId: orderId },
        orderBy: {
            id: 'asc',
        },
    })
}

export const updateTaxHistoryForOrder = async (context, orderId) => {
    try {
        const order = await context.prisma.order.findUnique({
            where: { id: orderId || undefined },
            include: {
                OrderItem: {
                    include: {
                        product: {
                            include: {
                                itemCategory: true,
                            },
                        },
                    }
                },
                customer: true
            },
        })
        const dispensaryId = order.dispensaryId
        const isTaxExempt = order.customer.isTaxExempt
        const orderItems = order.OrderItem
        let taxSum = 0
        return context.prisma.$transaction(async (tx) => {

            await tx.taxHistory.deleteMany({
                where: {
                    orderId: orderId,
                }
            })

            for (let i = 0; i < orderItems.length; i++) {
                const orderItem = orderItems[i]
                const product = orderItem.product

                let fundAmount = orderItem.amount - orderItem.discountedAmount - orderItem.loyaltyAmount

                const applyTo = product.itemCategory.containMj ? TaxSettingApplyTo.MJ : TaxSettingApplyTo.NMJ

                const taxApply = await tx.taxApply.findMany({
                    where: {
                        dispensaryId: dispensaryId,
                        applyTo: applyTo
                    },
                })
                // console.log(taxApply)
                for (const item of taxApply) {
                    if( isTaxExempt && item.isTaxExempt) continue
                    const taxAmount = fundAmount * item.compoundPercent / 100
                    taxSum += taxAmount
                    const taxHistoryCreate = await tx.taxHistory.create({
                        data: {
                            dispensaryId: dispensaryId,
                            orderId: orderId,
                            orderItemId: orderItem.id,
                            taxName: item.taxName,
                            taxPercent: item.basePercent,
                            compoundPercent: item.compoundPercent,
                            taxAmount: taxAmount
                        }
                    });
                }
            }

            const updating = await tx.order.update({
                where: {
                    id: orderId,
                },
                data: {
                    tax: taxSum,
                }
            });

            return updating
        },
            {
                maxWait: 9999999, // default: 2000
                timeout: 9999999, // default: 5000
            })
    } catch (e) {
        console.log(e)
    }
}