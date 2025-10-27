export const getDispensaryById = async (context, id) => {
    return context.prisma.dispensary.findUnique({
        include: {
            organization: true,
        },
        where: { id: id || undefined },
    })
}

export const getAllDispensaires = async (context) => {
    return context.prisma.dispensary.findMany({
        include: {
            organization: true,
        },
        orderBy: { id: "asc" },
    })
}

export const getAllStoreLinkNames = async (context) => {
    return context.prisma.dispensary.findMany({
        select: {
            storeLinkName: true,
        },
        orderBy: { storeLinkName: "asc" },
    })
}

export const getDispensairesByOrganizationId = async (context, organizationId) => {
    if (organizationId === 'all') {
        return context.prisma.dispensary.findMany({
            orderBy: { id: "asc" },
        })
    } else {
        return context.prisma.dispensary.findMany({
            where: { organizationId: organizationId || undefined },
            orderBy: { id: "asc" },
        })
    }
}

export const getMetrcInfoByDispensaryId = async (context, id) => {
    return context.prisma.dispensary.findUnique({
        where: { id: id || undefined },
        select: {
            metrcConnectionStatus: true,
            metrcApiKey: true,
            cannabisLicense: true,
            id: true
        },
    })
}
