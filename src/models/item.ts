export const getItemByItemId = async (context, itemId) => {
    return context.prisma.package.findUnique({
        where: { itemId: itemId || undefined },
    })
}