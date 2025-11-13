export const getItemCategoryById = async (context, id) => {
    return context.prisma.itemCategory.findUnique({
        where: { id: id || undefined },
    })
}

export const getAllItemCategoriesByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.itemCategory.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { id: "asc" },
    })
}