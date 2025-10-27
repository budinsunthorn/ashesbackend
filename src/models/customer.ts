export const getCustomerById = async (context, id) => {
    return context.prisma.customer.findUnique({
        where: { id: id || undefined },
        include: {
            Order: {
                include: {
                    LoyaltyHistory: {
                        orderBy: { orderId: 'desc' }
                    },
                },
                where: {
                    status: "PAID"
                },
                orderBy: { id: "desc" }
            }
        }
    })
}

export const getAllCustomersByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.customer.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        orderBy: { name: "asc" },
    })
}

export const getAllCustomersByDispensaryIdAndNameAndLicenseSearch = async (context, dispensaryId, searchQuery) => {
    return context.prisma.customer.findMany({
        select: {
            id: true,
            name: true,
            medicalLicense: true
        },
        where: {
            dispensaryId: dispensaryId || undefined,
            OR: [
                {
                    name: {
                        contains: searchQuery,
                        mode: 'insensitive',
                    },
                },
                {
                    medicalLicense: {
                        contains: searchQuery,
                        mode: 'insensitive',
                    },
                }

            ]
        },

        orderBy: { name: "asc" },
        take: 30,
    })
}

export const getAllCustomerQueueByDispensaryId = async (context, dispensaryId) => {
    return context.prisma.customerQueue.findMany({
        where: { dispensaryId: dispensaryId || undefined },
        include: {
            customer: true
        },
        orderBy: { createdAt: "asc" },
    })
}

export const checkIsCustomerInQueue = async (context, customerId) => {
    const res = await context.prisma.customerQueue.count({
        where: { customerId: customerId || undefined },
    })
    return {
        count: res
    }
}