import { LoyaltyType } from "@prisma/client";
import { truncateToTwoDecimals } from "../context";
export const getLoyaltyById = async (context, id) => {
    return context.prisma.loyalty.findUnique({
        where: { id: id || undefined },
    })
}

export const getAllLoyaltiesByDispensaryId = async (context, dispensaryId) => {
    if (dispensaryId === 0) {
        return context.prisma.loyalty.findMany({
            orderBy: { id: "asc" },
        })
    } else {
        return context.prisma.loyalty.findMany({
            where: { dispensaryId: dispensaryId || undefined },
            orderBy: { id: "asc" },
        })
    }
}

export const setLoyaltyForOrderItems = async (tx, orderId, loyaltyType, loyaltyWorth, loyaltyValue, baseAmount) => {
    const totalSum = await tx.orderItem.aggregate({
        _sum: {
            amount: true,
        },
        where: {
            orderId: orderId,
        },
    });
    const totalSumAmount = totalSum._sum.amount ?? 0
    let totalAmount =  totalSumAmount + baseAmount
    const orderItems = await tx.orderItem.findMany({
        where: {
            orderId: orderId
        }
    })
    let loyaltyAmount = loyaltyWorth * loyaltyValue
    let loyaltyAmountForCurrentItem = 0
    if (loyaltyType == LoyaltyType.MANUAL) {
        loyaltyAmountForCurrentItem = totalAmount == 0 ? 0 : loyaltyAmount * baseAmount / totalAmount
        for (const item of orderItems) {
            await tx.orderItem.update({
                data: {
                    loyaltyAmount: totalAmount == 0 ? 0 : loyaltyAmount * item.amount / totalAmount,
                },
                where: {
                    id: item.id
                }
            });
        }
    }

    return loyaltyAmountForCurrentItem
}
