import { Dispensary } from "../resolvers/dispensary"

export const getPurchaseLimitByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.purchaseLimit.findMany({
        where: { dispensaryId: dispensaryId },
    })
}

export const getPurchaseLimitByPurchaseLimitType = async (context, dispensaryId) => {
    const data = await context.prisma.purchaseLimit.findMany({
        where: { dispensaryId: dispensaryId },
    })
    const result = data.reduce((acc, item) => {
        const { purchaseLimitType, purchaseLimitAmount, limitUnit, purchaseLimitMethod, limitWeight } = item;
        acc[purchaseLimitType] = {
            purchaseLimitAmount,
            limitUnit,
            purchaseLimitMethod,
            limitWeight
        };
        return acc;
    }, []);

    console.log(result)
    return result
}

