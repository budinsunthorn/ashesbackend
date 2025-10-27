export const getAllInventoryByDispensaryId = async (context, id) => {
    return context.prisma.inventory.findMany({
        include: {
            product: {
                include:{
                    itemCategory: true
                }
            }
        },
        where: { dispensaryId: id || undefined },
        orderBy: { id: "asc" },
    })
}