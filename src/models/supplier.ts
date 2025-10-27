export const getSupplierById = async (context, id) => {
    return context.prisma.supplier.findUnique({
        where: { id: id || undefined },
    })
}

export const getAllSuppliersByOrganizationId = async (context, organizationId) => {
    return context.prisma.supplier.findMany({
        where: { 
            organizationId: organizationId || undefined,
            name: {
                not: null
            }
         },
        orderBy: { name: "asc" },
    })
}

export const getSupplierDataFromPackages = async (_args, context) => {
    let dispensaryIds: String[] = []
    const dispensaries = await context.prisma.dispensary.findMany({
        select: {
            id: true
        },
        where: { organizationId: _args.input.organizationId },
        orderBy: { id: "asc" },
    })

    for (let i = 0; i < dispensaries.length; i++) {
        dispensaryIds.push(dispensaries[i].id)
    }

    const result = await context.prisma.package.groupBy({
        by: ['ItemFromFacilityLicenseNumber'],
        where: {
            dispensaryId: {
                in: dispensaryIds,
            },
        },
        _min: {
            ItemFromFacilityName: true,
        },
    });

    const supplierDataInput = result.map(({
        _min,
        ItemFromFacilityLicenseNumber,
        ...data
    }) => ({
        organizationId: _args.input.organizationId,
        businessLicense: ItemFromFacilityLicenseNumber,
        name: _min.ItemFromFacilityName,
        isActive: true
    }));

    return supplierDataInput
}