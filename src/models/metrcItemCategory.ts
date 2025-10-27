export const getMetrcItemCategoryByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.metrcItemCategory.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}

export const getMetrcAdjustmentReasonsByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.metrcAdjustmentReasons.findMany({
        where: { dispensaryId: dispensaryId },
        orderBy: { Name: "asc" },
    })
}